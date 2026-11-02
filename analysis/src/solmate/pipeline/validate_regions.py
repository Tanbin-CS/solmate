"""Addendum 1 to the pre-registered validation (docs/VALIDATION.md): regions and Lunar ops.

Leaves the original validation untouched. For every target it scores the validation sites
at their 0.1 degree cells from the stack with the same code as the screen (all dimensions,
including Operations, which the screen leaves out), then reports:
  region-weighted AUC, a region block-bootstrap CI and leave-one-region-out learned weights,
  and for Moon targets the same metrics under the Lunar ops weights, plus the pre-registered
  decision on the Moon default.

Inputs:  cache/stack/stack_v2.npz, cache/screen/<target>.npz, data/stack/earth_stats.v2.json
Output:  data/validation/validation_regions.v1.json (committed)
Run:     uv run python -m solmate.pipeline.validate_regions
"""

from __future__ import annotations

import datetime as dt
import json
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import grid, modes, novelty, score
from solmate.compute import validation as val
from solmate.targets import load_targets

ANALYSIS = Path(__file__).resolve().parents[3]
STACK = ANALYSIS / "cache" / "stack" / "stack_v2.npz"
SCREEN = ANALYSIS / "cache" / "screen"
EARTH_STATS = ANALYSIS.parent / "data" / "stack" / "earth_stats.v2.json"
OUT = ANALYSIS.parent / "data" / "validation" / "validation_regions.v1.json"
REGION_KM = 500.0


def _r(x: float | None, nd: int = 3) -> float | None:
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def _cfg(name: str) -> dict:
    with resources.files("solmate.config").joinpath(name).open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def site_dims(target: dict, sites: list[dict], dims_cfg: dict, stats: dict, stack: dict,
              land_lat: np.ndarray, land_lon: np.ndarray, rows: np.ndarray, cols: np.ndarray) -> dict[str, np.ndarray]:
    """Dimension scores at each site's nearest scored land cell, for every dimension of the body."""
    idx = np.array([int(np.argmin(novelty.haversine_km(land_lat, land_lon, s["lat"], s["lon"]))) for s in sites])
    r, c = rows[idx], cols[idx]
    out = {}
    for k, d in dims_cfg.items():
        if target["body"] not in d["applies_to"]:
            continue
        plans = score.plan_dimension(d, target["indicators"], stats)
        if not plans:
            continue
        layers = {p.name: stack[p.name][r, c].astype(float) for p in plans}
        out[k], _ = score.dimension_scores(layers, plans, stats)
    return out


def metrics(pos_dims: dict, neg_dims: dict, weights: dict, g_pos: np.ndarray, g_neg: np.ndarray) -> dict:
    ids = [k for k in weights if weights[k] > 0 and k in pos_dims]
    w = np.array([weights[k] for k in ids])
    sp = val.weighted_scores(np.stack([pos_dims[k] for k in ids], -1), w)
    sn = val.weighted_scores(np.stack([neg_dims[k] for k in ids], -1), w)
    lo, hi = val.bootstrap_auc_ci(sp, sn)
    blo, bhi = val.block_bootstrap_auc_ci(sp, sn, g_pos, g_neg)
    return {"auc": _r(val.auc(sp, sn)), "auc_ci95_sites": [_r(lo), _r(hi)],
            "auc_region_weighted": _r(val.weighted_auc(sp, sn, val.region_weights(g_pos), val.region_weights(g_neg))),
            "auc_ci95_regions": [_r(blo), _r(bhi)]}


def main() -> None:
    labels = _cfg("validation_sites.yaml")
    dims_cfg = _cfg("dimensions.yaml")["dimensions"]
    lunar_ops = {k: float(v) for k, v in _cfg("dimensions.yaml")["presets"]["lunar_ops"].items() if v}
    stats_doc = json.loads(EARTH_STATS.read_text(encoding="utf-8"))["indicators"]
    stats = {k: modes.EarthStats(tuple(v["quantiles"]), v["median"], v["sigma"]) for k, v in stats_doc.items()}
    lat_c, lon_c = grid.cell_centres()
    controls = labels["controls"]
    g_neg = val.single_linkage_regions(np.array([s["lat"] for s in controls]), np.array([s["lon"] for s in controls]), REGION_KM)
    regions = {"controls": [[s["id"] for s, g in zip(controls, g_neg, strict=True) if g == k] for k in np.unique(g_neg)]}
    g_pos_by_body = {}
    for body, sites in labels["positives"].items():
        g = val.single_linkage_regions(np.array([s["lat"] for s in sites]), np.array([s["lon"] for s in sites]), REGION_KM)
        g_pos_by_body[body] = g
        regions[body] = [[s["id"] for s, gg in zip(sites, g, strict=True) if gg == k] for k in np.unique(g)]

    out: dict = {}
    with np.load(STACK) as z:
        stack = {k: z[k] for k in z.files}
    for t in load_targets():
        body = t["body"]
        with np.load(SCREEN / f"{t['id']}.npz") as z:
            rows, cols = z["rows"], z["cols"]
            screen_dims = {k[4:]: z[k] for k in z.files if k.startswith("dim_")}
        land_lat, land_lon = lat_c[rows], lon_c[cols]
        positives = labels["positives"][body]
        g_pos = g_pos_by_body[body]
        pd = site_dims(t, positives, dims_cfg, stats, stack, land_lat, land_lon, rows, cols)
        nd = site_dims(t, controls, dims_cfg, stats, stack, land_lat, land_lon, rows, cols)
        # same code, same cells: the screen's dimension scores must be reproduced exactly
        ip = np.array([int(np.argmin(novelty.haversine_km(land_lat, land_lon, s["lat"], s["lon"]))) for s in positives])
        for k, v in screen_dims.items():
            assert np.allclose(pd[k], v[ip], atol=1e-5, equal_nan=True), f"{t['id']} {k} differs from the screen"

        equal = {k: 1.0 for k in dims_cfg if k != "O" and body in dims_cfg[k]["applies_to"]}
        res = {"body": body, "n_positive_regions": int(len(np.unique(g_pos))), "n_control_regions": int(len(np.unique(g_neg))),
               "equal": metrics(pd, nd, equal, g_pos, g_neg)}
        learn_ids = sorted(k for k in equal if k in pd)
        x = np.vstack([np.stack([pd[k] for k in learn_ids], -1), np.stack([nd[k] for k in learn_ids], -1)])
        y = np.r_[np.ones(len(positives)), np.zeros(len(controls))]
        groups = np.r_[g_pos, g_neg + g_pos.max() + 1]
        res["learned_loro_auc"] = _r(val.loro_learned_auc(x, y, groups))
        if body == "moon":
            res["lunar_ops"] = metrics(pd, nd, lunar_ops, g_pos, g_neg)
        out[t["id"]] = res
        print(f"{t['id']:22s} equal {res['equal']}  LORO {res['learned_loro_auc']}"
              + (f"\n{'':22s} lunar_ops {res['lunar_ops']}" if body == "moon" else ""), flush=True)

    moon = [v for v in out.values() if v["body"] == "moon"]
    med = lambda key, preset: _r(float(np.median([v[preset][key] for v in moon])))  # noqa: E731
    summary = {
        "moon": {
            "equal": {"auc_median": med("auc", "equal"), "auc_region_weighted_median": med("auc_region_weighted", "equal")},
            "lunar_ops": {"auc_median": med("auc", "lunar_ops"),
                          "auc_region_weighted_median": med("auc_region_weighted", "lunar_ops")},
        },
    }
    s = summary["moon"]
    adopt = s["lunar_ops"]["auc_median"] >= s["equal"]["auc_median"] and \
        s["lunar_ops"]["auc_region_weighted_median"] >= s["equal"]["auc_region_weighted_median"]
    summary["moon"]["decision"] = ("adopt Lunar ops as the Moon default" if adopt
                                   else "keep equal as the Moon default; offer Lunar ops as a preset")
    doc = {"version": 1, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "plan": "docs/VALIDATION.md#addendum-1-regional-validation-and-lunar-ops-weights-pre-registered-2-nov-2026",
           "seed": 2026, "region_km": REGION_KM, "lunar_ops_weights": lunar_ops, "regions": regions,
           "summary": summary, "targets": out}
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
