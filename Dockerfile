# SolMate terrain API (Cloud Run). Build context = repository root so the shared
# `solmate` science package is installed from source, exactly as tested in CI.
# Deployed with: gcloud run deploy solmate-terrain --source . --region us-west1
FROM python:3.11-slim-bookworm AS build
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONDONTWRITEBYTECODE=1
RUN pip install --no-cache-dir uv==0.11.7
WORKDIR /srv
COPY analysis/pyproject.toml analysis/uv.lock analysis/README.md ./analysis/
COPY analysis/src ./analysis/src
COPY api/pyproject.toml api/uv.lock ./api/
RUN cd api && uv sync --locked --no-dev --no-install-project
COPY api/app ./api/app

FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/srv/api/.venv/bin:$PATH" SOLMATE_DATA=/srv/data
# rasterio's bundled GDAL links against libexpat, which the slim base image lacks.
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1     && rm -rf /var/lib/apt/lists/*     && useradd --system --uid 10001 --home-dir /srv solmate
WORKDIR /srv
COPY --from=build /srv /srv
# Only the model data the API reads (no raw NASA files, no secrets).
COPY data/screening/stage2.v2.json data/screening/stage2_stats.v2.json ./data/screening/
COPY data/stack/astgtm_tiles.v3.json ./data/stack/
COPY data/targets ./data/targets
USER solmate
WORKDIR /srv/api
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
