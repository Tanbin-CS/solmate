"""Small height grids for the side-by-side 3D terrain view on the web.

The 3D view puts a 20 km block of Earth next to a 20 km block of its target at the same
scale, so a judge or student can see the ground the 100 m terrain check measures. This
step writes one height grid per target and per leading Earth place, from the same NASA
sources and grid as the 100 m check (refine.py):

  Earth  ASTER GDEM v3 (ASTGTM.003, NASA/METI, LP DAAC), 20 km at 100 m, area average
  Moon   LRO LOLA LDEM_80S_20MPP_ADJ (NASA GSFC PGDA), 20 km at 100 m
  Mars   Mars 2020 CTX DTM, Jezero (NASA/USGS), 20 km at 100 m

Arcadia Planitia has no 100 m terrain model, so it has no 3D block.

Each grid is n x n little-endian uint16: 0 means no data, 1..65535 map linearly onto
[min_m, max_m]. At 200 x 200 a grid is 80 KB. Context only: never scored.

Outputs:
  frontend/public/data/v2/terrain3d/<id>.bin
  frontend/public/data/v2/terrain3d/index.json

Run:  uv run python -m solmate.pipeline.terrain3d --top 5 --novel 5
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path

import numpy as np

from solmate.io import aster_gdem
from solmate.pipeline import refine

ANALYSIS = Path(__file__).resolve().parents[3]
OUT = ANALYSIS.parent / "frontend" / "public" / "data" / "v2" / "terrain3d"
SIZE_M, CELL_M = refine.SIZE_M, refine.CELL_M
SOURCES = {
    "earth": "ASTER GDEM v3 (ASTGTM.003), NASA/METI, LP DAAC",
    "moon": "LRO LOLA LDEM_80S_20MPP_ADJ, NASA GSFC PGDA",
    "mars": "Mars 2020 CTX DTM, Jezero (NASA/USGS)",
}


def encode(z: np.ndarray) -> tuple[bytes, float, float]:
    """uint16 grid (0 = no data, 1..65535 = min..max) plus the min and max in metres."""
    ok = np.isfinite(z)
    if not ok.any():
        raise ValueError("window has no data")
    lo, hi = float(z[ok].min()), float(z[ok].max())
    span = hi - lo if hi > lo else 1.0
    q = np.zeros(z.shape, dtype="<u2")
    q[ok] = np.clip(np.rint((z[ok] - lo) / span * 65534) + 1, 1, 65535).astype("<u2")
    return q.tobytes(), lo, hi


def decode(buf: bytes, n: int, lo: float, hi: float) -> np.ndarray:
    """Inverse of encode (used by the tests and to check the web decoder)."""
    q = np.frombuffer(buf, dtype="<u2").reshape(n, n).astype(np.float64)
    z = lo + (q - 1) / 65534 * (hi - lo if hi > lo else 1.0)
    z[q == 0] = np.nan
    return z


def place_id(lat: float, lon: float) -> str:
    return f"earth_{lat:.3f}_{lon:.3f}".replace("-", "m")


def leading_places(screen: dict, top: int, novel: int) -> dict[str, dict]:
    """The best top cells and novel leads per target, by stored SAI, deduplicated."""
    out: dict[str, dict] = {}
    for tid, t in screen["targets"].items():
        for lst, k in (("top", top), ("novel_leads", novel)):
            for e in t[lst][:k]:
                p = out.setdefault(place_id(e["lat"], e["lon"]), {"lat": e["lat"], "lon": e["lon"], "for": []})
                if tid not in p["for"]:
                    p["for"].append(tid)
    return out


def target_grids() -> dict[str, tuple[np.ndarray, str]]:
    sys.path.insert(0, str(ANALYSIS))
    import fetch  # v1 LOLA / CTX readers (cached under analysis/cache)
    from solmate.targets import load_targets

    out = {}
    for t in load_targets():
        c = t["centroid"]
        if t["body"] == "moon":
            out[t["id"]] = (fetch.moon_window(c["lat"], c["lon"], SIZE_M, CELL_M)[0], "moon")
        elif t["id"] == "jezero_crater":
            out[t["id"]] = (fetch.mars_window(c["lat"], c["lon"], SIZE_M, CELL_M)[0], "mars")
    return out


def write(path: Path, z: np.ndarray, body: str) -> dict:
    buf, lo, hi = encode(z)
    path.write_bytes(buf)
    return {
        "file": path.name,
        "n": int(z.shape[0]),
        "cell_m": CELL_M,
        "min_m": round(lo, 2),
        "max_m": round(hi, 2),
        "valid_fraction": round(float(np.isfinite(z).mean()), 4),
        "source": SOURCES[body],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, default=5, help="best stage-1 cells per target")
    ap.add_argument("--novel", type=int, default=5, help="best novel leads per target")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "index.json"
    old = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"places": {}}

    targets = {tid: write(OUT / f"{tid}.bin", z, body) for tid, (z, body) in target_grids().items()}
    places = leading_places(json.loads(refine.SCREEN.read_text(encoding="utf-8")), args.top, args.novel)
    token = None
    failed = []
    for n, (pid, p) in enumerate(places.items(), 1):
        if pid in old["places"] and (OUT / f"{pid}.bin").exists():
            p |= {k: v for k, v in old["places"][pid].items() if k not in ("for",)}
            continue
        token = token or aster_gdem.earthdata_token()
        t0 = time.time()
        try:
            z, _ = aster_gdem.read_window(p["lat"], p["lon"], SIZE_M, CELL_M, token)
            p |= write(OUT / f"{pid}.bin", z, "earth")
        except (aster_gdem.TileReadError, ValueError) as exc:
            failed.append(pid)
            print(f"[{n}/{len(places)}] {pid} FAILED ({exc})", flush=True)
            continue
        print(f"[{n}/{len(places)}] {pid} {time.time() - t0:.1f}s", flush=True)
    for pid in failed:
        places.pop(pid)
    for stale in OUT.glob("earth_*.bin"):
        if stale.stem not in places:
            stale.unlink()
    doc = {
        "version": 1,
        "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "window": {"size_m": SIZE_M, "cell_m": CELL_M},
        "encoding": "n x n little-endian uint16; 0 = no data; 1..65535 linear on [min_m, max_m]",
        "use": "context only (3D view); never scored",
        "targets": targets,
        "places": places,
    }
    index_path.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    size = sum(f.stat().st_size for f in OUT.glob("*.bin")) // 1024
    print(f"wrote {len(targets)} targets and {len(places)} places ({size} KB, {len(failed)} failed)", flush=True)


if __name__ == "__main__":
    main()
