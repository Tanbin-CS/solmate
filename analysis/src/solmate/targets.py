"""Load target vectors: cited values from targets.yaml plus computed terrain values."""

from __future__ import annotations

import copy
import json
from importlib import resources
from pathlib import Path

import yaml

DATA = Path(__file__).resolve().parents[3] / "data" / "targets"
TERRAIN = DATA / "terrain.v2.json"
THERMAL = DATA / "thermal.v2.json"
COMPUTED_KEYS = ("slope_median_deg", "slope_p90_proxy_deg", "elev_std_m")
THERMAL_KEYS = ("lst_diurnal_range_k", "lst_night_min_k", "t2m_mean_c", "t2m_coldest_month_c", "snow_months_per_year")


def load_targets(terrain_path: Path = TERRAIN, thermal_path: Path = THERMAL) -> list[dict]:
    """targets.yaml with computed values overlaid.

    Terrain fills `method: computed` indicators (terrain.v2.json). Diviner-sampled lunar
    thermal values (thermal.v2.json) replace the literature proxies and become `computed`.
    """
    with resources.files("solmate.config").joinpath("targets.yaml").open(encoding="utf-8") as f:
        targets = copy.deepcopy(yaml.safe_load(f)["targets"])
    computed = json.loads(terrain_path.read_text(encoding="utf-8"))["targets"] if terrain_path.exists() else {}
    thermal = json.loads(thermal_path.read_text(encoding="utf-8"))["targets"] if thermal_path.exists() else {}
    for t in targets:
        values = computed.get(t["id"], {})
        for key in COMPUTED_KEYS:
            entry = t["indicators"].get(key)
            if entry is not None and entry.get("method") == "computed" and values.get(key) is not None:
                entry["value"] = values[key]
                entry["source"] = values.get("source", entry.get("source"))
        for key, v in thermal.get(t["id"], {}).items():
            if key in THERMAL_KEYS and key in t["indicators"]:
                entry = t["indicators"][key]
                entry.update(value=v, method="computed", source=thermal[t["id"]]["source"])
    return targets
