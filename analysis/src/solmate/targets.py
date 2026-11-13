"""Load target vectors: cited values from targets.yaml plus computed terrain values."""

from __future__ import annotations

import copy
import json
from importlib import resources
from pathlib import Path

import yaml

from solmate import event

DATA = Path(__file__).resolve().parents[3] / "data" / "targets"
TERRAIN = DATA / "terrain.v2.json"
THERMAL = DATA / "thermal.v2.json"
ICE = DATA / "ice.v1.json"
COMPUTED_KEYS = ("slope_median_deg", "slope_p90_proxy_deg", "elev_std_m")
COLD_TRAP_RULE = ("Derived class, not a snow observation: 12 if the warmest Diviner temperature within 2 km "
                  "stays below 110 K all year (a perennial cold trap), 6 if below 125 K, else 0.")
THERMAL_KEYS = ("lst_diurnal_range_k", "lst_night_min_k", "t2m_mean_c", "t2m_coldest_month_c", "snow_months_per_year")
ICE_KEYS = ("ice_stable_surface_pct", "ice_stable_1m_pct")
ICE_NOTE = ("Context, not scored. Share of the ~11 km window where the Diviner thermal model keeps water ice stable; "
            "a model, not an ice detection.")


def load_targets(terrain_path: Path = TERRAIN, thermal_path: Path = THERMAL, ice_path: Path = ICE) -> list[dict]:
    """targets.yaml with computed values overlaid.

    Terrain fills `method: computed` indicators (terrain.v2.json). Diviner-sampled lunar
    thermal values (thermal.v2.json) replace the literature proxies and become `computed`.
    Diviner ice-stability shares (ice.v1.json) are added to the Moon targets as context indicators.
    """
    with resources.files("solmate.config").joinpath("targets.yaml").open(encoding="utf-8") as f:
        targets = copy.deepcopy(yaml.safe_load(f)["targets"])
    computed = json.loads(terrain_path.read_text(encoding="utf-8"))["targets"] if terrain_path.exists() else {}
    thermal = json.loads(thermal_path.read_text(encoding="utf-8"))["targets"] if thermal_path.exists() else {}
    ice_doc = json.loads(ice_path.read_text(encoding="utf-8")) if ice_path.exists() else {"targets": {}}
    event_values = event.target_values()
    for t in targets:
        values = computed.get(t["id"], {})
        for key in COMPUTED_KEYS:
            entry = t["indicators"].get(key)
            if entry is not None and entry.get("method") == "computed" and values.get(key) is not None:
                entry["value"] = values[key]
                entry["source"] = values.get("source", entry.get("source"))
        for key, v in thermal.get(t["id"], {}).items():
            if key in THERMAL_KEYS and key in t["indicators"]:
                old = t["indicators"][key]
                # The literature excerpt, DOI and uncertainty described the proxy this value replaces; drop them.
                entry = {"value": v, "unit": old.get("unit"), "source": thermal[t["id"]]["source"]}
                if key == "snow_months_per_year":
                    entry |= {"method": "derived",
                              "uncertainty": COLD_TRAP_RULE}
                else:
                    entry |= {"method": "computed",
                              "uncertainty": "Median over a 12 x 926 m window around the region centroid; Diviner "
                                             "seasonal maps measure surface (not air) temperature."}
                t["indicators"][key] = entry
    for t in targets:  # Diviner ice stability (event day, Resources tab): Moon context values, never scored
        for key in ICE_KEYS:
            v = ice_doc["targets"].get(t["id"], {}).get(key)
            if v is not None:
                t["indicators"][key] = {"value": v, "unit": "%", "method": "computed",
                                        "source": ice_doc["targets"][t["id"]]["source"], "url": ice_doc.get("url"),
                                        "uncertainty": ICE_NOTE}
    for t in targets:  # event-day datasets: cited values and computed samples (config/event_layers.yaml)
        t["indicators"].update(event_values.get(t["id"], {}))
    return targets
