"""ASTER GDEM v3 (ASTGTM.003, NASA/METI) windows from NASA Earthdata Cloud.

Tiles are 1 x 1 degree Cloud Optimized GeoTIFFs at 1 arc-second served by LP DAAC. Reads
are windowed range requests authenticated with an Earthdata Login bearer token.

Security: the token is passed to GDAL only through config options, never logged, never
placed in a URL, and any read error is re-raised without its message (GDAL and HTTP
errors can echo request headers).

Ocean vs. failure: tiles absent from the ASTGTM tile index (data/stack/astgtm_tiles.v3.json,
built from NASA CMR) are ocean and yield NaN. A listed tile that fails to read raises
TileReadError, so a network problem is never mistaken for, or cached as, ocean.
"""

from __future__ import annotations

import json
import math
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject

INDEX = Path(__file__).resolve().parents[4] / "data" / "stack" / "astgtm_tiles.v3.json"
BASE = "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/ASTGTM.003"


class TileReadError(RuntimeError):
    """A listed ASTER GDEM tile could not be read (network/auth). Message never includes secrets."""


@lru_cache(maxsize=1)
def tile_index(path: Path = INDEX) -> frozenset[str]:
    return frozenset(json.loads(path.read_text(encoding="utf-8"))["tiles"])


def tile_code(lat_floor: int, lon_floor: int) -> str:
    return f"{'N' if lat_floor >= 0 else 'S'}{abs(lat_floor):02d}{'E' if lon_floor >= 0 else 'W'}{abs(lon_floor):03d}"


def tiles_for(lat: float, lon: float, half_m: float) -> list[str]:
    dlat = half_m / 111_320 * 1.2
    dlon = dlat / max(math.cos(math.radians(lat)), 0.05)
    codes = {tile_code(la, ((lo + 180) % 360) - 180)
             for la in range(math.floor(lat - dlat), math.floor(lat + dlat) + 1)
             for lo in range(math.floor(lon - dlon), math.floor(lon + dlon) + 1)}
    return sorted(codes)


def gdal_env(token: str, cookie_dir: Path | None = None) -> dict[str, str]:
    jar = str((cookie_dir or Path.home()) / ".solmate_edl_cookies")
    return {
        "GDAL_HTTP_AUTH": "BEARER", "GDAL_HTTP_BEARER": token.strip(),
        "CPL_VSIL_CURL_USE_HEAD": "NO",  # signed CloudFront redirects reject HEAD
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
        "GDAL_HTTP_COOKIEFILE": jar, "GDAL_HTTP_COOKIEJAR": jar,
        "GDAL_HTTP_MAX_RETRY": "4", "GDAL_HTTP_RETRY_DELAY": "2", "VSI_CACHE": "TRUE",
        "GDAL_HTTP_MULTIRANGE": "YES", "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    }


def tile_url(code: str, local_dir: Path | None = None) -> str:
    name = f"ASTGTMV003_{code}_dem.tif"
    if local_dir is not None and (local_dir / name).exists():
        return str(local_dir / name)
    return f"/vsicurl/{BASE}/{name}"


def read_window(lat: float, lon: float, size_m: float, cell: float, token: str,
                local_dir: Path | None = None) -> tuple[np.ndarray, dict]:
    """Elevation (m) on an n x n local azimuthal-equidistant grid centred on (lat, lon).

    Area-average resampling from 1 arc-second; NaN where there is no land tile.
    """
    n = int(round(size_m / cell))
    transform = Affine(cell, 0, -size_m / 2, 0, -cell, size_m / 2)
    dst_crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs")
    out = np.full((n, n), np.nan, dtype=np.float32)
    index = tile_index()
    used, ocean = [], []
    with rasterio.Env(**gdal_env(token)):
        for code in tiles_for(lat, lon, size_m / 2):
            if code not in index:
                ocean.append(code)
                continue
            try:
                with rasterio.open(tile_url(code, local_dir)) as src:
                    part = np.full((n, n), np.nan, dtype=np.float32)
                    reproject(source=rasterio.band(src, 1), destination=part,
                              src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
                              dst_transform=transform, dst_crs=dst_crs, dst_nodata=np.nan,
                              resampling=Resampling.average)
            except Exception:  # noqa: BLE001 - re-raised without the message, which may contain headers
                raise TileReadError(f"could not read ASTER GDEM tile {code}") from None
            fill = np.isnan(out) & np.isfinite(part)
            out[fill] = part[fill]
            used.append(code)
    return out, {"tiles": used, "ocean_tiles": ocean, "source": "ASTER GDEM v3 (ASTGTM.003), NASA LP DAAC"}


def earthdata_token() -> str:
    """Token from EARTHDATA_TOKEN or Secret Manager; stripped, never printed."""
    token = os.environ.get("EARTHDATA_TOKEN", "").strip()
    if token:
        return token
    import subprocess

    gcloud = "gcloud.cmd" if os.name == "nt" else "gcloud"
    out = subprocess.run([gcloud, "secrets", "versions", "access", "latest", "--secret=edl-token",
                          "--project=solmate-13571", "--quiet"], capture_output=True, text=True, timeout=90, check=False)
    token = out.stdout.strip()
    if not token:
        raise RuntimeError("no Earthdata token available")
    return token
