import numpy as np
import pytest

from solmate.compute import modes, score

STATS = {name: modes.earth_stats(np.linspace(0.0, 100.0, 1001)) for name in
         ("a", "b", "mafic_index", "carbonate_index", "quartz_index", "slope_median_deg")}


def test_plan_picks_match_toward_and_mineral_directions():
    dim = {"indicators": {"a": {"weight": 1}, "b": {"weight": 2}, "mafic_index": {}, "carbonate_index": {},
                          "quartz_index": {}}}
    target = {"a": {"value": 40}, "b": {"value": 500}, "mineral_class": {"mafic": True, "carbonate": False}}
    plans = {p.name: p for p in score.plan_dimension(dim, target, STATS)}
    assert plans["a"].mode == modes.Mode("match", 0)
    assert plans["b"].mode == modes.Mode("toward", 1) and plans["b"].weight == 2.0
    assert plans["mafic_index"].mode.direction == 1 and plans["carbonate_index"].mode.direction == -1
    assert "quartz_index" not in plans  # class not stated -> not scored


def test_plan_skips_computed_values_and_handles_operations():
    dim = {"indicators": {"a": {}, "slope_median_deg": {"direction": "lower_is_better"}}}
    plans = score.plan_dimension(dim, {"a": {"value": None, "method": "computed"}}, STATS)
    assert [p.name for p in plans] == ["slope_median_deg"]
    assert plans[0].target is None and plans[0].mode.direction == -1


def test_direction_only_similarity_ranks_by_ecdf():
    p = score.IndicatorPlan("mafic_index", 1.0, None, modes.Mode("toward", 1))
    s = score.indicator_similarity(np.array([10.0, 90.0, np.nan]), p, STATS["mafic_index"])
    assert s[1] > s[0] and np.isnan(s[2])


def test_dimension_scores_vectorised_with_missing_data():
    plans = [score.IndicatorPlan("a", 1.0, 40.0, modes.Mode("match", 0)),
             score.IndicatorPlan("b", 1.0, 500.0, modes.Mode("toward", 1))]
    layers = {"a": np.array([40.0, np.nan]), "b": np.array([100.0, 100.0])}
    d, cov = score.dimension_scores(layers, plans, STATS)
    assert d[0] == pytest.approx(1.0) and d[1] == pytest.approx(1.0)
    assert cov.tolist() == [1.0, 0.5]


def test_sai_grid_counts_planless_dimensions_as_missing():
    sai, cov = score.sai_grid({"T": np.array([0.8]), "C": np.array([0.4])}, {"T": 1, "C": 1, "Th": 1})
    assert sai[0] == pytest.approx(60.0) and cov[0] == pytest.approx(2 / 3)
