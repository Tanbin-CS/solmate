import math

from solmate.compute import modes
from solmate.pipeline.rescore import attach_check, earth_stats_100m


def _stats():
    rng = [{"slope_median": 0.5 + i * 0.1, "slope_p90": 2 + i * 0.3, "hypsometric_integral": 0.3 + i * 0.005}
           for i in range(40)]
    return earth_stats_100m({"windows": [{"indicators": r} for r in rng] + [{"indicators": None}]})


def test_stats_come_from_the_land_sample_and_skip_unreadable_windows():
    s = _stats()
    assert set(s) == {"slope_median", "slope_p90", "hypsometric_integral"}
    assert isinstance(s["slope_median"], modes.EarthStats)
    assert 2.0 < s["slope_median"].median < 3.0


def test_check_is_attached_without_changing_sai_or_order():
    stage2 = {"targets": {"t": {"slope_median": 2.0, "slope_p90": 9.0, "hypsometric_integral": 0.26}},
              "windows": [{"lat": 1.0, "lon": 2.0, "indicators": {"slope_median": 2.0, "slope_p90": 9.0,
                                                                   "hypsometric_integral": 0.26}}]}
    a = {"lat": 1.0, "lon": 2.0, "sai": 40.0, "sai_refined": 99.0}
    b = {"lat": 5.0, "lon": 5.0, "sai": 70.0}
    targets = {"t": {"top": [a, b], "novel_leads": []}}
    attach_check(targets, stage2, _stats())
    assert [e["sai"] for e in targets["t"]["top"]] == [70.0, 40.0]
    assert "sai_refined" not in a and "terrain_100m" not in b
    assert math.isclose(a["terrain_100m"]["score"], 1.0)
