import numpy as np
import pytest

from solmate.compute import aggregate as agg
from solmate.compute import modes

EARTH = modes.earth_stats(np.linspace(0.0, 100.0, 1001))  # uniform 0..100, median 50


def test_earth_stats_quantiles_and_robust_sigma():
    assert EARTH.p1 == pytest.approx(1.0, abs=0.1) and EARTH.p99 == pytest.approx(99.0, abs=0.1)
    assert EARTH.median == pytest.approx(50.0)
    assert EARTH.sigma == pytest.approx(25.0 * modes.MAD_TO_SIGMA, rel=1e-3)


def test_area_weights_shift_the_distribution():
    v = np.array([0.0] * 50 + [10.0] * 50)
    w = np.array([1.0] * 50 + [3.0] * 50)  # the 10s cover three times more area
    assert modes.earth_stats(v).median == pytest.approx(5.0, abs=0.5)
    assert modes.earth_stats(v, w).median == pytest.approx(10.0)


def test_earth_stats_needs_data():
    with pytest.raises(ValueError):
        modes.earth_stats(np.array([1.0, np.nan]))


def test_constant_sample_gets_nonzero_sigma():
    assert modes.earth_stats(np.ones(20)).sigma == 1.0


def test_ecdf_is_monotone_and_bounded():
    x = np.array([-10.0, 0.0, 25.0, 50.0, 100.0, 1e6])
    p = modes.ecdf(x, EARTH)
    assert np.all(np.diff(p) >= 0) and p[0] == 0.0 and p[-1] == 1.0
    assert p[3] == pytest.approx(0.5, abs=1e-3)


def test_mode_rule():
    assert modes.choose_mode(42.0, EARTH) == modes.Mode("match", 0)
    assert modes.choose_mode(500.0, EARTH) == modes.Mode("toward", 1)
    assert modes.choose_mode(-80.0, EARTH) == modes.Mode("toward", -1)


def test_match_similarity_peaks_at_target():
    s = modes.similarity(np.array([42.0, 42.0 + EARTH.sigma, np.nan]), 42.0, EARTH)
    assert s[0] == pytest.approx(1.0)
    assert s[1] == pytest.approx(np.exp(-0.5))
    assert np.isnan(s[2])


def test_toward_similarity_rewards_extremes_in_target_direction():
    cold = modes.similarity(np.array([5.0, 95.0]), -80.0, EARTH)  # target colder than any Earth value
    assert cold[0] > cold[1]
    hot = modes.similarity(np.array([5.0, 95.0]), 500.0, EARTH)
    assert hot[1] > hot[0]


def test_toward_gap():
    assert modes.toward_gap(50.0, 150.0, EARTH) == pytest.approx(1.0)  # at Earth's median: whole gap left
    assert modes.toward_gap(100.0, 150.0, EARTH) == pytest.approx(0.5)
    assert modes.toward_gap(150.0, 150.0, EARTH) == 0.0


def test_band_edges():
    assert agg.band(0.75) == "strong" and agg.band(0.749) == "partial"
    assert agg.band(0.40) == "partial" and agg.band(0.399) == "weak"


def test_weighted_mean_skips_nan_and_reports_share():
    m, share = agg.weighted_mean(np.array([1.0, np.nan, 0.0]), np.array([1.0, 2.0, 1.0]))
    assert m == pytest.approx(0.5) and share == pytest.approx(0.5)


def test_sai_uses_only_applicable_dimensions_with_data():
    r = agg.sai({"T": 0.9, "Th": 0.5, "I": np.nan}, {"T": 1.0, "Th": 1.0, "I": 1.0, "O": 0.0})
    assert r.sai == pytest.approx(70.0)
    assert r.coverage == pytest.approx(2 / 3)
    assert not r.insufficient
    assert [d.id for d in r.dimensions] == ["T", "Th", "I"]  # weight-0 dimension is off
    contrib = {d.id: d.contribution for d in r.dimensions}
    assert contrib["T"] == pytest.approx(0.45) and contrib["I"] == 0.0
    assert {d.id: d.band for d in r.dimensions} == {"T": "strong", "Th": "partial", "I": "n/a"}


def test_sai_flags_low_coverage():
    r = agg.sai({"T": 0.9}, {"T": 1.0, "Th": 1.0, "S": 1.0})
    assert r.insufficient and r.coverage == pytest.approx(1 / 3)


def test_sai_with_no_data_is_nan():
    assert np.isnan(agg.sai({}, {"T": 1.0}).sai)
