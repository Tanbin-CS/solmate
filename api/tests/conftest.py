import json

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

QUANT = list(np.linspace(0.0, 40.0, 101))


@pytest.fixture()
def api(tmp_path, monkeypatch):
    """App wired to a temp data dir and one local synthetic ASTER tile; no network."""
    (tmp_path / "data" / "screening").mkdir(parents=True)
    (tmp_path / "data" / "screening" / "stage2.v2.json").write_text(json.dumps({"targets": {
        "jezero_crater": {"slope_median": 1.0, "slope_p90": 4.0, "hypsometric_integral": 0.5}}}))
    stats = {"median": 5.0, "sigma": 3.0, "quantiles": QUANT}
    (tmp_path / "data" / "screening" / "stage2_stats.v2.json").write_text(json.dumps({"indicators": {
        k: stats for k in ("slope_median", "slope_p90", "hypsometric_integral")}}))
    tiles = tmp_path / "tiles"
    tiles.mkdir()
    yy, xx = np.mgrid[0:3601, 0:3601]
    z = (np.sin(xx / 200.0) * 50 + yy * 0.05).astype(np.float32)
    with rasterio.open(tiles / "ASTGTMV003_N36E084_dem.tif", "w", driver="GTiff", height=3601, width=3601, count=1,
                       dtype="float32", crs="EPSG:4326",
                       transform=from_origin(84 - 0.5 / 3600, 37 + 0.5 / 3600, 1 / 3600, 1 / 3600)) as d:
        d.write(z, 1)
    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setenv("SOLMATE_DATA", str(tmp_path / "data"))
    monkeypatch.setenv("SOLMATE_TILES", str(tiles))
    monkeypatch.setenv("RATE_PER_MINUTE", "5")
    from solmate.io import aster_gdem

    monkeypatch.setattr(aster_gdem, "tile_index", lambda: frozenset({"N36E084"}))
    from app import main

    for f in (main.get_settings, main.get_model, main.get_cache):
        f.cache_clear()
    main.limiter.per_minute = 5
    main.limiter._hits.clear()
    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        yield client
