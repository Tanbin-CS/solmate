#!/usr/bin/env bash
# One-time grants so GitHub Actions can deploy SolMate (run by a project owner).
#
# Cloud Run source deploys build with Cloud Build, which runs as the project's default
# compute service account; the CI deployer must be allowed to act as it for that build.
# The Firebase CLI also reads the Firebase project before a Hosting release.
set -euo pipefail

P=solmate-13571
PN=314008475333
DEPLOYER="solmate-deployer@${P}.iam.gserviceaccount.com"
BUILD_SA="${PN}-compute@developer.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "$BUILD_SA" --project "$P" \
  --member="serviceAccount:$DEPLOYER" --role=roles/iam.serviceAccountUser --quiet --format=none

gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$DEPLOYER" \
  --role=roles/firebase.viewer --condition=None --quiet --format=none

echo "CI deploy grants complete."
