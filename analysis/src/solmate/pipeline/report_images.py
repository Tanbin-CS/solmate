"""Save the findings report's case-study pictures as small site files.

Each case study shows a 20 km window of NASA/USGS Landsat WELD 1990 true colour and of
NASA/METI ASTER GDEM shaded relief around its best novel lead. The report used to link
NASA GIBS WMS GetMap URLs, which GIBS renders on demand and which often took 10 to 90
seconds, so the pictures came up empty on GitHub and on the Findings page. This step
stitches the same layers from the pre-cut GIBS WMTS tiles (web Mercator, the tiles the
web app uses, see frontend/src/lib/gibs.ts) and writes frontend/public/data/report/*.webp,
which report.py links. Context only: never scored.

Run once after the screening changes, then run report.py:
    uv run python -m solmate.pipeline.report_images
"""

from __future__ import annotations

import io
import math
import time
import urllib.request

from PIL import Image

from solmate.pipeline import report

OUT = report.REPO / "frontend" / "public" / "data" / "report"
BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
LAYER = {"imagery": "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/1990-12-01",
         "relief": "ASTER_GDEM_Greyscale_Shaded_Relief/default"}
EARTH_KM = 40075.017
MAX_ZOOM = 12
PX = 512
KM = 20


def tile_window(lat: float, lon: float, km: float = KM, px: int = PX) -> tuple[int, float, float, float]:
    """Zoom, window left and top in tile units, and window width in tiles (same as gibs.ts)."""
    phi = math.radians(max(-85.05, min(85.05, lat)))
    z = max(0, min(MAX_ZOOM, math.ceil(math.log2(px * EARTH_KM * math.cos(phi) / (256 * km)))))
    n = 2**z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(phi) + 1 / math.cos(phi)) / math.pi) / 2 * n
    w = km * n / (EARTH_KM * math.cos(phi))
    return z, x - w / 2, y - w / 2, w


def _get(url: str) -> Image.Image:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "solmate-analysis/2.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGB")
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GIBS tile failed: {url}")


def window(lat: float, lon: float, kind: str) -> Image.Image:
    z, left, top, w = tile_window(lat, lon)
    n = 2**z
    tx0, ty0 = math.floor(left), math.floor(top)
    tx1, ty1 = math.ceil(left + w), math.ceil(top + w)
    canvas = Image.new("RGB", ((tx1 - tx0) * 256, (ty1 - ty0) * 256))
    for ty in range(max(ty0, 0), min(ty1, n)):
        for tx in range(tx0, tx1):
            url = f"{BASE}/{LAYER[kind]}/GoogleMapsCompatible_Level{MAX_ZOOM}/{z}/{ty}/{tx % n}.jpg"
            canvas.paste(_get(url), ((tx - tx0) * 256, (ty - ty0) * 256))
    box = tuple(round(v * 256) for v in (left - tx0, top - ty0, left - tx0 + w, top - ty0 + w))
    return canvas.crop(box).resize((PX, PX), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for tid, _world, c in report.case_leads(report.load()):
        for kind in LAYER:
            path = report.REPO / "frontend" / "public" / report.image(tid, kind)
            window(c["lat"], c["lon"], kind).save(path, "WEBP", quality=80, method=6)
            print(f"{path.relative_to(report.REPO)}: {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
