# ADR-0004: ASTER GDEM v3 is the single terrain source

- Status: accepted (2026-10-31)

## Context
- Offline and live scores must agree.
- Polar analogs (Devon Island, Svalbard, the Dry Valleys) lie beyond NASADEM's
  60°N limit.
- LP DAAC serves ASTGTM.003 as Cloud Optimized GeoTIFF (verified with an HTTP
  206 range read).

## Decision
- Terrain everywhere comes from ASTER GDEM v3, area-averaged to 100 m.
- Low-NUM (scene count) cells are masked.
- NASADEM is the validation cross-check.
- SRTMGL30 supplies stage-1 coarse terrain.

## Consequences
- One source, global to 83°, with live windowed reads.
- ASTER artifacts are damped by resampling and masking, and measured against
  NASADEM.
