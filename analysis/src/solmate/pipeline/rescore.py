"""Attach the 100 m terrain check to stage-1 leads, without changing their SAI or ranking.

1. Earth statistics for the 100 m terrain indicators from a global land sample of 100 m
   windows (data/screening/stage2_baseline.v2.json, terrain100_baseline.py), the same land
   the ~1 km statistics describe. Written to data/screening/stage2_stats.v2.json, which the
   terrain API also reads.
2. Every top cell and novel lead that was refined gets its 100 m terrain score as a
   separate check (`terrain_100m`). The SAI and the ranking stay on the validated ~1 km
   dimensions: on the pre-registered validation sites the 100 m score alone did not tell
   analog sites from controls (docs/VALIDATION.md, addendum 3), so it informs but never
   replaces the terrain dimension.
3. The same test is written to data/validation/terrain100_check.v2.json: terrain alone,
   positives against controls, at ~1 km and at 100 m, per target.

Run:  uv run python -m solmate.pipeline.rescore
"""

from __future__ import annotations

import datetime as dt
import json
import math
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import grid, modes, terrain100
from solmate.compute import validation as val

DATA = Path(__file__).resolve().parents[3].parent / "data" / "screening"
STAGE2 = DATA / "stage2.v2.json"
BASELINE = DATA / "stage2_baseline.v2.json"
STATS = DATA / "stage2_stats.v2.json"
SCREEN = DATA / "screening.v2.json"
CHECK = DATA.parent / "validation" / "terrain100_check.v2.json"


def _key(lat: float, lon: float) -> str:
    return f"{lat:.3f}_{lon:.3f}"


def earth_stats_100m(baseline: dict) -> dict[str, modes.EarthStats]:
    pool = [w["indicators"] for w in baseline["windows"] if w.get("indicators")]
    return {name: modes.earth_stats(np.array([p[name] for p in pool], dtype=float)) for name in terrain100.SCORED}


def attach_check(targets: dict, stage2: dict, stats: dict[str, modes.EarthStats]) -> None:
    """Add the 100 m terrain check to every refined entry; SAI and order stay on the ~1 km dimensions."""
    by_key = {_key(w["lat"], w["lon"]): w for w in stage2["windows"]}
    for tid, t in targets.items():
        target = stage2["targets"].get(tid)
        for lst in ("top", "novel_leads"):
            for e in t[lst]:
                e.pop("sai_refined", None)
                e.pop("terrain_100m", None)
                w = by_key.get(_key(e["lat"], e["lon"]))
                if not w or not w.get("indicators") or target is None:
                    continue
                score, per = terrain100.terrain_score(w["indicators"], target, stats)
                e["terrain_100m"] = {"score": None if not math.isfinite(score) else round(score, 4),
                                     "similarity": {k: round(v, 4) for k, v in per.items()},
                                     "indicators": w["indicators"]}
            t[lst].sort(key=lambda e: -(e["sai"] if e["sai"] is not None and math.isfinite(e["sai"]) else -1e9))


def terrain_only_auc(stage2: dict, stats: dict[str, modes.EarthStats], labels: dict) -> dict[str, dict]:
    """Per target: AUC of terrain alone (positives vs controls) at 100 m and, when the stage-1 grids are here, ~1 km."""
    from solmate.pipeline import validate_v2  # stage-1 cell lookup; needs analysis/cache/screen
    from solmate.targets import load_targets

    win = {_key(w["lat"], w["lon"]): w["indicators"] for w in stage2["windows"] if w.get("indicators")}
    lat_c, lon_c = grid.cell_centres()
    out = {}
    for t in load_targets():
        target = stage2["targets"].get(t["id"])
        pos, ctrl = labels["positives"][t["body"]], labels["controls"]
        row: dict = {"body": t["body"]}
        if target is not None:
            def t100(sites: list[dict], tv: dict = target) -> np.ndarray:
                return np.array([terrain100.terrain_score(win[_key(s["lat"], s["lon"])], tv, stats)[0]
                                 for s in sites if _key(s["lat"], s["lon"]) in win])
            p, c = t100(pos), t100(ctrl)
            row |= {"auc_100m": round(val.auc(p, c), 3), "n_positives_100m": len(p), "n_controls_100m": len(c)}
        npz = validate_v2.SCREEN / f"{t['id']}.npz"
        if npz.exists():
            with np.load(npz) as z:
                lat, lon, dim_t = lat_c[z["rows"]], lon_c[z["cols"]], z["dim_T"]
            ip, ic = validate_v2._cells(pos, lat, lon), validate_v2._cells(ctrl, lat, lon)
            row["auc_1km"] = round(val.auc(dim_t[ip], dim_t[ic]), 3)
        out[t["id"]] = row
    return out


def main() -> None:
    stage2 = json.loads(STAGE2.read_text(encoding="utf-8"))
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    stats = earth_stats_100m(baseline)
    usable = sum(1 for w in baseline["windows"] if w.get("indicators"))
    STATS.write_text(json.dumps({
        "version": 3, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "sample": f"{usable} random land 100 m ASTER GDEM windows "
                  f"({baseline['sample']['definition']}, seed {baseline['sample']['seed']})",
        "indicators": {k: {"median": v.median, "sigma": v.sigma, "quantiles": list(v.quantiles)} for k, v in stats.items()},
    }, indent=1) + "\n", encoding="utf-8")

    screen = json.loads(SCREEN.read_text(encoding="utf-8"))
    attach_check(screen["targets"], stage2, stats)
    for tid, t in screen["targets"].items():
        print(f"{tid:22s} best: {t['top'][0]['sai']} at {t['top'][0]['lat']},{t['top'][0]['lon']}"
              f" | novel: {t['novel_leads'][0]['sai']} at {t['novel_leads'][0]['lat']},{t['novel_leads'][0]['lon']}",
              flush=True)
    screen["stage"] = 2
    SCREEN.write_text(json.dumps(screen, separators=(",", ":")) + "\n", encoding="utf-8")

    with resources.files("solmate.config").joinpath("validation_sites.yaml").open(encoding="utf-8") as f:
        labels = yaml.safe_load(f)
    rows = terrain_only_auc(stage2, stats, labels)
    CHECK.write_text(json.dumps({
        "version": 1, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "test": "terrain alone, pre-registered positives vs controls (validation_sites.yaml), plain AUC",
        "targets": rows,
    }, indent=1) + "\n", encoding="utf-8")
    for tid, r in rows.items():
        print(f"{tid:22s} terrain-only AUC  1 km {r.get('auc_1km')}  100 m {r.get('auc_100m')}", flush=True)


if __name__ == "__main__":
    main()
