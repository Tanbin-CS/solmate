"""Run the pre-registered v2 validation (docs/VALIDATION.md) on the stage-1 screen.

Inputs: analysis/cache/screen/<target>.npz from screen_v2, validation_sites.yaml.
Output: data/validation/validation.v2.json (committed).
Run:    uv run python -m solmate.pipeline.validate_v2
"""

from __future__ import annotations

import datetime as dt
import json
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import grid, novelty
from solmate.compute import validation as val
from solmate.targets import load_targets

ANALYSIS = Path(__file__).resolve().parents[3]
SCREEN = ANALYSIS / "cache" / "screen"
OUT = ANALYSIS.parent / "data" / "validation" / "validation.v2.json"


def _r(x: float, nd: int = 3) -> float | None:
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def _cells(sites: list[dict], lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    return np.array([int(np.argmin(novelty.haversine_km(lat, lon, s["lat"], s["lon"]))) for s in sites])


def main() -> None:
    with resources.files("solmate.config").joinpath("validation_sites.yaml").open(encoding="utf-8") as f:
        labels = yaml.safe_load(f)
    lat_c, lon_c = grid.cell_centres()
    controls = labels["controls"]
    out: dict = {}
    learned_by_body: dict[str, list[np.ndarray]] = {}
    for t in load_targets():
        with np.load(SCREEN / f"{t['id']}.npz") as z:
            lat, lon = lat_c[z["rows"]], lon_c[z["cols"]]
            sai = z["sai"]
            dim_ids = sorted(k[4:] for k in z.files if k.startswith("dim_"))
            dims = np.stack([z[f"dim_{k}"] for k in dim_ids], axis=-1)
        positives = labels["positives"][t["body"]]
        ip, ic = _cells(positives, lat, lon), _cells(controls, lat, lon)
        sp, sc = sai[ip], sai[ic]
        finite = np.sort(sai[np.isfinite(sai)])
        pct = np.searchsorted(finite, sp) / finite.size * 100
        lo, hi = val.bootstrap_auc_ci(sp, sc)
        ablation = {}
        for j, k in enumerate(dim_ids):
            keep = [i for i in range(len(dim_ids)) if i != j]
            w = np.ones(len(keep))
            ablation[k] = _r(val.auc(val.weighted_scores(dims[ip][:, keep], w),
                                     val.weighted_scores(dims[ic][:, keep], w)) - val.auc(sp, sc))
        x = np.vstack([dims[ip], dims[ic]])
        y = np.r_[np.ones(len(ip)), np.zeros(len(ic))]
        w_learned, _ = val.fit_nonneg_logistic(x, y)
        w_norm = w_learned / w_learned.sum() * len(dim_ids) if w_learned.sum() > 0 else np.ones(len(dim_ids))
        learned_by_body.setdefault(t["body"], []).append(w_norm)
        cv_med, cv_lo, cv_hi = val.cv_learned_auc(x, y)
        rob = val.dirichlet_auc(dims[ip], dims[ic])
        out[t["id"]] = {
            "body": t["body"], "n_positives": len(ip), "n_controls": len(ic),
            "auc_equal": _r(val.auc(sp, sc)), "auc_ci95": [_r(lo), _r(hi)],
            "positives_median_land_percentile": _r(float(np.median(pct)), 1),
            "positives": {s["id"]: {"sai": _r(sp[i], 2), "land_percentile": _r(pct[i], 1)} for i, s in enumerate(positives)},
            "controls": {s["id"]: {"sai": _r(sc[i], 2), "biome": s["biome"]} for i, s in enumerate(controls)},
            "ablation_delta_auc": ablation,
            "learned": {"weights": dict(zip(dim_ids, [_r(v) for v in w_norm], strict=True)),
                        "cv_auc_median": _r(cv_med), "cv_auc_p5_p95": [_r(cv_lo), _r(cv_hi)]},
            "random_weights_auc_p5_p50_p95": [_r(q) for q in np.quantile(rob, [0.05, 0.5, 0.95])],
        }
        print(f"{t['id']:22s} AUC {out[t['id']]['auc_equal']} CI {out[t['id']]['auc_ci95']}  "
              f"pos median pct {out[t['id']]['positives_median_land_percentile']}  learned CV {_r(cv_med)}", flush=True)
    summary = {}
    for body, ws in learned_by_body.items():
        ids = [k for k, v in out.items() if v["body"] == body]
        summary[body] = {
            "auc_median": _r(float(np.median([out[k]["auc_equal"] for k in ids]))),
            "positives_median_land_percentile": _r(
                float(np.median([out[k]["positives_median_land_percentile"] for k in ids])), 1),
            "learned_preset": dict(zip(sorted(out[ids[0]]["learned"]["weights"]),
                                       [_r(v) for v in np.mean(ws, axis=0)], strict=True)),
        }
    doc = {"version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "plan": "docs/VALIDATION.md", "seed": 2026, "summary": summary, "targets": out}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
