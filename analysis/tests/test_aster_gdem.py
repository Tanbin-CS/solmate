"""Offline tests for the ASTER GDEM reader: tile naming, ocean handling, secret safety."""

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from solmate.io import aster_gdem as ag

SECRET = "eyJ-test-secret-token"  # noqa: S105 - fake value used to prove it never leaks


def test_tile_code_and_window_tiles():
    assert ag.tile_code(36, 84) == "N36E084"
    assert ag.tile_code(-1, -70) == "S01W070"
    assert ag.tiles_for(36.5, 84.5, 10_000) == ["N36E084"]
    assert set(ag.tiles_for(36.95, 84.95, 20_000)) == {"N36E084", "N36E085", "N37E084", "N37E085"}
    assert "N10W180" in ag.tiles_for(10.5, 179.95, 20_000)  # wraps the antimeridian


def test_gdal_env_strips_token_and_avoids_head():
    env = ag.gdal_env(SECRET + "\r\n")
    assert env["GDAL_HTTP_BEARER"] == SECRET and env["CPL_VSIL_CURL_USE_HEAD"] == "NO"


def test_ocean_tiles_give_nan_without_network(monkeypatch):
    monkeypatch.setattr(ag, "tile_index", lambda: frozenset())
    z, meta = ag.read_window(0.0, -30.0, 2_000, 100, SECRET)
    assert np.isnan(z).all() and meta["tiles"] == [] and meta["ocean_tiles"]


def test_listed_tile_failure_raises_without_secret(monkeypatch):
    monkeypatch.setattr(ag, "tile_index", lambda: frozenset({"N36E084"}))
    monkeypatch.setattr(ag, "tile_url", lambda code, local_dir=None: f"/vsicurl/https://invalid.example/{SECRET}.tif")
    with pytest.raises(ag.TileReadError) as exc:
        ag.read_window(36.5, 84.5, 2_000, 100, SECRET)
    assert SECRET not in str(exc.value) and exc.value.__cause__ is None


def test_local_tile_window(monkeypatch, tmp_path):
    z = np.arange(3601 * 3601, dtype=np.float32).reshape(3601, 3601) % 1000
    path = tmp_path / "ASTGTMV003_N36E084_dem.tif"
    with rasterio.open(path, "w", driver="GTiff", height=3601, width=3601, count=1, dtype="float32",
                       crs="EPSG:4326", transform=from_origin(84 - 0.5 / 3600, 37 + 0.5 / 3600, 1 / 3600, 1 / 3600)) as d:
        d.write(z, 1)
    monkeypatch.setattr(ag, "tile_index", lambda: frozenset({"N36E084"}))
    out, meta = ag.read_window(36.5, 84.5, 5_000, 100, SECRET, local_dir=tmp_path)
    assert out.shape == (50, 50) and np.isfinite(out).all() and meta["tiles"] == ["N36E084"]
