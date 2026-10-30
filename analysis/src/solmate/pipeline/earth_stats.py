"""Export area-weighted Earth land statistics for every scored indicator.

The quantile table, median and robust sigma per indicator fix the scale of every
similarity, so live (browser / API) and precomputed scores agree. Land = cells with
MODIS land fraction > 0.5 between 83 S and 83 N (ASTER GDEM coverage). Weights are
cos(latitude), the relative area of a 0.1 degree cell.

Output: data/stack/earth_stats.v2.json (committed; also shipped to the web app).
Run:    uv run python -m solmate.pipeline.earth_stats
"""

from __future__ import annotations

import datetime as dt
import json
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import grid, modes

ANALYSIS = Path(__file__).resolve().parents[3]
STACK = ANALYSIS / "cache" / "stack" / "stack_v2.npz"
OUT = ANALYSIS.parent / "data" / "stack" / "earth_stats.v2.json"
MAX_ABS_LAT = 83.0


def load_dimensions() -> dict:
    with resources.files("solmate.config").joinpath("dimensions.yaml").open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def land_mask_and_weights(land_frac: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    lat, _ = grid.cell_centres()
    lat2 = np.broadcast_to(lat[:, None], land_frac.shape)
    mask = (land_frac > 0.5) & (np.abs(lat2) <= MAX_ABS_LAT)
    return mask, np.cos(np.radians(lat2))


def main() -> None:
    dims = load_dimensions()
    indicators = sorted({i for d in dims["dimensions"].values() for i in d["indicators"]})
    with np.load(STACK) as z:
        mask, weights = land_mask_and_weights(z["land_frac"])
        stats = {}
        for name in indicators:
            v = z[name][mask]
            s = modes.earth_stats(v, weights[mask])
            stats[name] = {
                "median": s.median,
                "sigma": s.sigma,
                "quantiles": [round(q, 6) for q in s.quantiles],
                "land_coverage": float(np.isfinite(v).mean()),
            }
    out = {
        "version": 2,
        "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "land_definition": f"MODIS land fraction > 0.5, |lat| <= {MAX_ABS_LAT}, cos(lat) area weights",
        "land_cells": int(mask.sum()),
        "indicators": stats,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(stats)} indicators over {out['land_cells']} land cells to {OUT}")


if __name__ == "__main__":
    main()
