#!/usr/bin/env bash
# One-time, least-privilege IAM setup for SolMate (project solmate-13571).
# Run by a project owner. Creates no keys: GitHub Actions authenticates through
# Workload Identity Federation, limited to the repository Tanbin-CS/solmate.
set -euo pipefail

P=solmate-13571
PN=314008475333
DEPLOYER="solmate-deployer@${P}.iam.gserviceaccount.com"   # used by CI to deploy
RUNTIME="solmate-terrain@${P}.iam.gserviceaccount.com"     # Cloud Run service identity
REPO_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PN}/locations/global/workloadIdentityPools/github/attribute.repository/Tanbin-CS/solmate"

bind() { gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$1" --role="$2" --condition=None --quiet --format=none; }

# CI deployer: deploy Cloud Run from source, push images, release Hosting, rules and indexes.
for role in roles/run.admin roles/artifactregistry.writer roles/cloudbuild.builds.editor \
            roles/firebasehosting.admin roles/firebaserules.admin roles/datastore.indexAdmin \
            roles/serviceusage.serviceUsageConsumer roles/storage.objectAdmin; do
  bind "$DEPLOYER" "$role"
done

# Runtime: read/write Firestore documents (aoi_cache) only.
bind "$RUNTIME" roles/datastore.user

# Deployer may deploy services that run as the runtime account (and nothing else).
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" --project "$P" \
  --member="serviceAccount:$DEPLOYER" --role=roles/iam.serviceAccountUser --quiet --format=none

# Only GitHub Actions runs from Tanbin-CS/solmate may impersonate the deployer.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --project "$P" \
  --member="$REPO_PRINCIPAL" --role=roles/iam.workloadIdentityUser --quiet --format=none

# Runtime reads/writes the DEM tile mirror in the private data bucket only.
gcloud storage buckets add-iam-policy-binding gs://solmate-13571-data \
  --member="serviceAccount:$RUNTIME" --role=roles/storage.objectAdmin --quiet --format=none

echo "IAM bootstrap complete."
