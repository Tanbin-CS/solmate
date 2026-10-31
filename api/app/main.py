"""SolMate terrain API (Cloud Run): 100 m NASA ASTER GDEM terrain for any box on Earth.

Endpoints (all under /api/v1):
  GET  /health    liveness + warm-up ping (the web app calls it when the Explorer opens)
  GET  /version   git sha and model version
  POST /terrain   100 m terrain indicators and terrain score of a box against a target

The browser computes every other dimension itself from precomputed NASA grids; this
service exists only because 100 m terrain for an arbitrary box needs a server read.
"""

from __future__ import annotations

import concurrent.futures as cf
import hashlib
import json
import logging
import math
import time
from contextlib import asynccontextmanager
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from solmate.compute import modes, terrain, terrain100
from solmate.io import aster_gdem

from app.cache import Cache, FirestoreCache, MemoryCache, cache_key
from app.models import TerrainRequest, TerrainResponse
from app.security import RateLimiter, client_key, verify_app_check
from app.settings import Settings

log = logging.getLogger("solmate.api")
CELL_M = 100.0


class Model:
    """Target 100 m terrain values and Earth statistics, loaded once per instance."""

    def __init__(self, settings: Settings) -> None:
        stage2 = json.loads((settings.data_dir / "screening" / "stage2.v2.json").read_text(encoding="utf-8"))
        stats_doc = json.loads((settings.data_dir / "screening" / "stage2_stats.v2.json").read_text(encoding="utf-8"))
        self.targets: dict[str, dict] = stage2["targets"]  # targets with 100 m terrain (Moon, Jezero)
        from solmate.targets import load_targets

        self.known = {t["id"] for t in load_targets()}  # all 11 targets
        self.stats = {k: modes.EarthStats(tuple(v["quantiles"]), v["median"], v["sigma"])
                      for k, v in stats_doc["indicators"].items()}
        digest = hashlib.sha256()
        for doc in (stage2["targets"], stats_doc["indicators"]):
            digest.update(json.dumps(doc, sort_keys=True).encode())
        self.version = digest.hexdigest()[:12]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def get_model() -> Model:
    return Model(get_settings())


@lru_cache(maxsize=1)
def get_cache() -> Cache:
    s = get_settings()
    if s.offline:
        return MemoryCache()
    try:
        return FirestoreCache(s.project_id)
    except Exception:  # noqa: BLE001 - local runs without Google credentials fall back to memory
        log.warning("Firestore unavailable; using in-memory cache")
        return MemoryCache()


limiter = RateLimiter(get_settings().rate_per_minute)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_model()  # fail fast at start-up if model files are missing
    app.state.pool = cf.ThreadPoolExecutor(max_workers=4)
    yield
    app.state.pool.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="SolMate terrain API", version="2.0.0", lifespan=lifespan,
              docs_url="/api/v1/docs", openapi_url="/api/v1/openapi.json", redoc_url=None)


@app.exception_handler(Exception)
async def generic_error(request: Request, exc: Exception) -> JSONResponse:  # noqa: ARG001
    log.exception("unhandled error")  # details stay in server logs only
    return JSONResponse(status_code=500, content={"detail": "internal error"})


def guard(request: Request, settings: Settings = Depends(get_settings)) -> None:  # noqa: B008
    verify_app_check(request, settings.require_app_check and not settings.offline)
    limiter.check(client_key(request))


@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/v1/version")
def version(settings: Settings = Depends(get_settings), model: Model = Depends(get_model)) -> dict:  # noqa: B008
    return {"git_sha": settings.git_sha, "model_version": model.version, "offline": settings.offline}


def _read_indicators(req: TerrainRequest, settings: Settings) -> dict[str, float]:
    token = "" if settings.local_tiles else aster_gdem.earthdata_token()
    z, _ = aster_gdem.read_window(req.lat, req.lon, req.size_km * 1000, CELL_M, token, settings.local_tiles)
    if float((z == z).mean()) < 0.5:  # mostly ocean / no data
        return {}
    return {k: float(v) for k, v in terrain.compute_indicators(z, CELL_M).as_dict().items()}


@app.post("/api/v1/terrain", response_model=TerrainResponse, dependencies=[Depends(guard)])
def terrain_endpoint(req: TerrainRequest, request: Request, settings: Settings = Depends(get_settings),  # noqa: B008
                     model: Model = Depends(get_model), cache: Cache = Depends(get_cache)) -> TerrainResponse:  # noqa: B008
    t0 = time.perf_counter()
    target = model.targets.get(req.target_id)
    if req.target_id not in model.known:
        raise HTTPException(status_code=404, detail="unknown target")
    key = cache_key(req.lat, req.lon, req.size_km, model.version)
    indicators, cached, partial = cache.get(key), True, False
    t_cache = time.perf_counter()
    if indicators is None:
        cached = False
        if settings.offline and settings.local_tiles is None:
            indicators, partial = {}, True
        else:
            fut = request.app.state.pool.submit(_read_indicators, req, settings)
            try:
                indicators = fut.result(timeout=settings.read_budget_s)
                cache.put(key, indicators)
            except cf.TimeoutError:
                indicators, partial = {}, True
            except aster_gdem.TileReadError:
                indicators, partial = {}, True
    t_read = time.perf_counter()
    score, per = (terrain100.terrain_score(indicators, target, model.stats) if target else (float("nan"), {}))
    return TerrainResponse(
        model_version=model.version, target_id=req.target_id, lat=req.lat, lon=req.lon, size_km=req.size_km,
        indicators={k: (None if not math.isfinite(v) else round(v, 4)) for k, v in indicators.items()},
        similarity={k: round(v, 4) for k, v in per.items()},
        terrain_score=None if not math.isfinite(score) else round(score, 4),
        cached=cached, partial=partial or not indicators,
        source="ASTER GDEM v3 (ASTGTM.003), NASA LP DAAC; 100 m area average",
        timings_ms={"cache": int((t_cache - t0) * 1000), "read": int((t_read - t_cache) * 1000),
                    "total": int((time.perf_counter() - t0) * 1000)},
    )
