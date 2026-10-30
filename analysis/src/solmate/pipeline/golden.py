"""Write golden test cases so the browser's TypeScript scoring matches Python exactly.

Output: frontend/src/science/golden/scoring.v2.json (committed). The vitest suite
recomputes every case in TypeScript and compares within 1e-9.

Run:  uv run python -m solmate.pipeline.golden
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from solmate.compute import aggregate, modes

ANALYSIS = Path(__file__).resolve().parents[3]
EARTH_STATS = ANALYSIS.parent / "data" / "stack" / "earth_stats.v2.json"
OUT = ANALYSIS.parent / "frontend" / "src" / "science" / "golden" / "scoring.v2.json"


def _num(x: float) -> float | None:
    return None if not np.isfinite(x) else float(x)


def main() -> None:
    stats_doc = json.loads(EARTH_STATS.read_text(encoding="utf-8"))["indicators"]
    cases = []
    # (indicator, target, probe values) chosen to hit match, toward-up and toward-down
    probes = {
        "lst_diurnal_range_k": (90.0, [0.5, 13.0, 25.0, 31.0, 40.0]),  # Mars-like range: toward up
        "lst_night_min_k": (40.0, [200.0, 250.0, 290.0]),  # lunar cold trap: toward down
        "albedo_wsa_sw": (0.18, [0.05, 0.12, 0.18, 0.3, 0.9]),  # inside Earth's range: match
        "aridity_index": (0.0, [0.0, 0.002, 0.05, 1.0, 10.0]),  # driest possible: toward down at the edge
        "barren_pct": (100.0, [0.0, 50.0, 100.0]),  # at Earth's p99 edge
    }
    for name, (target, xs) in probes.items():
        st = stats_doc[name]
        es = modes.EarthStats(tuple(st["quantiles"]), st["median"], st["sigma"])
        m = modes.choose_mode(target, es)
        sims = modes.similarity(np.array(xs), target, es, m)
        cases.append({
            "indicator": name, "target": target, "x": xs,
            "mode": {"kind": m.kind, "direction": m.direction},
            "ecdf": [float(v) for v in modes.ecdf(np.array(xs), es)],
            "similarity": [_num(v) for v in sims],
            "gap": [modes.toward_gap(x, target, es) for x in xs],
        })
    sai_cases = []
    for scores, weights in [
        ({"T": 0.9, "Th": 0.5, "I": None}, {"T": 1.0, "Th": 1.0, "I": 1.0, "O": 0.0}),
        ({"T": 0.9}, {"T": 1.0, "Th": 1.0, "S": 1.0}),
        ({"T": 0.2, "C": 0.8, "Th": 0.6, "S": 1.0, "M": 0.3}, {"T": 1.5, "C": 1, "Th": 1, "S": 1, "M": 1}),
    ]:
        r = aggregate.sai({k: (np.nan if v is None else v) for k, v in scores.items()}, weights)
        sai_cases.append({
            "scores": scores, "weights": weights, "sai": _num(r.sai), "coverage": r.coverage,
            "insufficient": r.insufficient,
            "dimensions": [{"id": d.id, "score": _num(d.score), "contribution": d.contribution, "band": d.band}
                           for d in r.dimensions],
        })
    doc = {"version": 2, "earth_stats": {k: stats_doc[k] for k in probes}, "similarity": cases, "sai": sai_cases}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(cases)} similarity and {len(sai_cases)} SAI golden cases to {OUT}")


if __name__ == "__main__":
    main()
