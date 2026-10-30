"""Stage-1 terrain indicators for every target at the same ~1 km / ~11 km scale as Earth.

Earth stage 1 uses SRTMGL30 (926 m pixels) summarised over 0.1 degree cells (12 x 12
pixels). Targets use the same pixel size and block: MOLA MEGDR 64 px/deg (926 m) for
Mars and LOLA 20 m resampled to 926 m for the Moon, with a 2-pixel margin so slopes
inside the block have full neighbourhoods.

Output: data/targets/terrain.v2.json (committed).
Run:    uv run python -m solmate.pipeline.target_terrain
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import grid, terrain
from solmate.io import nasa

ANALYSIS = Path(__file__).resolve().parents[3]
OUT = ANALYSIS.parent / "data" / "targets" / "terrain.v2.json"
PIXEL_M = 926.6
BLOCK, MARGIN = 12, 2


def mars_stats(lat: float, lon: float) -> dict:
    n = BLOCK + 2 * MARGIN
    z, top = nasa.mola_window(ANALYSIS / "cache" / "raw" / "MOLA", lat, lon % 360, n)
    slope = grid.slope_deg_latlon(z, top, 1 / 64, grid.METRES_PER_DEG["mars"])
    inner = slice(MARGIN, MARGIN + BLOCK)
    return grid.cell_terrain_stats(z[inner, inner], slope[inner, inner]) | {
        "source": "MOLA MEGDR 64 px/deg (MGS, NASA PDS)", "pixel_m": PIXEL_M}


def moon_stats(lat: float, lon: float) -> dict:
    sys.path.insert(0, str(ANALYSIS))
    import fetch  # v1 LOLA polar-stereographic reader (PGDA product 90)

    n = BLOCK + 2 * MARGIN
    z, meta = fetch.moon_window(lat, lon, n * PIXEL_M, PIXEL_M)
    slope = terrain.slope_deg(z, PIXEL_M)
    inner = slice(MARGIN, MARGIN + BLOCK)
    return grid.cell_terrain_stats(z[inner, inner], slope[inner, inner]) | {
        "source": "LRO LOLA LDEM_80S_20MPP_ADJ (NASA GSFC PGDA), area-averaged to 926 m", "pixel_m": PIXEL_M}


def main() -> None:
    with resources.files("solmate.config").joinpath("targets.yaml").open(encoding="utf-8") as f:
        targets = yaml.safe_load(f)["targets"]
    out = {}
    for t in targets:
        c = t["centroid"]
        stats = (moon_stats if t["body"] == "moon" else mars_stats)(c["lat"], c["lon"])
        out[t["id"]] = {k: (round(v, 4) if isinstance(v, float) and np.isfinite(v) else v) for k, v in stats.items()}
        print(f"{t['id']:22s} slope med {stats['slope_median_deg']:.2f} max {stats['slope_p90_proxy_deg']:.2f} "
              f"elev std {stats['elev_std_m']:.1f} m", flush=True)
    doc = {"version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "scale": f"{BLOCK} x {BLOCK} pixels of {PIXEL_M} m (matches Earth 0.1 degree SRTMGL30 cells)",
           "targets": out}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
