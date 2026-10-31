"""Export everything the web app needs for v2 into frontend/public/data/v2/.

Committed (small JSON):
  model.json        dimensions, presets (incl. learned), Earth stats, process rules, tile layout, model_version
  targets.json      11 targets with cited + computed indicator values and breaks-down constants
  screening/<id>.json  per target: top cells and novel leads with verdicts, dimension leaders
  validation.json   pre-registered validation results
Not committed (binary, ~60 MB, gitignored; mirrored to gs://solmate-13571-data/web/tiles, restored before build):
  tiles/<row>_<col>.bin.gz   10 x 10 degree tiles of the 0.1 degree stack, uint16-quantised per layer

Tile format: for each layer in model.json["tiles"]["layers"] order, 100 x 100 uint16 values,
row-major from the tile's north-west cell; value v -> lo + v * (hi - lo) / 65534, 65535 = no data.
Heavy-tailed layers (listed in tiles.transforms, e.g. aridity 0-4843 with deserts below 0.05)
are stored as log(x + LOG_OFFSET) and decoded with exp(v) - LOG_OFFSET, so the error stays
relative (~1.4e-4 of the value) and small values keep their precision.

Run:  uv run python -m solmate.pipeline.export_web [--tiles]
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from importlib import resources
from pathlib import Path

import numpy as np
import yaml

from solmate.compute import grid
from solmate.targets import load_targets

ANALYSIS = Path(__file__).resolve().parents[3]
REPO = ANALYSIS.parent
OUT = REPO / "frontend" / "public" / "data" / "v2"
TILE_OUT = OUT / "tiles"  # gitignored; deploy restores it from gs://solmate-13571-data/web/tiles
STACK = ANALYSIS / "cache" / "stack" / "stack_v2.npz"
TILE = 100  # cells per tile side (10 degrees)
CONTEXT = ("surface_pressure_hpa", "shrub_pct", "grass_savanna_pct", "cropland_pct", "wetland_pct", "water_pct",
           "urban_pct", "land_frac")


def _cfg(name: str) -> dict:
    with resources.files("solmate.config").joinpath(name).open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _dump(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def tile_layers(dims: dict) -> list[str]:
    scored = sorted({i for d in dims.values() for i in d["indicators"]})
    return scored + [c for c in CONTEXT if c not in scored]


def quantise(a: np.ndarray, lo: float, hi: float) -> np.ndarray:
    q = np.full(a.shape, 65535, dtype=np.uint16)
    ok = np.isfinite(a)
    span = hi - lo if hi > lo else 1.0
    q[ok] = np.clip(np.round((a[ok] - lo) / span * 65534), 0, 65534).astype(np.uint16)
    return q


def dequantise(q: np.ndarray, lo: float, hi: float) -> np.ndarray:
    out = lo + q.astype(np.float64) * ((hi - lo) if hi > lo else 1.0) / 65534
    return np.where(q == 65535, np.nan, out)


LOG_OFFSET = 1e-4


def choose_transform(v: np.ndarray) -> str:
    """"log" for non-negative layers whose maximum is 100x their (positive) median; linear otherwise."""
    if v.size and v.min() >= 0:
        med = float(np.median(v))
        if med > 0 and v.max() > 100 * med:
            return "log"
    return "linear"


def encode(a: np.ndarray, transform: str) -> np.ndarray:
    return np.log(a + LOG_OFFSET) if transform == "log" else a


def decode(x: np.ndarray, transform: str) -> np.ndarray:
    return np.exp(x) - LOG_OFFSET if transform == "log" else x


def export_tiles(layers: list[str]) -> dict:
    TILE_OUT.mkdir(parents=True, exist_ok=True)
    ranges, transforms, written = {}, {}, []
    with np.load(STACK) as z:
        land = z["land_frac"] > 0.5
        data = {k: z[k].astype(np.float64) for k in layers}
    for k, a in data.items():
        t = choose_transform(a[land & np.isfinite(a)])
        if t != "linear":
            transforms[k] = {"kind": t, "offset": LOG_OFFSET}
            data[k] = encode(a, t)
        v = data[k][land & np.isfinite(data[k])]
        ranges[k] = [float(v.min()), float(v.max())] if v.size else [0.0, 1.0]
    for r0 in range(0, grid.NROWS, TILE):
        for c0 in range(0, grid.NCOLS, TILE):
            if not land[r0:r0 + TILE, c0:c0 + TILE].any():
                continue
            buf = b"".join(quantise(np.where(land[r0:r0 + TILE, c0:c0 + TILE], data[k][r0:r0 + TILE, c0:c0 + TILE],
                                             np.nan), *ranges[k]).tobytes() for k in layers)
            name = f"{r0 // TILE:02d}_{c0 // TILE:02d}.bin.gz"
            (TILE_OUT / name).write_bytes(gzip.compress(buf, compresslevel=9, mtime=0))
            written.append(name[:-7])
    return {"cells_per_side": TILE, "res_deg": grid.RES, "layers": layers, "ranges": ranges, "transforms": transforms,
            "encoding": "uint16 little-endian, layer-major; v -> lo + v*(hi-lo)/65534, then exp(v) - offset for log layers;"
                        " 65535 = no data",
            "available": sorted(written), "path": "/data/v2/tiles/{row}_{col}.bin.gz"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tiles", action="store_true", help="also write the binary tiles (slow)")
    args = ap.parse_args()
    dims = _cfg("dimensions.yaml")["dimensions"]
    presets = _cfg("dimensions.yaml")["presets"]
    validation = json.loads((REPO / "data" / "validation" / "validation.v2.json").read_text(encoding="utf-8"))
    for body, s in validation["summary"].items():
        presets[f"learned_{body}"] = s["learned_preset"]
    earth = json.loads((REPO / "data" / "stack" / "earth_stats.v2.json").read_text(encoding="utf-8"))
    layers = tile_layers(dims)
    tiles = export_tiles(layers) if args.tiles else json.loads((OUT / "model.json").read_text(encoding="utf-8"))["tiles"]
    model = {"version": 2, "dimensions": dims, "presets": presets, "earth_stats": earth["indicators"],
             "processes": _cfg("processes.yaml"), "known_analogs": _cfg("known_analogs.yaml"), "tiles": tiles}
    model["model_version"] = hashlib.sha256(json.dumps(model, sort_keys=True).encode()).hexdigest()[:12]
    _dump(OUT / "model.json", model)
    _dump(OUT / "targets.json", {"targets": load_targets()})
    screen = json.loads((REPO / "data" / "screening" / "screening.v2.json").read_text(encoding="utf-8"))
    for tid, t in screen["targets"].items():
        _dump(OUT / "screening" / f"{tid}.json", {
            "target": tid, "stage": screen["stage"], "novelty_km": screen["novelty_km"],
            "top": t["top"][:25], "novel_leads": t["novel_leads"], "dimension_leaders": t["dimension_leaders"],
            "documented_sites": t["documented_sites"], "plans": t["plans"]})
    _dump(OUT / "validation.json", validation)
    sizes = {p.name: p.stat().st_size for p in OUT.rglob("*.json")}
    print(f"model_version {model['model_version']}; {len(sizes)} JSON files, {sum(sizes.values()) / 1e6:.2f} MB;"
          f" tiles: {len(tiles['available'])}")


if __name__ == "__main__":
    main()
