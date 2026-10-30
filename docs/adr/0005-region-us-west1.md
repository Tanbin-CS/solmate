# ADR-0005: Region us-west1

- Status: accepted (2026-10-31)

## Context
- NASA Earthdata Cloud and the NASA POWER Zarr live in AWS us-west-2.
- The Firestore location cannot be changed later.

## Decision
- Run Cloud Run, Firestore, GCS and Artifact Registry in us-west1 (Oregon),
  next to the data. It is a tier-1 price region.

## Consequences
- Fast live COG reads.
- The global Hosting CDN means users far from Oregon only feel it on terrain
  refinement.
