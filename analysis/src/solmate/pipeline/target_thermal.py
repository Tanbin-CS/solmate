"""Per-region lunar thermal indicators from LRO Diviner seasonal polar maps.

Replaces the shared literature proxies for the nine Artemis regions with values sampled
from Diviner bolometric temperatures (Williams et al. 2019, doi 10.1029/2019JE006028;
240 m polar stereographic maps poleward of 80 S), at the same ~11 km scale as terrain.

  lst_diurnal_range_k   median over the window of (seasonal max - seasonal min), averaged over seasons
  lst_night_min_k       median winter minimum
  t2m_mean_c            median of the summer and winter averages (surface temperature)
  t2m_coldest_month_c   median winter average
  snow_months_per_year  cold-trap proxy: 12 if any pixel within 2 km stays below 110 K in both
                        seasons' maxima, 6 if below 125 K, else 0

Output: data/targets/thermal.v2.json (committed).
Run:    uv run python -m solmate.pipeline.target_thermal
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

from solmate.targets import load_targets

ANALYSIS = Path(__file__).resolve().parents[3]
RAW = ANALYSIS / "cache" / "raw" / "DIVINER"
OUT = ANALYSIS.parent / "data" / "targets" / "thermal.v2.json"
HALF_WINDOW_M = 12 * 926.6 / 2
COLD_TRAP_RADIUS_M = 2000.0
SOURCE = "LRO Diviner seasonal polar temperatures, Williams et al. 2019 (doi 10.1029/2019JE006028)"


def _read(name: str) -> tuple[np.ndarray, rasterio.Affine, CRS]:
    with rasterio.open(RAW / f"polar_south_80_{name}-float.tif") as r:
        return r.read(1).astype(np.float64), r.transform, CRS.from_wkt(r.crs.to_wkt())


def _window(a: np.ndarray, transform, x: float, y: float, half: float) -> tuple[np.ndarray, np.ndarray]:
    col0, row0 = ~transform * (x - half, y + half)
    col1, row1 = ~transform * (x + half, y - half)
    r0, r1 = int(np.floor(row0)), int(np.ceil(row1))
    c0, c1 = int(np.floor(col0)), int(np.ceil(col1))
    sub = a[r0:r1, c0:c1]
    rr, cc = np.mgrid[r0:r1, c0:c1]
    px, py = transform * (cc + 0.5, rr + 0.5)
    return sub, np.hypot(px - x, py - y)


def main() -> None:
    maps = {f"{s}_{v}": _read(f"{s}_{v}") for s in ("summer", "winter") for v in ("max", "min", "avg")}
    _, transform, crs = maps["summer_max"]
    to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    out = {}
    for t in load_targets():
        if t["body"] != "moon":
            continue
        x, y = to_xy.transform(t["centroid"]["lon"], t["centroid"]["lat"])
        w = {k: _window(a, transform, x, y, HALF_WINDOW_M) for k, (a, _, _) in maps.items()}
        rng = np.nanmean([w["summer_max"][0] - w["summer_min"][0], w["winter_max"][0] - w["winter_min"][0]], axis=0)
        mean = np.nanmean([w["summer_avg"][0], w["winter_avg"][0]], axis=0)
        near = w["summer_max"][1] <= COLD_TRAP_RADIUS_M
        coldest_max = np.nanmin(np.fmax(w["summer_max"][0], w["winter_max"][0])[near])
        trap = 12 if coldest_max < 110 else 6 if coldest_max < 125 else 0
        out[t["id"]] = {
            "lst_diurnal_range_k": round(float(np.nanmedian(rng)), 1),
            "lst_night_min_k": round(float(np.nanmedian(w["winter_min"][0])), 1),
            "t2m_mean_c": round(float(np.nanmedian(mean)) - 273.15, 1),
            "t2m_coldest_month_c": round(float(np.nanmedian(w["winter_avg"][0])) - 273.15, 1),
            "snow_months_per_year": trap,
            "coldest_max_within_2km_k": round(float(coldest_max), 1),
            "source": SOURCE,
        }
        print(t["id"], out[t["id"]], flush=True)
    doc = {"version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "window": "12 x 926.6 m square around the region centroid (matches Earth stage-1 cells)",
           "targets": out}
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
