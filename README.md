# SolMate: Search for Planetary Analogs (Twins on Earth/Sol 3 Ground)

**Team Northern Lights · NASA International Space Apps Challenge 2026**
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

## Live

- **Web app:** https://hellorifat.github.io/solmate
- **Legacy API (unchanged):** https://solmate-api.onrender.com/api/v1/match/?target=jezero

## What the prototype does

SolMate compares **Jezero Crater on Mars** with Earth sites using real elevation models:

1. **Same grid on both worlds.** The USGS Mars 2020 CTX DTM (20 m) and Copernicus DEM GLO-30 (~30 m) are resampled to the same 100 m grid in 20 km windows.
2. **Five terrain indicators.** Median and 90th-percentile slope, 1 km local relief, terrain ruggedness and hypsometric integral, computed with identical code for both.
3. **Transparent similarity.** Robust-z Gaussian similarity per indicator and a weighted mean. Weights are adjustable live in the browser, with a per-indicator explanation for every site.
4. **Validation.** Do Earth sites that NASA pairs with Mars in its Planetary Analog Explorer outrank negative controls? At equal weights the AUC is 0.83 (0.64–0.94 under random weights). It drops to 0.58 in a 12 km window. The limitations are published in the app.
5. **Interactive map.** MapLibre globe with Sentinel-2 imagery, 3D terrain, analysis windows and shareable URLs.
6. **Evidence check (optional).** A TypeSafe/Jev check flags context claims that their cited source does not support. It never affects scores.

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui app (deployed to GitHub Pages) |
| `analysis/` | Python pipeline that computes indicators, validation and provenance into `frontend/public/data/` |
| `backend/` | Original Django REST API (unchanged by the prototype) |
| `docs/DECISIONS.md` | Technology, data-source and TypeSafe decisions; security note |

## Run locally

```bash
cd frontend && npm install && npm run dev          # http://localhost:5173/solmate/
cd analysis && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python run.py                         # recompute the data artifacts
```

## Data credits

USGS Astrogeology (Mars 2020 TRN CTX DTM and orthomosaic, Fergason et al. 2020) · Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA · Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data) · NASA GIBS Blue Marble · AWS Terrain Tiles · NASA Planetary Analog Explorer.
