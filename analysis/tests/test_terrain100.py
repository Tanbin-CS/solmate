import math

import numpy as np
import pytest

from solmate.compute import modes, terrain100

STATS = {k: modes.earth_stats(np.linspace(0.0, 40.0, 401)) for k in terrain100.SCORED}


def test_exact_match_scores_one():
    target = {"slope_median": 5.0, "slope_p90": 12.0, "hypsometric_integral": 0.45}
    s, per = terrain100.terrain_score(dict(target), target, STATS)
    assert s == pytest.approx(1.0) and set(per) == set(terrain100.SCORED)


def test_unscored_indicators_and_missing_values_are_ignored():
    target = {"slope_median": 5.0, "local_relief": 100.0}
    s, per = terrain100.terrain_score({"slope_median": 5.0, "local_relief": 999.0}, target, STATS)
    assert list(per) == ["slope_median"] and s == pytest.approx(1.0)


def test_no_comparable_indicator_gives_nan():
    s, per = terrain100.terrain_score({"slope_median": float("nan")}, {"slope_median": 5.0}, STATS)
    assert math.isnan(s) and per == {}
