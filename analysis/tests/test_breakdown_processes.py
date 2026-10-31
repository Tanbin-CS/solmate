import math
from importlib import resources

import numpy as np
import pytest
import yaml

from solmate.compute import breakdown, modes, processes, score

STATS = {k: modes.earth_stats(np.linspace(0.0, 100.0, 1001)) for k in ("a", "mafic_index", "lst_diurnal_range_k")}
CONFIG = yaml.safe_load(resources.files("solmate.config").joinpath("processes.yaml").read_text(encoding="utf-8"))
MOON = {"gravity_m_s2": {"value": 1.62}, "surface_pressure_hpa": {"value": 3e-12},
        "radiation_dose_msv_day": {"value": 1.369}}


def test_environment_limits_always_present():
    out = {x["id"]: x for x in breakdown.environment_limits(MOON, 1000.0)}
    assert set(out) == {"gravity", "pressure", "radiation"}
    assert "0.17x Earth" in out["gravity"]["text"]
    assert "about 10^-15 of this place" in out["pressure"]["text"]
    assert out["radiation"]["target"] == 1.369 and "208" in out["radiation"]["text"]  # ~208x background


def test_dimension_limits_flag_weak_and_missing():
    out = breakdown.dimension_limits({"T": 0.9, "M": 0.2, "I": math.nan}, ["T", "M", "I", "C"])
    kinds = {x["id"]: x["kind"] for x in out}
    assert kinds == {"M": "differs", "I": "not_assessed", "C": "not_assessed"}


def test_toward_gap_reported_only_when_far():
    plan = score.IndicatorPlan("a", 1.0, 500.0, modes.Mode("toward", 1))
    far = breakdown.toward_gaps({"a": 60.0}, [plan], STATS)
    near = breakdown.toward_gaps({"a": 400.0}, [plan], STATS)
    assert far and far[0]["kind"] == "earth_can_only_approach" and not near


def test_vegetation_flag():
    assert breakdown.vegetation_flag({"forest_pct": 25.0, "cropland_pct": 10.0})
    assert not breakdown.vegetation_flag({"forest_pct": 5.0})


def test_process_tags_and_uses_fire_on_thresholds():
    hoggar = {"dust_aod_mean": 0.175, "barren_pct": 100.0, "aridity_index": 0.057, "albedo_wsa_sw": 0.17,
              "slope_median_deg": 3.4, "mafic_index": 99.0, "t2m_mean_c": 21.0, "snow_months_per_year": 0.0,
              "lst_diurnal_range_k": 95.0, "frost_days_per_year": 0.0}
    tags = {t["id"] for t in processes.tags_for(hoggar, "mars", CONFIG, STATS)}
    assert tags == {"aeolian_dust", "volcanic_mafic"}
    assert {t["id"] for t in processes.tags_for(hoggar, "moon", CONFIG, STATS)} == {"volcanic_mafic"}
    uses = {u["id"] for u in processes.uses_for(hoggar, CONFIG, STATS)}
    assert uses == {"rover_mobility", "thermal_cycling", "dust_mitigation"}


def test_missing_value_never_fires():
    assert not processes.condition_holds(None, {"gte": 0}, None)
    assert not processes.condition_holds(float("nan"), {"lt": 1}, None)


@pytest.mark.parametrize("cond,expected", [({"gte": 5}, True), ({"lt": 5}, False), ({"gte_earth_quantile": 50}, False)])
def test_condition_ops(cond, expected):
    assert processes.condition_holds(5.0, cond, STATS["a"]) is expected

