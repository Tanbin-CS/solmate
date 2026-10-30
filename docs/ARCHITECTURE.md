# SolMate v2: architecture

Version 1.0, 31 Oct 2026. Decisions are recorded in [adr/](adr/).
Requirements are in the [PRD](PRD.md).

## 1. Context

```
                       ┌──────────────────────── NASA open data ───────────────────────┐
                       │ Earthdata Cloud (LP DAAC, NSIDC, GES DISC) · POWER Zarr (S3)  │
                       │ PGDA LOLA · USGS/PDS CTX · GIBS tiles · CMR search            │
                       └──────────────┬───────────────────────────────┬────────────────┘
                     offline pipeline │ (build time)          live    │ windowed COG reads
                                      ▼                               ▼ (ASTER GDEM only)
 Judge / planner / public ──▶ Firebase Hosting (CDN) ──/api/v1/*──▶ Cloud Run `solmate-terrain`
        browser                static app + precomputed            FastAPI, deterministic compute
                               data + score worker                 Firestore aoi_cache, GCS DEM mirror
                                      │
                                      └──▶ Firestore (nominations, review queue)  [App Check]
```

## 2. Containers

| Container | Tech | Responsibility | Talks to |
|---|---|---|---|
| **Science pipeline** (`analysis/`) | Python 3.11, numpy/scipy, rasterio/GDAL, xarray/zarr | Download NASA inputs (manifest + sha256); build the global 0.1° stack; target vectors; stage-1/2 screening; validation; export versioned JSON/WebP grids and demo fixtures | NASA archives (build time only), GCS mirror |
| **Compute core** (`analysis/src/solmate/compute/`) | Pure Python, no I/O | Terrain features, modes, dimension aggregation, SAI, breaks-down, novelty, learned weights | Imported by the pipeline and the API; mirrored in TS |
| **Web app** (`frontend/`) | React 19, Vite, TypeScript, MapLibre, three.js, zod | Tour, Explorer, Findings, Method, Data pages; Web Worker computes the coarse SAI for any point from the grids; dossier PDF in the browser | Hosting (static files), `/api/v1`, Firestore (nominations) |
| **Terrain API** (`api/`) | FastAPI on Cloud Run (us-west1), 1 vCPU / 1 GiB, min 0 / max 2 | `/terrain`: 100 m ASTER GDEM terrain for a 10–40 km box; `/health`, `/version` | GCS DEM mirror → LP DAAC COGs (EDL token from Secret Manager); Firestore `aoi_cache` |
| **Data stores** | Firestore (us-west1), GCS `solmate-13571-data`, Secret Manager | Nominations, review, cache, feedback; raw input mirror and DEM tile cache; `edl-token` | Accessed by the API (service account) and the web (rules + App Check) |
| **CI/CD** | GitHub Actions, Workload Identity Federation | PR gates (commits, secrets, web, science, CodeQL, Semgrep, audits, licences); deploy rc → smoke → production | GCP via a keyless deployer service account |

## 3. Key flows

**Score any place (US-05)**
1. The user draws a box. The worker computes C, Th, S, M, I and D plus coarse
   terrain from the 0.1° grids, and shows the SAI in ≤ 100 ms.
2. The web calls `POST /api/v1/terrain {target_id, bbox}` with an App Check
   token. The `/health` ping fired when the Explorer opened has already woken
   the instance.
3. The API validates the request, then looks up `aoi_cache` by
   sha(bbox + model_version). On a hit it returns in about 150 ms.
4. On a miss, it reads a 20 km × 100 m window from the GCS mirror or LP DAAC
   COG and runs `compute.terrain`. It caches the result and returns it, with
   `partial: true` if over the 20 s budget.
5. The worker merges the refined terrain into the SAI, and the verdict card
   updates.

**Global screen (build time)**
- Stage 1: all land cells at 0.1°, on every coarse dimension. The top 400 per
  target after 50 km non-max suppression go to stage 2.
- Stage 2: 100 m terrain for those cells.
- Novelty: distance to known analogs.
- Exports: `screening.v2.json` plus 0.25° WebP dimension grids for the web.

**Offline mode (US-16)**
- `VITE_OFFLINE=1`: the web uses `demo_fixtures/` and skips the API.
- `OFFLINE=1`: the API reads only the local tile cache, and the App Check
  check is bypassed.
- PMTiles basemap. Zero network calls in the dry run.

## 4. Data model (summary)
- `targets.v2.json`: per target {id, body, group, centroid, indicators{value,
  unit, method, source, uncertainty}, breakdown constants}.
- `screening.v2.json`: top-N and novel leads per target {cell, lat, lon, SAI,
  dims{}, coverage, novelty_km, process_tags[]}.
- `validation.v2.json`: metrics with CIs, ablation, sensitivity, learned weights.
- Firestore `nominations/{id}`: {type, target_id, geometry, title, description,
  evidence_urls[], name?, status, auto_score, review{}, created_at}.
- Firestore `aoi_cache/{key}`: {model_version, indicators, s[], terrain_score, expireAt}.

## 5. Security (detail in SECURITY_MODEL.md, Sprint 4)
- App Check on the API and Firestore.
- Deny-by-default rules.
- pydantic and zod validation everywhere.
- No secrets client-side.
- Least-privilege service accounts and Workload Identity Federation.
- Strict CSP.
- Pinned actions and a security CI suite.

## 6. Scalability and cost
- Static CDN and browser compute carry nearly all traffic for free.
- Cloud Run scales from 0 to 2 instances.
- The cache absorbs repeat requests.
- Expected cost is ≤ $2/month, with a $5 budget alert.

## 7. Deployment
- Every PR gets a Firebase preview channel.
- Main → Cloud Run `--no-traffic --tag rc` + Hosting `rc` channel → smoke tests
  → `production` approval → traffic switch + Hosting live → smoke tests.
- Rollback: shift Cloud Run traffic back to the previous revision; roll back
  Hosting from its release history.
