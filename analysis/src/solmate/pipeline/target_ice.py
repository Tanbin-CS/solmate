"""Near-surface water-ice stability at the nine lunar regions, from the LRO Diviner Polar Resource Product.

Added on event day (13 Nov 2026) from the Space Apps Resources tab ("NASA LRO Diviner Lunar Data").
The south-pole PRP (PDS LRO-L-DLRE-5-PRP-V2.0, Paige et al. 2010, doi 10.1126/science.1187726) gives,
for each triangle of a polar mesh, the depth at which water ice would sublimate at 1 kg m-2 per billion
years: 0 means ice is stable at the surface, -999 means deeper than 2.87 m (not stable near the surface).

For each Moon target, over the same 12 x 926.6 m square window as target_thermal (area-weighted by
triangle area):
  ice_stable_surface_pct  share of the window where ice is stable at the surface
  ice_stable_1m_pct       share where ice is stable within 1 m of the surface (reachable by a drill)
Both are context values for the Moon targets: shown with their source, never scored, and Earth has no
counterpart layer. temp_avg / temp_max medians are kept as a cross-check against thermal.v2.json.

Input:  analysis/cache/raw/DIVINER/dlre_prp_south.tab (604.8 MB, from PDS Geosciences)
Output: data/targets/ice.v1.json (committed)
Run:    uv run python -m solmate.pipeline.target_ice
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
from pyproj import Transformer

from solmate.compute.ice import ice_stats
from solmate.pipeline.target_thermal import HALF_WINDOW_M, RAW, _read
from solmate.targets import ICE, load_targets

TABLE = RAW / "dlre_prp_south.tab"
SOURCE = ("LRO Diviner Polar Resource Product (PDS LRO-L-DLRE-5-PRP-V2.0; Paige et al. 2010, "
          "doi 10.1126/science.1187726)")
URL = "https://pds-geosciences.wustl.edu/missions/lro/diviner.htm"


def read_table(path: Path = TABLE) -> dict[str, np.ndarray]:
    """The PRP table: triangle centre lon/lat, area (km2), temp_avg, temp_max (K), ice_depth (m)."""
    a = np.loadtxt(path, skiprows=1, delimiter=",", dtype=np.float64) if path.stat().st_size < 50_000_000 else _read_fast(path)
    v1, v2, v3 = a[:, 0:3], a[:, 3:6], a[:, 6:9]
    area = 0.5 * np.linalg.norm(np.cross(v2 - v1, v3 - v1), axis=1)
    return {"lon": a[:, 9], "lat": a[:, 10], "area": area, "temp_avg": a[:, 12], "temp_max": a[:, 13],
            "ice_depth": a[:, 14]}


def _read_fast(path: Path) -> np.ndarray:
    import pandas as pd

    return pd.read_csv(path, sep=",", skipinitialspace=True, header=None, skiprows=1, engine="c",
                       dtype=np.float64).to_numpy()


def main() -> None:
    prp = read_table()
    _, _, crs = _read("summer_max")  # the Diviner polar stereographic frame target_thermal uses
    to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    near_pole = prp["lat"] < -80.0
    px, py = to_xy.transform(prp["lon"][near_pole], prp["lat"][near_pole])
    sub = {k: v[near_pole] for k, v in prp.items()}
    out = {}
    for t in load_targets():
        if t["body"] != "moon":
            continue
        x, y = to_xy.transform(t["centroid"]["lon"], t["centroid"]["lat"])
        win = (np.abs(px - x) <= HALF_WINDOW_M) & (np.abs(py - y) <= HALF_WINDOW_M)
        out[t["id"]] = ice_stats(sub["ice_depth"][win], sub["area"][win], sub["temp_avg"][win], sub["temp_max"][win])
        out[t["id"]]["source"] = SOURCE
        print(t["id"], out[t["id"]], flush=True)
    doc = {"version": 1, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "window": "12 x 926.6 m square around the region centroid (same as thermal.v2.json)",
           "url": URL, "targets": out}
    ICE.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
