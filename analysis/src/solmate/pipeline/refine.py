"""Stage 2: 100 m terrain for the best candidates, novel leads and validation sites.

For every unique window (20 km square, 100 m cells) the ASTER GDEM v3 elevation is read
from NASA Earthdata Cloud and the terrain indicators are computed. Results are cached per
window, so the run is resumable and safe to interrupt. Target-side 100 m terrain comes
from LRO LOLA (Moon) and the Mars 2020 CTX DTM (Jezero); Arcadia has no 100 m model and
keeps its stage-1 terrain.

Outputs:
  analysis/cache/stage2/<lat>_<lon>.json   per-window indicators (not in git)
  data/screening/stage2.v2.json            all windows + target 100 m terrain (committed)

Run:  uv run python -m solmate.pipeline.refine --top 60
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
from importlib import resources
from pathlib import Path

import yaml

from solmate.compute import terrain
from solmate.io import aster_gdem

ANALYSIS = Path(__file__).resolve().parents[3]
SCREEN = ANALYSIS.parent / "data" / "screening" / "screening.v2.json"
CACHE = ANALYSIS / "cache" / "stage2"
OUT = ANALYSIS.parent / "data" / "screening" / "stage2.v2.json"
SIZE_M, CELL_M = 20_000.0, 100.0
KEEP = ("slope_median", "slope_p90", "local_relief", "ruggedness", "hypsometric_integral", "valid_fraction")


def _key(lat: float, lon: float) -> str:
    return f"{lat:.3f}_{lon:.3f}"


def candidate_windows(top: int) -> dict[str, dict]:
    screen = json.loads(SCREEN.read_text(encoding="utf-8"))["targets"]
    with resources.files("solmate.config").joinpath("validation_sites.yaml").open(encoding="utf-8") as f:
        labels = yaml.safe_load(f)
    wins: dict[str, dict] = {}
    for tid, t in screen.items():
        for e in t["top"][:top] + t["novel_leads"]:
            wins.setdefault(_key(e["lat"], e["lon"]), {"lat": e["lat"], "lon": e["lon"], "why": set()})["why"].add(tid)
    for s in labels["positives"]["mars"] + labels["positives"]["moon"] + labels["controls"]:
        wins.setdefault(_key(s["lat"], s["lon"]), {"lat": s["lat"], "lon": s["lon"], "why": set()})["why"].add(s["id"])
    return wins


def target_terrain() -> dict[str, dict]:
    sys.path.insert(0, str(ANALYSIS))
    import fetch  # v1 LOLA / CTX readers
    from solmate.targets import load_targets

    out = {}
    for t in load_targets():
        c = t["centroid"]
        if t["body"] == "moon":
            z, _ = fetch.moon_window(c["lat"], c["lon"], SIZE_M, CELL_M)
            src = "LRO LOLA LDEM_80S_20MPP_ADJ, 100 m area average"
        elif t["id"] == "jezero_crater":
            z, _ = fetch.mars_window(c["lat"], c["lon"], SIZE_M, CELL_M)
            src = "Mars 2020 CTX DTM (USGS), 100 m area average"
        else:
            continue  # no 100 m terrain model for this target
        ind = terrain.compute_indicators(z, CELL_M).as_dict()
        out[t["id"]] = {k: round(ind[k], 4) for k in KEEP} | {"source": src}
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, default=60, help="top-N stage-1 cells per target to refine")
    args = ap.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    wins = candidate_windows(args.top)
    token = aster_gdem.earthdata_token()
    todo = [k for k in wins if not (CACHE / f"{k}.json").exists()]
    print(f"{len(wins)} windows, {len(todo)} to read", flush=True)
    failed = []
    for n, k in enumerate(todo, 1):
        w = wins[k]
        t0 = time.time()
        try:
            z, meta = aster_gdem.read_window(w["lat"], w["lon"], SIZE_M, CELL_M, token)
        except aster_gdem.TileReadError as exc:
            failed.append(k)
            print(f"[{n}/{len(todo)}] {k} FAILED ({exc}); will retry next run", flush=True)
            continue
        ind = terrain.compute_indicators(z, CELL_M).as_dict() if float((z == z).mean()) > 0.5 else None
        rec = {"lat": w["lat"], "lon": w["lon"], "tiles": meta["tiles"],
               "indicators": None if ind is None else {k2: round(ind[k2], 4) for k2 in KEEP}}
        (CACHE / f"{k}.json").write_text(json.dumps(rec), encoding="utf-8")
        print(f"[{n}/{len(todo)}] {k} {time.time() - t0:.1f}s", flush=True)
    windows = []
    for k, w in sorted(wins.items()):
        p = CACHE / f"{k}.json"
        if p.exists():
            rec = json.loads(p.read_text(encoding="utf-8"))
            rec["why"] = sorted(w["why"])
            windows.append(rec)
    doc = {"version": 2, "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
           "window": {"size_m": SIZE_M, "cell_m": CELL_M, "source": "ASTER GDEM v3 (ASTGTM.003), NASA LP DAAC"},
           "top_per_target": args.top, "failed": failed, "targets": target_terrain(), "windows": windows}
    OUT.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {len(windows)} windows ({len(failed)} failed) to {OUT}", flush=True)


if __name__ == "__main__":
    main()
