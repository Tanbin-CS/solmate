"""Sample event-day Moon / Mars rasters at every target centroid (config/event_layers.yaml).

For each layer with `targets.sample`, the mean of the raster within window_km of each target
of that body becomes the target's value (method: computed). Cited values need no run.

Output: data/targets/event.v2.json (committed; read by solmate.targets.load_targets)
Run:    uv run python -m solmate.pipeline.event_targets
"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

import yaml

from solmate import event
from solmate.io import generic

RAW = Path(__file__).resolve().parents[3] / "cache" / "raw"


def sample_all(raw_dir: Path = RAW, layers: list[dict] | None = None, targets: list[dict] | None = None) -> dict:
    layers = event.load() if layers is None else layers
    if targets is None:
        with resources.files("solmate.config").joinpath("targets.yaml").open(encoding="utf-8") as f:
            targets = yaml.safe_load(f)["targets"]
    out: dict[str, dict[str, dict]] = {}
    for e in layers:
        spec = (e.get("targets") or {}).get("sample")
        if not spec:
            continue
        for t in targets:
            if t["body"] != spec["body"]:
                continue
            c = t["centroid"]
            value = generic.sample_target(raw_dir, spec, float(c["lat"]), float(c["lon"]))
            out.setdefault(e["id"], {})[t["id"]] = {
                "value": round(value, 6), "source": f"{e['source']}; mean within {spec.get('window_km', 20)} km",
                "url": e["url"]}
    return out


def main() -> None:
    samples = sample_all()
    event.TARGET_SAMPLES.parent.mkdir(parents=True, exist_ok=True)
    event.TARGET_SAMPLES.write_text(json.dumps({"version": 1, "targets": samples}, indent=1, sort_keys=True) + "\n",
                                    encoding="utf-8", newline="\n")
    n = sum(len(v) for v in samples.values())
    print(f"sampled {n} target values for {len(samples)} event layers -> {event.TARGET_SAMPLES}")


if __name__ == "__main__":
    main()
