"""Stage-1 global screen: score every land cell against every target.

For each target: dimension scores from the NASA stack, SAI (equal preset over the
dimensions that apply to the target's body), coverage, distance to known analogs.
Outputs:
  analysis/cache/screen/<target>.npz        per-cell SAI, coverage and dimension grids (not in git)
  data/screening/screening.v2.json          per target: top cells, novel leads, dimension
                                            leaders, documented-site scores (committed)

Run:  uv run python -m solmate.pipeline.screen_v2
"""

from __future__ import annotations

import datetime as dt
import json
import time
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import aggregate, grid, modes, novelty, score
from solmate.targets import load_targets

ANALYSIS = Path(__file__).resolve().parents[3]
STACK = ANALYSIS / "cache" / "stack" / "stack_v2.npz"
EARTH_STATS = ANALYSIS.parent / "data" / "stack" / "earth_stats.v2.json"
OUT_DIR = ANALYSIS / "cache" / "screen"
OUT_JSON = ANALYSIS.parent / "data" / "screening" / "screening.v2.json"
SITES_V1 = ANALYSIS / "sites.yaml"

N_STAGE2 = 400
N_NOVEL = 25
N_LEADERS = 5
SPACING_KM = 50.0
MIN_COVERAGE = aggregate.MIN_COVERAGE


def _yaml(name: str) -> dict:
    with resources.files("solmate.config").joinpath(name).open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _r(x: float, nd: int = 4) -> float | None:
    return None if not np.isfinite(x) else round(float(x), nd)


def _entry(i: int, lat, lon, sai, cov, dim_scores, sites, idx_known, dist_known) -> dict:
    return {
        "lat": round(float(lat[i]), 3), "lon": round(float(lon[i]), 3),
        "sai": _r(sai[i], 2), "coverage": _r(cov[i], 3),
        "dims": {k: _r(v[i]) for k, v in dim_scores.items()},
        "nearest_known": sites[idx_known[i]]["id"],
        "nearest_known_km": round(float(dist_known[i]), 1),
    }


def main() -> None:
    dims = _yaml("dimensions.yaml")["dimensions"]
    targets = load_targets()
    known = _yaml("known_analogs.yaml")
    stats_doc = json.loads(EARTH_STATS.read_text(encoding="utf-8"))["indicators"]
    stats = {k: modes.EarthStats(tuple(v["quantiles"]), v["median"], v["sigma"]) for k, v in stats_doc.items()}
    documented = [s for s in yaml.safe_load(SITES_V1.read_text(encoding="utf-8"))["sites"]
                  if s.get("role") in ("documented", "candidate", "control")]

    lat_c, lon_c = grid.cell_centres()
    with np.load(STACK) as z:
        land = (z["land_frac"] > 0.5) & (np.abs(lat_c[:, None]) <= 83.0)
        rows, cols = np.nonzero(land)
        layers = {k: z[k][land] for k in stats}
    lat, lon = lat_c[rows], lon_c[cols]
    dist_known, idx_known = novelty.nearest_known(lat, lon, known["sites"])
    _log(f"{land.sum()} land cells, {len(targets)} targets")

    # documented sites -> nearest land cell (for a validation preview)
    site_cells = {}
    for s in documented:
        d = novelty.haversine_km(lat, lon, s["lat"], s["lon"])
        site_cells[s["id"]] = (int(np.argmin(d)), s.get("role"), s.get("pair"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    result = {}
    for t in targets:
        body = t["body"]
        weights = {k: (1.0 if body in d["applies_to"] else 0.0) for k, d in dims.items()}
        weights["O"] = 0.0  # mission-ops preset only
        dim_scores, dim_cov, plans_doc = {}, {}, {}
        for k, d in dims.items():
            if weights[k] == 0:
                continue
            plans = score.plan_dimension(d, t["indicators"], stats)
            plans_doc[k] = [{"indicator": p.name, "mode": p.mode.kind, "direction": p.mode.direction,
                             "target": p.target, "weight": p.weight} for p in plans]
            if plans:
                dim_scores[k], dim_cov[k] = score.dimension_scores(layers, plans, stats)
        sai, cov = score.sai_grid(dim_scores, weights)
        np.savez_compressed(OUT_DIR / f"{t['id']}.npz", rows=rows.astype(np.int16), cols=cols.astype(np.int16),
                            sai=sai.astype(np.float32), coverage=cov.astype(np.float32),
                            **{f"dim_{k}": v.astype(np.float32) for k, v in dim_scores.items()})

        ok = cov >= MIN_COVERAGE
        ranked = np.where(ok, sai, np.nan)

        def entry(i: int, sai=sai, cov=cov, dim_scores=dim_scores) -> dict:
            return _entry(i, lat, lon, sai, cov, dim_scores, known["sites"], idx_known, dist_known)

        top = novelty.spaced_top(ranked, lat, lon, N_STAGE2, SPACING_KM)
        novel_scores = np.where(dist_known > known["novelty_km"], ranked, np.nan)
        novel = novelty.spaced_top(novel_scores, lat, lon, N_NOVEL, SPACING_KM)
        leaders = {k: [entry(i) for i in novelty.spaced_top(np.where(ok, v, np.nan), lat, lon, N_LEADERS, SPACING_KM)]
                   for k, v in dim_scores.items()}
        pct = {}
        valid = ranked[np.isfinite(ranked)]
        for sid, (i, role, pair) in site_cells.items():
            pct[sid] = {"role": role, "pair": pair, "sai": _r(sai[i], 2),
                        "percentile": _r(float((valid < sai[i]).mean() * 100), 1) if np.isfinite(sai[i]) else None}
        result[t["id"]] = {
            "name": t["name"], "body": body, "weights": weights, "plans": plans_doc,
            "land_cells_scored": int(ok.sum()),
            "top": [entry(i) for i in top],
            "novel_leads": [entry(i) for i in novel],
            "dimension_leaders": leaders,
            "documented_sites": pct,
        }
        best = result[t["id"]]["top"][0]
        _log(f"{t['id']:20s} best SAI {best['sai']} at {best['lat']},{best['lon']} "
             f"(near {best['nearest_known']} {best['nearest_known_km']} km); novel #1 "
             f"{result[t['id']]['novel_leads'][0]['lat']},{result[t['id']]['novel_leads'][0]['lon']}")
    doc = {"version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "stage": 1, "spacing_km": SPACING_KM, "novelty_km": known["novelty_km"], "targets": result}
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    _log(f"wrote {OUT_JSON} ({OUT_JSON.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
