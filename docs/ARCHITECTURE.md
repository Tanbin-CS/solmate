# SolMate v2: architecture

Version 2.0, 6 Nov 2026: the system as deployed. Version 1.0 (31 Oct) was the design; section 8 lists where the build differs from it.
Decisions are recorded in [adr/](adr/). Requirements are in the [PRD](PRD.md).

## 1. Context

```
            ┌──────────────────────────── NASA open data ────────────────────────────┐
            │ Earthdata Cloud (LP DAAC, NSIDC, GES DISC) · POWER Zarr on AWS · PGDA   │
            │ LOLA / Diviner · USGS / PDS CTX and MOLA · GIBS imagery tiles           │
            └──────────────┬──────────────────────────────────────┬──────────────────┘
       offline pipeline    │ (build time, sha256 manifest)   live │ windowed COG reads
                           ▼                                       ▼ (ASTER GDEM only)
 Judge / planner ──▶ Firebase Hosting (CDN) ───/api/v1/*───▶ Cloud Run `solmate-terrain`
 / public browser    static app, precomputed results,        FastAPI, same compute core,
                     tiles, scoring Web Worker               App Check + rate limit
                                                                   │
                                                                   └──▶ Firestore `aoi_cache` (server only)
```

The browser does almost all the work: it scores any place on Earth from precomputed NASA tiles. The API exists only because 100 m terrain for an arbitrary box needs a server-side read of NASA ASTER GDEM.

## 2. Containers

| Container | Tech | Responsibility | Talks to |
|---|---|---|---|
| **Science pipeline** (`analysis/src/solmate/pipeline/`) | Python 3.11 (uv), numpy, rasterio, xarray | Download NASA inputs with a sha256 manifest; build the global 0.1° stack; target values; stage-1 and stage-2 screening; validation; export results, tiles, report, golden files and the Twin Drive 3D blocks. `release.py` runs the whole chain and both test suites | NASA archives (build time only), GCS mirror |
| **Compute core** (`analysis/src/solmate/compute/`) | Pure Python, no I/O, no network, no LLM | Terrain features, scoring modes, dimension aggregation and coverage, SAI, breaks-down, process tags, novelty, learned weights | Imported by the pipeline and the API; mirrored in TypeScript |
| **Web app** (`frontend/`) | React 19, Vite, TypeScript, Tailwind, MapLibre, react-three-fiber, zod | Home, Explorer, Findings, Method, Data and Learn pages. A Web Worker scores any point or box from the tiles with the TypeScript mirror of the compute core. Twin Drive renders the 3D blocks. Error boundaries keep a failed page or 3D view contained | Hosting (static files), `/api/v1` |
| **Terrain API** (`api/`) | FastAPI on Cloud Run (us-west1), min 0 / max 2 instances | `POST /terrain`: 100 m ASTER GDEM terrain indicators and score for a box against a target; `GET /health` (also the warm-up ping), `GET /version` (git sha, model version) | LP DAAC ASTER GDEM COGs (Earthdata token from Secret Manager); Firestore `aoi_cache` |
| **Data stores** | GCS `solmate-13571-data`, Firestore (us-west1), Secret Manager | Raw input mirror; web tile sets stored under their content hash; API result cache with a TTL; the Earthdata token | API service account only; Firestore rules deny all client access |
| **CI/CD** | GitHub Actions, Workload Identity Federation | Pull request gates; deploy on merge to `main`; one-click rollback | GCP through a keyless deployer service account |

## 3. Key flows

**Score any place**
1. The user clicks the map, searches a place or draws a box.
2. The worker loads the tiles under it (10° × 10°, gzipped uint16, cached) and computes every dimension, the SAI, coverage and breaks-down in the browser.
3. Screening leaders already carry their stage-2 100 m terrain. For any other place the user can ask for it: the web calls `POST /api/v1/terrain` with an App Check token.
4. The API validates the request, looks up `aoi_cache` by (place, box size, model version), and on a miss reads a 100 m window from the ASTER GDEM COGs, runs `compute.terrain100`, caches and returns the result.

**Global screen (build time)**
- Stage 1: every land cell at 0.1° on all coarse dimensions.
- Stage 2: the leaders per target, at least 50 km apart, get 100 m ASTER GDEM terrain; `rescore` folds it into their SAI.
- Novelty: distance to the 31 known analog sites; more than 300 km makes a *novel lead*.
- Exports: `screening/<target>.json`, `model.json` (dimensions, presets, Earth statistics, model version), `targets.json`, `validation.json`, `report.json`, provenance, tiles, Twin Drive blocks.

**Twin Drive**
- The pipeline bakes 20 km × 100 m terrain blocks (gzipped uint16) for the top 25 and novel 25 places of each target and for each target region.
- The browser renders the Earth and target blocks side by side at the same scale and drives one NASA rover model over both; slope, wheel load and sun angle come from the same terrain.

## 4. Data model (summary)
- `model.json`: dimensions and indicators, scoring modes, weight presets (equal, expert, mission ops, lunar ops, learned per body), Earth statistics, known analogs, tile layout and tileset hash, `model_version`.
- `targets.json`: per target `{id, body, centroid, indicators{value, unit, method (computed | derived | literature), source, uncertainty}, breaks_down}`.
- `screening/<target>.json`: top places, novel leads and dimension leaders `{lat, lon, sai, dims{}, coverage, nearest_known, nearest_known_km, terrain_100m}`.
- `validation.json`: AUC with bootstrap CIs, land percentiles, ablation, random-weight ranges, learned weights with cross-validated AUC.
- Firestore `aoi_cache/{key}`: `{model_version, indicators, terrain_score, expireAt}`.

`model_version` is a hash of every setting behind a score. The web and the API must report the same one; the deploy checks it.

## 5. Security (detail in [ADR 0008](adr/0008-security-baseline.md) and [SECURITY.md](../SECURITY.md))
- App Check and a per-client rate limit on the API; strict request validation (pydantic on the API, zod on the web).
- Firestore rules deny every client read and write; only the API's service account uses it.
- No secrets in the repository or the bundle; gitleaks in pre-commit hooks and CI.
- Least-privilege service accounts and keyless deploys through Workload Identity Federation.
- Strict Content Security Policy and HSTS from Hosting; actions pinned to commit SHAs; CodeQL, Semgrep, dependency audits and licence checks in CI.

## 6. Scalability and cost
- The CDN and in-browser scoring carry nearly all traffic at no compute cost.
- Cloud Run scales from 0 to 2 instances; the cache absorbs repeat requests.
- Expected cost stays under $2 a month, with a $5 budget alert.

## 7. Deployment and rollback ([RUNBOOK.md](RUNBOOK.md))
- Every pull request runs the required checks: commit messages, secrets, web (lint, types, tests including Python/TypeScript parity and real-tile tests, build), science and API tests, CodeQL, Semgrep, dependency audits and licences.
- Merge to `main` runs `deploy.yml`:
  1. When API code or its data changed, Cloud Run builds a revision without traffic (tag `candidate`), smoke-tests it (health, version, App Check refuses a request without a token), then moves all traffic to it.
  2. The web job restores the tile set named in `model.json` from GCS, builds, deploys Hosting and the Firestore rules.
  3. A production smoke test checks every page, data, tiles, API health, security headers, and that web and API report the same `model_version`.
- `rollback.yml` returns the API, the web or both to the newest older build that a successful deploy shipped, then checks that web and API still agree.

## 8. Changes from the 31 Oct design
- **Not built:** community nominations with a review queue, the mission dossier PDF, Hosting preview channels per pull request, and the PMTiles offline basemap. Firestore therefore holds only the API cache.
- **Added:** Twin Drive (3D rover comparison), the Learn page for students, process tags, the region-weighted validation check, and the tile fixture that runs the real-tile tests in CI.
- **Changed:** the web reads gzipped uint16 tiles instead of WebP grids; the rc-channel approval step became an automatic candidate-revision smoke test; Learned weights ship as a preset, with equal weights as the default.
