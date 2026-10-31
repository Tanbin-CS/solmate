#!/usr/bin/env bash
# Two owner-only grants the terrain API needs (run once, after bootstrap-iam.sh).
set -euo pipefail
P=solmate-13571
RUNTIME="solmate-terrain@${P}.iam.gserviceaccount.com"

# 1. The Cloud Run runtime may read exactly one secret: the Earthdata token.
gcloud secrets add-iam-policy-binding edl-token --project "$P" \
  --member="serviceAccount:${RUNTIME}" --role=roles/secretmanager.secretAccessor --quiet --format=none

# 2. Firebase Hosting forwards /api/v1/* to Cloud Run as an anonymous caller, so the service
#    must allow public invocation. Abuse is blocked inside the app: App Check on every scoring
#    call, strict input validation, per-client rate limits and max-instances 2.
gcloud run services add-iam-policy-binding solmate-terrain --project "$P" --region us-west1 \
  --member=allUsers --role=roles/run.invoker --quiet --format=none

echo "API access grants complete."
