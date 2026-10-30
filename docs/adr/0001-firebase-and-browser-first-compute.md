# ADR-0001: Firebase Hosting + browser compute + one small Cloud Run service

- Status: accepted (2026-10-31)

## Context
- The user asked for instant responses at the lowest cost.
- The site must stay live through global judging (January 2027).
- Most results can be precomputed; only fine terrain for an arbitrary box
  needs server work.

## Decision
- Serve the app and all precomputed data from the Firebase Hosting CDN.
- Compute the coarse SAI for any point in a Web Worker from 0.1° grids.
- Run a single FastAPI service on Cloud Run (us-west1, min 0, max 2) for 100 m
  terrain only.
- Use Firestore for nominations and the cache.

## Consequences
- Nearly free and instant everywhere.
- Python and TypeScript compute must stay in parity (golden tests).
- Cold starts are hidden by a warm-up ping and the coarse result shown first.
