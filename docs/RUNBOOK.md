# Runbook

How SolMate is deployed, watched and recovered. Production must stay up until global
judging ends (January 2027).

## Where things run
| Part | Where | Notes |
|---|---|---|
| Web app | Firebase Hosting, site `solmate-analog` → https://solmate-analog.web.app | Static build of `frontend/` plus 430 data tiles |
| Old URL | Firebase Hosting, site `solmate-13571` | 301 redirect to the new URL, path and query kept |
| Prototype URL | GitHub Pages, tanbin-cs.github.io/solmate | Redirect page (`pages.yml`) |
| Terrain API | Cloud Run `solmate-terrain`, us-west1 | Behind `/api/v1/**` on the same origin; App Check enforced; max 2 instances |
| Firestore | us-west1 | `aoi_cache` for terrain results; client rules deny everything |
| Data | `gs://solmate-13571-data` | Raw NASA mirror, DEM tile cache, `web/tiles` for the site |
| Secret | Secret Manager `edl-token` | NASA Earthdata token for 100 m terrain |

## Deploy (automatic)
Every merge to `main` runs **Deploy** (`.github/workflows/deploy.yml`):
1. If API code or its data changed: Cloud Run builds a new revision **without traffic**
   (tag `candidate`), smoke-tests it (health, version = commit, App Check refuses a request with
   no token), then moves all traffic to it.
2. Web: restores the tiles from GCS, builds with the public Firebase key (repository
   variable `VITE_FIREBASE_API_KEY`), deploys both Hosting sites and the Firestore rules.
3. Smoke test of production: every page, data, tiles and API health return 200; security
   headers present; the shell is `no-cache`; the old URL redirects.

To redeploy the API without a code change: Actions → Deploy → Run workflow → tick
"Also redeploy the Cloud Run API".

Auth is keyless (GitHub OIDC → Workload Identity Federation → `solmate-deployer`, only
for `Tanbin-CS/solmate`). One-time grants: `infra/gcp/bootstrap-iam.sh`,
`infra/gcp/grant-api-access.sh`, `infra/gcp/grant-ci-deploy.sh`.

## Roll back
Actions → **Rollback** → Run workflow → choose `web`, `api` or `both`.
- `web` re-releases the previous Hosting version of `solmate-analog`.
- `api` sends all traffic to the previous Cloud Run revision.
Nothing is deleted; deploying again rolls forward. The Firebase console (Hosting →
release history) and Cloud Run console (Revisions → Manage traffic) do the same by hand.

## Monitoring
Defined in `infra/monitoring/` and applied with `python infra/monitoring/apply.py <email>`.
- Uptime checks every 5 minutes: the site (`/`, must contain "SolMate") and the API
  (`/api/v1/health`).
- Alerts by e-mail: uptime check failing for 10 minutes; more than 5 API server errors
  in 10 minutes; API p95 latency above 10 s for 15 minutes.
- Budgets: "SolMate project $5/month" (50%, 90%, 100%, forecast 100%) on top of the
  billing account's $10 monthly alert.

## When an alert fires
- **Site down:** open the site in a private window. If Hosting serves an error, run
  Rollback → `web`. Check Firebase status. If only `/api` fails, see API errors.
- **API errors (5xx):** Cloud Run → `solmate-terrain` → Logs. A bad release: Rollback →
  `api`. NASA LP DAAC down: the API answers with `partial: true` and the site keeps the
  1 km score; nothing to do but wait.
- **API slow:** usually NASA LP DAAC. Cached places stay fast. During judging days,
  keep one instance warm (below).
- **Budget:** check Cloud Run instance counts and Cloud Build history; max instances is 2.

## Calendar
- **12–14 Nov 2026 (demo and judging):** keep one API instance warm (about $1 total):
  `gcloud run services update solmate-terrain --region us-west1 --project solmate-13571 --min-instances 1`
  and back to `0` on 15 Nov.
- **Before 20 Dec 2026:** the NASA Earthdata token expires about 60 days after it was
  created. Generate a new one at urs.earthdata.nasa.gov and add it as a new version of
  `edl-token` (`gcloud secrets versions add edl-token --data-file=-`, paste on stdin),
  then disable the old version. The API reads `latest`.
- **Weekly until January 2027:** open the site, the 30-second video and the NASA project
  page links in a private window; merge Dependabot security updates only with green CI.
