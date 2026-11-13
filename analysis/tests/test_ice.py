import json

import numpy as np
import pytest

from solmate.compute.ice import INVALID, ice_stats
from solmate.targets import load_targets


def test_ice_stats_area_weighted_shares():
    depth = np.array([0.0, 0.5, 2.0, INVALID])
    area = np.array([1.0, 1.0, 1.0, 1.0])
    temp = np.array([60.0, 80.0, 100.0, 200.0])
    s = ice_stats(depth, area, temp, temp + 50)
    assert s["ice_stable_surface_pct"] == 25.0  # depth 0
    assert s["ice_stable_1m_pct"] == 50.0  # depths 0 and 0.5; 2 m is too deep, -999 is not stable at all
    assert s["n_triangles"] == 4


def test_ice_stats_weights_by_triangle_area():
    s = ice_stats(np.array([0.0, INVALID]), np.array([3.0, 1.0]), np.array([50.0, 200.0]), np.array([90.0, 300.0]))
    assert s["ice_stable_surface_pct"] == 75.0


def test_ice_stats_skips_triangles_without_temperature():
    s = ice_stats(np.array([0.0, 0.0]), np.array([1.0, 1.0]), np.array([INVALID, 70.0]), np.array([INVALID, 90.0]))
    assert s["n_triangles"] == 1 and s["ice_stable_surface_pct"] == 100.0


def test_ice_stats_empty_window_raises():
    with pytest.raises(ValueError):
        ice_stats(np.array([]), np.array([]), np.array([]), np.array([]))


def test_ice_values_join_moon_targets_as_context(tmp_path):
    p = tmp_path / "ice.json"
    p.write_text(json.dumps({"url": "https://example.org/prp", "targets": {
        "haworth": {"ice_stable_surface_pct": 12.5, "ice_stable_1m_pct": 40.0, "source": "PRP test"}}}))
    t = {x["id"]: x for x in load_targets(tmp_path / "none.json", tmp_path / "none2.json", p)}
    v = t["haworth"]["indicators"]["ice_stable_1m_pct"]
    assert v["value"] == 40.0 and v["unit"] == "%" and v["source"] == "PRP test" and "not scored" in v["uncertainty"]
    assert "ice_stable_1m_pct" not in t["jezero_crater"]["indicators"]


def test_ice_indicators_are_never_scored():
    from importlib import resources

    import yaml

    with resources.files("solmate.config").joinpath("dimensions.yaml").open(encoding="utf-8") as f:
        dims = yaml.safe_load(f)["dimensions"]
    scored = {k for d in dims.values() for k in d["indicators"]}
    assert not scored & {"ice_stable_surface_pct", "ice_stable_1m_pct"}
