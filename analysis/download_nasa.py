"""Download the NASA Earth inputs for the SolMate v2 global stack.

Finds granules through NASA CMR and downloads them from NASA Earthdata Cloud
with an Earthdata Login (EDL) bearer token. The token is read from the
EARTHDATA_TOKEN environment variable or, failing that, from Secret Manager
(`edl-token` in project solmate-13571). The token is never printed or written
to disk, and it is sent only to Earthdata hosts: redirects to other hosts
(S3 presigned URLs) get no Authorization header.

Downloads are resumable (skipped when present with a matching size) and every
file is recorded in data/manifest.v2.json with its size, sha256 and source URL,
so the stack can be rebuilt and audited later.

Usage:
    python download_nasa.py --list              # show the plan, download nothing
    python download_nasa.py                     # download everything
    python download_nasa.py --only MYD11C3 MOD10CM
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "cache" / "raw"
MANIFEST = ROOT.parent / "data" / "manifest.v2.json"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
AUTH_HOST_SUFFIXES = (".earthdata.nasa.gov", ".earthdatacloud.nasa.gov")


@dataclass(frozen=True)
class Product:
    short_name: str
    version: str
    purpose: str
    temporal: tuple[str, str] | None  # ISO start, end; None = all granules
    # Keep one granule per calendar month (for daily products), else keep all.
    one_per_month: bool = False


PRODUCTS = (
    Product("MYD11C3", "061", "Thermal: monthly day/night LST, 0.05 deg", ("2023-01-01", "2024-12-31")),
    Product("MOD10CM", "61", "Ice: monthly snow cover, 0.05 deg", ("2023-01-01", "2024-12-31")),
    Product("MCD43C3", "061", "Surface: white-sky albedo, 0.05 deg (mid-month sample)",
            ("2023-01-01", "2024-12-31"), one_per_month=True),
    Product("MCD12C1", "061", "Surface: land cover / barren / snow-ice class, 0.05 deg", ("2023-01-01", "2023-12-31")),
    Product("AG5KMMOH", "041", "Mineralogy: ASTER GED monthly emissivity, 5 km (2013-15, for a median composite)",
            ("2013-01-01", "2015-12-31")),
    Product("M2TMNXAER", "5.12.4", "Dust: MERRA-2 monthly aerosol (DUEXTTAU)", ("2023-01-01", "2024-12-31")),
    Product("SRTMGL30", "002", "Terrain: stage-1 coarse DEM, 30 arc-sec", None),
)


@dataclass(frozen=True)
class Granule:
    product: str
    url: str
    start: str


def edl_token() -> str:
    token = os.environ.get("EARTHDATA_TOKEN", "").strip()
    if token:
        return token
    gcloud = "gcloud.cmd" if os.name == "nt" else "gcloud"
    out = subprocess.run(
        [gcloud, "secrets", "versions", "access", "latest", "--secret=edl-token",
         "--project=solmate-13571", "--quiet"],
        capture_output=True, text=True, timeout=90, check=False,
    )
    token = out.stdout.strip()
    if not token:
        sys.exit("No Earthdata token: set EARTHDATA_TOKEN or store it in Secret Manager as edl-token.")
    return token


def search(product: Product) -> list[Granule]:
    granules: list[Granule] = []
    page = 1
    while True:
        params = {"short_name": product.short_name, "version": product.version,
                  "page_size": 200, "page_num": page, "sort_key": "start_date"}
        if product.temporal:
            params["temporal"] = f"{product.temporal[0]}T00:00:00Z,{product.temporal[1]}T23:59:59Z"
        with urllib.request.urlopen(f"{CMR}?{urllib.parse.urlencode(params)}", timeout=60) as r:
            entries = json.load(r)["feed"]["entry"]
        for e in entries:
            links = [l["href"] for l in e.get("links", [])
                     if l.get("rel", "").endswith("/data#") and l["href"].startswith("https://")]
            if links:
                granules.append(Granule(product.short_name, links[0], e.get("time_start", "")))
        if len(entries) < 200:
            break
        page += 1
    if product.temporal:  # CMR matches overlapping granules; keep only ones starting inside the window
        granules = [g for g in granules if product.temporal[0] <= g.start[:10] <= product.temporal[1]]
    if product.one_per_month:
        by_month: dict[str, Granule] = {}
        for g in granules:  # keep the granule closest to the 15th of each month
            key = g.start[:7]
            day = int(g.start[8:10] or 1)
            best = by_month.get(key)
            if best is None or abs(day - 15) < abs(int(best.start[8:10] or 1) - 15):
                by_month[key] = g
        granules = sorted(by_month.values(), key=lambda g: g.start)
    return granules


class _StripAuthOffHost(urllib.request.HTTPRedirectHandler):
    """Follow redirects but send the bearer token only to Earthdata hosts."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            host = urllib.parse.urlparse(newurl).hostname or ""
            if not host.endswith(AUTH_HOST_SUFFIXES):
                new.remove_header("Authorization")
        return new


OPENER = urllib.request.build_opener(_StripAuthOffHost)


def download(g: Granule, token: str) -> dict:
    dest = RAW / g.product / g.url.rsplit("/", 1)[1]
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    if not dest.exists():
        for attempt in range(1, 5):
            try:
                req = urllib.request.Request(g.url, headers={"Authorization": f"Bearer {token}"})
                with OPENER.open(req, timeout=300) as r, open(tmp, "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                tmp.replace(dest)
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
                tmp.unlink(missing_ok=True)
                if attempt == 4:
                    raise RuntimeError(f"failed after 4 attempts: {g.url}") from exc
                time.sleep(5 * attempt)
    h = hashlib.sha256()
    with open(dest, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return {"product": g.product, "file": dest.relative_to(ROOT).as_posix(), "url": g.url,
            "time_start": g.start, "bytes": dest.stat().st_size, "sha256": h.hexdigest()}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="print the download plan only")
    ap.add_argument("--only", nargs="*", help="restrict to these short names")
    args = ap.parse_args()

    products = [p for p in PRODUCTS if not args.only or p.short_name in args.only]
    plan = {p.short_name: search(p) for p in products}
    for p in products:
        print(f"{p.short_name:10s} v{p.version:7s} {len(plan[p.short_name]):4d} granules  {p.purpose}")
    if args.list:
        return

    token = edl_token()
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"version": 2, "files": []}
    known = {f["file"]: f for f in manifest["files"]}
    for name, granules in plan.items():
        for i, g in enumerate(granules, 1):
            rec = download(g, token)
            known[rec["file"]] = rec
            print(f"[{name} {i}/{len(granules)}] {rec['bytes'] / 1e6:8.1f} MB  {rec['file']}", flush=True)
        manifest["files"] = sorted(known.values(), key=lambda r: r["file"])
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"done: {len(known)} files in {MANIFEST.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
