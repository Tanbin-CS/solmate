"""Load target vectors: cited values from targets.yaml plus computed terrain values."""

from __future__ import annotations

import copy
import json
from importlib import resources
from pathlib import Path

import yaml

TERRAIN = Path(__file__).resolve().parents[3] / "data" / "targets" / "terrain.v2.json"
COMPUTED_KEYS = ("slope_median_deg", "slope_p90_proxy_deg", "elev_std_m")


def load_targets(terrain_path: Path = TERRAIN) -> list[dict]:
    """targets.yaml with `method: computed` indicators filled from terrain.v2.json when available."""
    with resources.files("solmate.config").joinpath("targets.yaml").open(encoding="utf-8") as f:
        targets = copy.deepcopy(yaml.safe_load(f)["targets"])
    computed = json.loads(terrain_path.read_text(encoding="utf-8"))["targets"] if terrain_path.exists() else {}
    for t in targets:
        values = computed.get(t["id"], {})
        for key in COMPUTED_KEYS:
            entry = t["indicators"].get(key)
            if entry is not None and entry.get("method") == "computed" and values.get(key) is not None:
                entry["value"] = values[key]
                entry["source"] = values.get("source", entry.get("source"))
    return targets
