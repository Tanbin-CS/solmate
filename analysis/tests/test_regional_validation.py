import numpy as np

from solmate.compute import validation as val


def test_regions_chain_sites_closer_than_threshold():
    # three sites 300 km apart in a line chain into one region; a far site stands alone
    lat = np.array([0.0, 0.0, 0.0, 40.0])
    lon = np.array([0.0, 2.7, 5.4, 100.0])
    r = val.single_linkage_regions(lat, lon, 500)
    assert r[0] == r[1] == r[2] and r[3] != r[0]
    assert val.single_linkage_regions(lat, lon, 100).tolist() == [0, 1, 2, 3]


def test_region_weights_sum_to_one_per_region():
    w = val.region_weights(np.array([0, 0, 0, 1]))
    assert np.allclose(w, [1 / 3, 1 / 3, 1 / 3, 1])


def test_weighted_auc_counts_each_region_once():
    pos, neg = np.array([0.9, 0.9, 0.9, 0.1]), np.array([0.5])
    plain = val.auc(pos, neg)
    weighted = val.weighted_auc(pos, neg, val.region_weights(np.array([0, 0, 0, 1])), np.ones(1))
    assert plain == 0.75 and weighted == 0.5
    assert val.weighted_auc(pos, neg, np.ones(4), np.ones(1)) == plain


def test_block_bootstrap_is_wider_than_site_bootstrap_when_sites_cluster():
    rng = np.random.default_rng(0)
    pos = np.r_[np.full(8, 0.8) + rng.normal(0, 0.01, 8), [0.3, 0.35]]
    neg = rng.uniform(0.2, 0.6, 12)
    g_pos = np.r_[np.zeros(8, int), [1, 2]]
    site = val.bootstrap_auc_ci(pos, neg)
    block = val.block_bootstrap_auc_ci(pos, neg, g_pos, np.arange(12))
    assert (block[1] - block[0]) > (site[1] - site[0])


def test_loro_learned_auc_separates_an_easy_problem():
    x = np.array([[0.9, 0.1], [0.8, 0.2], [0.85, 0.3], [0.1, 0.5], [0.2, 0.4], [0.15, 0.6]])
    y = np.array([1, 1, 1, 0, 0, 0])
    assert val.loro_learned_auc(x, y, np.array([0, 1, 2, 3, 4, 5])) == 1.0


def test_lunar_ops_preset_matches_the_preregistered_weights():
    from importlib import resources

    import yaml

    presets = yaml.safe_load(resources.files("solmate.config").joinpath("dimensions.yaml").read_text(encoding="utf-8"))["presets"]
    # docs/VALIDATION.md addendum 1, written before the results
    expected = {"T": 2, "O": 1, "S": 1, "C": 0.5, "Th": 0.5, "I": 0.5, "M": 0.5}
    assert {k: v for k, v in presets["lunar_ops"].items() if v} == expected
