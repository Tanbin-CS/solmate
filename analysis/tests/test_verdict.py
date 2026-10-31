from importlib import resources

import numpy as np
import yaml

from solmate.compute import modes

CONFIG = yaml.safe_load(resources.files("solmate.config").joinpath("processes.yaml").read_text(encoding="utf-8"))

def test_explain_assembles_a_verdict_for_a_real_target():
    from solmate.compute import verdict
    from solmate.targets import load_targets

    dims = yaml.safe_load(resources.files("solmate.config").joinpath("dimensions.yaml").read_text(encoding="utf-8"))
    names = {i for d in dims["dimensions"].values() for i in d["indicators"]}
    stats = {k: modes.earth_stats(np.linspace(0.0, 100.0, 1001)) for k in names}
    jezero = next(t for t in load_targets() if t["id"] == "jezero_crater")
    values = {k: 50.0 for k in names} | {"surface_pressure_hpa": 1000.0, "forest_pct": 0.0}
    v = verdict.explain(values, jezero, dims["dimensions"], stats, CONFIG)
    assert v["target"] == "jezero_crater" and 0 <= v["sai"] <= 100
    assert {d["id"] for d in v["dimensions"]} == {"T", "C", "Th", "S", "M", "I", "D"}
    assert {b["id"] for b in v["breaks_down"] if b["kind"] == "always"} == {"gravity", "pressure", "radiation"}
    assert all("text" in x for x in v["matches"] + v["differs"] + v["breaks_down"])


def test_explain_uses_preset_weights_and_skips_zero_weight_dimensions():
    from solmate.compute import verdict
    from solmate.targets import load_targets

    dims = yaml.safe_load(resources.files("solmate.config").joinpath("dimensions.yaml").read_text(encoding="utf-8"))
    names = {i for d in dims["dimensions"].values() for i in d["indicators"]}
    stats = {k: modes.earth_stats(np.linspace(0.0, 100.0, 1001)) for k in names}
    jezero = next(t for t in load_targets() if t["id"] == "jezero_crater")
    values = {k: 50.0 for k in names} | {"surface_pressure_hpa": 1000.0}
    ops = dims["presets"]["mission_ops"]
    v = verdict.explain(values, jezero, dims["dimensions"], stats, CONFIG, ops)
    assert {d["id"] for d in v["dimensions"]} == {k for k, w in ops.items() if w > 0}
    only_terrain = verdict.explain(values, jezero, dims["dimensions"], stats, CONFIG, {"T": 1.0})
    assert [d["id"] for d in only_terrain["dimensions"]] == ["T"]
    assert only_terrain["sai"] == round(only_terrain["dimensions"][0]["score"] * 100, 2)
