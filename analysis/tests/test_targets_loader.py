import json

from solmate.targets import load_targets


def test_computed_terrain_overlays_null_values(tmp_path):
    p = tmp_path / "terrain.json"
    p.write_text(json.dumps({"targets": {"jezero_crater": {"slope_median_deg": 1.5, "slope_p90_proxy_deg": 6.0,
                                                           "elev_std_m": 60.0, "source": "MOLA test"}}}))
    t = {x["id"]: x for x in load_targets(p, tmp_path / "none.json")}
    j = t["jezero_crater"]["indicators"]["slope_median_deg"]
    assert j["value"] == 1.5 and j["source"] == "MOLA test"
    assert t["haworth"]["indicators"]["slope_median_deg"]["value"] is None  # nothing computed for it here


def test_missing_terrain_file_keeps_nulls(tmp_path):
    t = load_targets(tmp_path / "absent.json", tmp_path / "absent2.json")
    assert all(x["indicators"]["elev_std_m"]["value"] is None for x in t)


def test_diviner_thermal_replaces_lunar_proxies(tmp_path):
    p = tmp_path / "thermal.json"
    p.write_text(json.dumps({"targets": {"haworth": {"lst_night_min_k": 51.1, "snow_months_per_year": 0,
                                                     "source": "Diviner test"}}}))
    t = {x["id"]: x for x in load_targets(tmp_path / "none.json", p)}
    v = t["haworth"]["indicators"]["lst_night_min_k"]
    assert v["value"] == 51.1 and v["method"] == "computed" and v["source"] == "Diviner test"
    assert t["jezero_crater"]["indicators"]["lst_night_min_k"]["method"] == "literature"
