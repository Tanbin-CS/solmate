"""Rebuild the Earth context thumbnails (*-imagery.webp) from NASA imagery.

The v1 prototype used Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0), whose non-commercial
terms break the Space Apps open-licence rule. Each Earth window's thumbnail is replaced
with the NASA/USGS Landsat WELD 1990 global annual true-colour composite from NASA GIBS
(cloud-free Landsat 5 TM). Where WELD has no data (Antarctica, some gaps) or only saturated
snow, the thumbnail is the NASA/METI ASTER GDEM greyscale shaded relief, also from GIBS.
Target thumbnails (Mars CTX, lunar Sun visibility) are NASA products already and are left
alone. Context only: never scored.

Run:  uv run python -m solmate.pipeline.quicklooks_landsat
"""

from __future__ import annotations

import io
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parents[4] / "frontend" / "public"
DATA = PUBLIC / "data"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
LANDSAT = ("Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual", "1990-12-01")
RELIEF = ("ASTER_GDEM_Greyscale_Shaded_Relief", None)
PX = 400


def _wms(layer: tuple[str, str | None], lat: float, lon: float, window_m: float) -> Image.Image:
    dlat = window_m / 2 / 111_320
    dlon = dlat / math.cos(math.radians(lat))
    q = {"SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": layer[0], "STYLES": "", "CRS": "EPSG:4326",
         "BBOX": f"{lat - dlat},{lon - dlon},{lat + dlat},{lon + dlon}", "WIDTH": PX * 2, "HEIGHT": PX * 2,
         "FORMAT": "image/jpeg"}
    if layer[1]:
        q["TIME"] = layer[1]
    url = f"{WMS}?{urllib.parse.urlencode(q)}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "solmate-analysis/2.0"}),
                                        timeout=60) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGB")
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GIBS request failed for {layer[0]} at {lat:.3f},{lon:.3f}")


def _unusable(img: Image.Image) -> bool:
    """True when the image is mostly no-data (WELD's black fill) or saturated snow/cloud."""
    small = img.convert("L").resize((64, 64))
    return sum(1 for v in small.getdata() if v < 8 or v > 250) > 0.5 * 64 * 64


def thumbnail(lat: float, lon: float, window_m: float) -> tuple[Image.Image, str]:
    img = _wms(LANDSAT, lat, lon, window_m)
    if not _unusable(img):
        return img, "landsat-weld-1990"
    return _wms(RELIEF, lat, lon, window_m), "aster-gdem-relief"


def earth_windows() -> dict[str, tuple[float, float, float]]:
    """Every Earth window with an imagery thumbnail: id -> (lat, lon, window_m)."""
    out: dict[str, tuple[float, float, float]] = {}
    for f in sorted(DATA.glob("indicators.*.v1.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        window = float(doc.get("config", {}).get("window_m", 20_000) if isinstance(doc.get("config"), dict) else 20_000)
        for s in doc["sites"]:
            if s.get("quicklooks", {}).get("imagery"):
                out[s["quicklooks"]["imagery"]] = (s["lat"], s["lon"], window)
    screen = json.loads((DATA / "screening.v1.json").read_text(encoding="utf-8"))
    for w in screen["windows"]:
        path = w.get("quicklooks", {}).get("imagery")
        if path:
            out[path] = (w["lat"], w["lon"], float(screen["window_m"]))
    return out


def main() -> None:
    sources: dict[str, int] = {}
    for path, (lat, lon, window) in sorted(earth_windows().items()):
        img, src = thumbnail(lat, lon, window)
        img.resize((PX, PX), Image.LANCZOS).save(PUBLIC / path, quality=84)
        sources[src] = sources.get(src, 0) + 1
        print(f"{path}: {src}", flush=True)
    print(sources)


if __name__ == "__main__":
    main()
