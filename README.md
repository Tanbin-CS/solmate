# SolMate: Search for Planetary Analogs (Twins on Earth/Sol 3 Ground)

**Team Northern Lights · NASA International Space Apps Challenge 2026**
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

## Live

- **Submission repository:** https://github.com/Tanbin-CS/solmate (this repo)
- **Web app (prototype, v0.2.0):** https://tanbin-cs.github.io/solmate/
- **v2 (in progress):** moves to Firebase at https://solmate-analog.web.app

The prototype started from a team member's repository
([hellorifat/solmate](https://github.com/hellorifat/solmate)); its history and
authorship are kept here. Tag `v0.2.0-prototype` marks the version that passed
Bangladesh prescreening.

## What the prototype does

SolMate compares two planetary targets, **Jezero Crater on Mars** and the **Mons Mouton Plateau at the lunar south pole** (an Artemis III candidate region), with Earth sites using real elevation models:

1. **Same grid on every world.** The USGS Mars 2020 CTX DTM (20 m), the LOLA south-pole DEM (20 m) and Copernicus DEM GLO-30 (~30 m) are resampled to the same 100 m grid in 20 km windows.
2. **Five terrain indicators.** Median and 90th-percentile slope, 1 km local relief, terrain ruggedness and hypsometric integral, computed with identical code for both.
3. **Transparent similarity.** Robust-z Gaussian similarity per indicator and a weighted mean. Weights are adjustable live in the browser, with a per-indicator explanation for every site.
4. **Validation.** Do Earth sites that NASA pairs with the target body in its Planetary Analog Explorer outrank negative controls? Jezero: AUC 0.83 at equal weights (0.64–0.94 under random weights), dropping to 0.58 in a 12 km window. Mons Mouton: AUC 0.83 (0.67–0.88), 0.79 in a 12 km window. The limitations are published in the app.
5. **Regional screening.** 245 unreviewed 20 km windows across 14 arid, volcanic and polar regions, scored the same way. Two of the top six Jezero windows fall within 30 km of NASA-documented sites the screening was not told about (Askja, Death Valley).
6. **Interactive map and home page.** MapLibre globe with NASA Landsat WELD imagery, 3D terrain, analysis windows and shareable URLs; a 3D hero (three.js) where arcs link Mars or the Moon to their best Earth matches; a home page with a drag-to-compare terrain view, a world overview and live rankings. Results can be exported as CSV or JSON and two sites compared side by side.
7. **Evidence check (optional).** A TypeSafe/Jev check flags context claims that their cited source does not support. It never affects scores.

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui app (deployed to GitHub Pages) |
| `analysis/` | Python pipeline that computes indicators, validation and provenance into `frontend/public/data/` |
| `docs/DECISIONS.md` | Technology, data-source and TypeSafe decisions; security note |
| `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md` | Engineering rules, commit conventions, security policy |

## Run locally

```bash
cd frontend && npm install && npm run dev          # http://localhost:5173/solmate/
cd analysis && uv sync --all-groups                  # locked Python env (uv.lock)
uv run pytest                                       # science tests
uv run python download_nasa.py                      # NASA v2 inputs (Earthdata token required)
uv run python run.py                                # recompute the data artifacts
uv run python screen.py                             # regional screening (slow: ~250 DEM windows)
```

## Data credits

USGS Astrogeology (Mars 2020 TRN CTX DTM and orthomosaic, Fergason et al. 2020) · NASA GSFC Planetary Geodesy Data Archive (LOLA south-pole DEM and Sun visibility) · Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA · NASA GIBS (Blue Marble, Landsat WELD by NASA/USGS, ASTER GDEM shaded relief by NASA/METI) · Globe textures: NASA Blue Marble Next Generation, USGS/NASA Ames Viking MDIM 2.1 colourised mosaic, NASA LRO LROC WAC global mosaic (NASA Moon Trek) · AWS Terrain Tiles · NASA Planetary Analog Explorer.

## Licence

Code: Apache-2.0 (see `LICENSE`). Data keep their own terms; see `NOTICE`.
