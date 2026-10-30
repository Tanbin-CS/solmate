# ADR-0003: NASA-first data policy

- Status: accepted (2026-10-30, user requirement)

## Decision
- Every *scored* indicator comes from a NASA dataset.
- Non-NASA data are optional, labelled extras that are never needed for a
  score: ESA GLO-30 as a cross-check, ESA CCI permafrost, and AWS Terrarium
  for the 3D view.
- EOX Sentinel-2 cloudless (CC BY-NC-SA) is removed. It is replaced by NASA
  GIBS and HLS.

## Consequences
- Strong Relevance and NASA-data-usage scores.
- A licence-clean submission.
- Polar terrain uses ASTER GDEM v3 (to 83°).
