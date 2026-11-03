"""Global land sample of 100 m terrain windows: the scale for stage-2 terrain similarity.

Every similarity needs Earth's spread of the indicator as its yardstick. For the ~1 km
dimensions that spread comes from all land cells (earth_stats.py). The 100 m terrain
indicators used the pool of refined candidate windows instead: top cells, novel leads and
validation sites. That pool runs from salt flats to high mountains, so its spread of median
slope was 8.6 degrees and a flat floodplain (0.6 degrees) scored 0.99 against Jezero's crater
floor (2.1 degrees). This step draws the yardstick from the same land the 1 km statistics
use: random land cells (MODIS land fraction > 0.5, |lat| <= 83, area-weighted), fixed seed,
each read as a 20 km ASTER GDEM window at 100 m exactly like refine.py.

Outputs:
  analysis/cache/stage2/<lat>_<lon>.json      per-window indicators, shared with refine.py
  data/screening/stage2_baseline.v2.json      the sample (committed)

Run:  uv run python -m solmate.pipeline.terrain100_baseline --n 500
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import time

import numpy as np

from solmate.compute import grid, terrain
from solmate.io import aster_gdem
from solmate.pipeline import earth_stats, refine

OUT = refine.OUT.parent / "stage2_baseline.v2.json"
SEED = 2026


def sample_cells(n: int, seed: int = SEED) -> list[tuple[float, float]]:
    """n distinct land cells, drawn with probability proportional to area, rounded like refine keys."""
    with np.load(earth_stats.STACK) as z:
        mask, weights = earth_stats.land_mask_and_weights(z["land_frac"])
    lat, lon = grid.cell_centres()
    idx = np.flatnonzero(mask)
    p = weights[mask].astype(float)
    pick = np.random.default_rng(seed).choice(idx, size=n, replace=False, p=p / p.sum())
    rows, cols = np.unravel_index(pick, mask.shape)
    return [(round(float(lat[r]), 3), round(float(lon[c]), 3)) for r, c in zip(rows, cols, strict=True)]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=500, help="number of random land windows")
    args = ap.parse_args()
    refine.CACHE.mkdir(parents=True, exist_ok=True)
    cells = sample_cells(args.n)
    todo = [c for c in cells if not (refine.CACHE / f"{refine._key(*c)}.json").exists()]
    print(f"{len(cells)} windows, {len(todo)} to read", flush=True)
    token = aster_gdem.earthdata_token() if todo else ""
    failed = []
    for n, (la, lo) in enumerate(todo, 1):
        t0 = time.time()
        try:
            z, meta = aster_gdem.read_window(la, lo, refine.SIZE_M, refine.CELL_M, token)
        except aster_gdem.TileReadError as exc:
            failed.append(refine._key(la, lo))
            print(f"[{n}/{len(todo)}] {la},{lo} FAILED ({exc}); will retry next run", flush=True)
            continue
        ind = terrain.compute_indicators(z, refine.CELL_M).as_dict() if float((z == z).mean()) > 0.5 else None
        rec = {"lat": la, "lon": lo, "tiles": meta["tiles"],
               "indicators": None if ind is None else {k: round(ind[k], 4) for k in refine.KEEP}}
        (refine.CACHE / f"{refine._key(la, lo)}.json").write_text(json.dumps(rec), encoding="utf-8")
        print(f"[{n}/{len(todo)}] {la},{lo} {time.time() - t0:.1f}s", flush=True)
    windows = []
    for c in cells:
        p = refine.CACHE / f"{refine._key(*c)}.json"
        if p.exists():
            windows.append(json.loads(p.read_text(encoding="utf-8")))
    doc = {"version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "sample": {"n": args.n, "seed": SEED, "land": earth_stats.MAX_ABS_LAT,
                      "definition": "random land cells, MODIS land fraction > 0.5, |lat| <= 83, cos(lat) area weights"},
           "window": {"size_m": refine.SIZE_M, "cell_m": refine.CELL_M,
                      "source": "ASTER GDEM v3 (ASTGTM.003), NASA LP DAAC"},
           "failed": failed, "windows": windows}
    OUT.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    usable = sum(1 for w in windows if w.get("indicators"))
    print(f"wrote {len(windows)} windows ({usable} usable, {len(failed)} failed) to {OUT}", flush=True)


if __name__ == "__main__":
    main()
