"""Rescore stage-1 leads with stage-2 (100 m) terrain.

1. Earth statistics for the 100 m terrain indicators from the pool of refined windows
   (data/screening/stage2_stats.v2.json, also read by the terrain API).
2. For every top cell and novel lead that was refined, the ~1 km terrain dimension T is
   replaced by the 100 m terrain score (T100) and the SAI is recomputed with equal weights.
3. Lists are re-ranked by the refined SAI where available (refined entries first).

Run:  uv run python -m solmate.pipeline.rescore
"""

from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path

import numpy as np

from solmate.compute import modes, terrain100

DATA = Path(__file__).resolve().parents[3].parent / "data" / "screening"
STAGE2 = DATA / "stage2.v2.json"
STATS = DATA / "stage2_stats.v2.json"
SCREEN = DATA / "screening.v2.json"


def _key(lat: float, lon: float) -> str:
    return f"{lat:.3f}_{lon:.3f}"


def refined_sai(dims: dict[str, float | None], t100: float) -> float:
    vals = [v for k, v in dims.items() if k != "T" and v is not None and math.isfinite(v)]
    if math.isfinite(t100):
        vals.append(t100)
    elif dims.get("T") is not None:
        vals.append(dims["T"])  # no 100 m score: keep the ~1 km terrain dimension
    return round(float(np.mean(vals)) * 100, 2) if vals else float("nan")


def main() -> None:
    stage2 = json.loads(STAGE2.read_text(encoding="utf-8"))
    pool = [w["indicators"] for w in stage2["windows"] if w.get("indicators")]
    stats = {}
    for name in terrain100.SCORED:
        es = modes.earth_stats(np.array([p[name] for p in pool], dtype=float))
        stats[name] = es
    STATS.write_text(json.dumps({
        "version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "sample": f"{len(pool)} refined 100 m ASTER GDEM windows (stage-2 pool)",
        "indicators": {k: {"median": v.median, "sigma": v.sigma, "quantiles": list(v.quantiles)} for k, v in stats.items()},
    }, indent=1) + "\n", encoding="utf-8")

    by_key = {_key(w["lat"], w["lon"]): w for w in stage2["windows"]}
    screen = json.loads(SCREEN.read_text(encoding="utf-8"))
    for tid, t in screen["targets"].items():
        target = stage2["targets"].get(tid)
        for lst in ("top", "novel_leads"):
            for e in t[lst]:
                w = by_key.get(_key(e["lat"], e["lon"]))
                if not w or not w.get("indicators") or target is None:
                    continue
                score, per = terrain100.terrain_score(w["indicators"], target, stats)
                e["terrain_100m"] = {"score": None if not math.isfinite(score) else round(score, 4),
                                     "similarity": {k: round(v, 4) for k, v in per.items()},
                                     "indicators": w["indicators"]}
                e["sai_refined"] = refined_sai(e["dims"], score)
            t[lst].sort(key=lambda e: -(e.get("sai_refined") if e.get("sai_refined") is not None
                                        and math.isfinite(e["sai_refined"]) else -1e9 + (e["sai"] or 0)))
        print(f"{tid:22s} best refined: {t['top'][0].get('sai_refined')} at {t['top'][0]['lat']},{t['top'][0]['lon']}"
              f" | novel: {t['novel_leads'][0].get('sai_refined')} at "
              f"{t['novel_leads'][0]['lat']},{t['novel_leads'][0]['lon']}", flush=True)
    screen["stage"] = 2
    SCREEN.write_text(json.dumps(screen, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
