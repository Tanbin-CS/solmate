"""Write golden test cases so the browser's TypeScript scoring matches Python exactly.

Output: frontend/src/science/golden/scoring.v2.json (committed). The vitest suite
recomputes every case in TypeScript and compares within 1e-9.

Run:  uv run python -m solmate.pipeline.golden
"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import aggregate, grid, modes, verdict
from solmate.targets import load_targets

ANALYSIS = Path(__file__).resolve().parents[3]
EARTH_STATS = ANALYSIS.parent / "data" / "stack" / "earth_stats.v2.json"
OUT = ANALYSIS.parent / "frontend" / "src" / "science" / "golden" / "scoring.v2.json"
STACK = ANALYSIS / "cache" / "stack" / "stack_v2.npz"
VALIDATION = ANALYSIS.parent / "data" / "validation" / "validation.v2.json"
# Real places that exercise every verdict branch: hyper-arid, high cold plateau, polar desert,
# humid lowland (vegetation flag), temperate cropland, and screening cells that fire the
# aeolian, rugged-highland, mafic and periglacial process tags.
PLACES = {"atacama": (-24.5, -69.25), "changtang": (36.45, 84.45), "dry_valleys": (-77.5, 161.8),
          "dhaka": (23.8, 90.4), "iowa": (42.0, -93.5), "sistan": (32.05, 61.25), "puna": (-28.05, -69.35),
          "west_kunlun": (34.95, 83.35), "aksai_chin": (34.45, 79.55)}


def _cfg(name: str) -> dict:
    with resources.files("solmate.config").joinpath(name).open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _explain_cases(stats_doc: dict) -> list[dict]:
    """Full VerdictCard output for real stack cells x every target, plus weight presets."""
    dims_doc = _cfg("dimensions.yaml")
    dims, presets = dims_doc["dimensions"], dict(dims_doc["presets"])
    for body, s in json.loads(VALIDATION.read_text(encoding="utf-8"))["summary"].items():
        presets[f"learned_{body}"] = s["learned_preset"]
    process_cfg = _cfg("processes.yaml")
    stats = {k: modes.EarthStats(tuple(v["quantiles"]), v["median"], v["sigma"]) for k, v in stats_doc.items()}
    lat_c, lon_c = grid.cell_centres()
    with np.load(STACK) as z:
        layers = {k: z[k] for k in z.files}
    places = {}
    for pid, (lat, lon) in PLACES.items():
        r, c = int(np.argmin(np.abs(lat_c - lat))), int(np.argmin(np.abs(lon_c - lon)))
        places[pid] = {k: float(v[r, c]) for k, v in layers.items() if v.ndim == 2}
    cases = []
    for t in load_targets():
        runs = [None] + ([("expert", presets["expert"]), ("mission_ops", presets["mission_ops"]),
                          (f"learned_{t['body']}", presets[f"learned_{t['body']}"])]
                         if t["id"] in ("jezero_crater", "mons_mouton_plateau") else [])
        for pid, values in places.items():
            for run in runs:
                w = None if run is None else run[1]
                cases.append({"place": pid, "values": {k: _num(v) for k, v in values.items()},
                              "target": t["id"], "preset": None if run is None else run[0],
                              "expected": verdict.explain(values, t, dims, stats, process_cfg, w)})
    return cases


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
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8", newline="\n")
    explain = _explain_cases(stats_doc)
    OUT.with_name("explain.v2.json").write_text(json.dumps({"version": 2, "cases": explain}, separators=(",", ":"))
                                                + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(cases)} similarity, {len(sai_cases)} SAI and {len(explain)} explain golden cases")


if __name__ == "__main__":
    main()
