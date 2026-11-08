# SolMate: Earth analogs for the Moon and Mars, from NASA data

**Team Northern Lights · NASA International Space Apps Challenge 2026**
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

SolMate scores every land cell on Earth (about 1.9 million at 0.1°) against 11 NASA targets: the nine candidate landing regions NASA named near the lunar south pole, Jezero Crater and Arcadia Planitia. Each place gets a **SolMate Analog Index (SAI, 0–100)** built from seven physical characteristics measured with NASA data, a plain statement of where the analogy breaks down, and what the place could be used for.

**Live app: https://solmate-analog.web.app** (no login, works on phones)

## Judge quick start (3 minutes)

1. **Pick a target and see Earth's best matches.** Open the [Explorer for Jezero Crater](https://solmate-analog.web.app/explorer?t=jezero_crater). The list ranks the best places on Earth; the *Novel leads* tab shows those more than 300 km from every known analog site.
2. **Open one place and see why.** [Tibetan Plateau, 34.95°N 83.35°E](https://solmate-analog.web.app/explorer?t=jezero_crater&p=34.95,83.35) shows its score for each characteristic, the NASA value behind each one, and *Where the analogy breaks down* (gravity, air, radiation, and any gap Earth cannot close).
3. **Drive it in 3D.** [The same place in Twin Drive](https://solmate-analog.web.app/explorer?t=jezero_crater&p=34.95,83.35&view=3d) drives one NASA rover over 20 km of real NASA terrain on Earth and on Mars, side by side at the same scale.
4. **Click anywhere else on the map** to score that place live in your browser, or draw a box.
5. **For students (ages 10–16).** The [Learn](https://solmate-analog.web.app/learn) page has six short levels. Each level has story cards, a game such as *Analog Hunter* (it scores places with the same browser code as the Explorer) and a short quiz. Progress stays on the device.

Then read the [Findings](https://solmate-analog.web.app/findings) (the written report), the [Method](https://solmate-analog.web.app/method) (how the score works and how well it holds up) and the [Data](https://solmate-analog.web.app/provenance) page (every dataset, its version and licence).

## Key numbers

| | |
|---|---|
| Earth places scored | ~1.9 million land cells at 0.1°, two-stage screen with 100 m NASA terrain for the leaders |
| Targets | 9 lunar south-pole regions, Jezero Crater, Arcadia Planitia |
| Characteristics (dimensions) | Terrain, climate and aridity, thermal, surface, mineralogy, ice and cold traps, dust |
| Validation, Jezero | Documented NASA analog sites outscore controls: **AUC 0.84** (95% CI 0.69–0.96; 17 sites, 20 controls) |
| Validation, Moon | Median **AUC 0.76** over the 9 regions (10 sites each, so intervals are wide) |
| Validation, Arcadia Planitia | AUC 0.58 with equal weights: a weak result, reported rather than hidden |
| Novel leads | 53 of the top 55 places (top 5 for each target) are more than 300 km from all 31 known analog sites |

AUC is the chance that a site NASA has used as an analog outscores a control site (farmland, forest, cities, ice); 0.5 is chance. The test was written down before it was run ([VALIDATION.md](docs/VALIDATION.md)). A high score marks a candidate for field review, not a proven analog.

## NASA data

Every scored value comes from NASA data. Earth: ASTER GDEM v3, SRTMGL30, MODIS (land surface temperature, albedo, land cover, snow), ASTER GED, MERRA-2 aerosols and NASA POWER, with NASADEM as a terrain cross-check; maps and thumbnails use NASA Landsat WELD and GIBS imagery. Moon: LRO LOLA, LRO Diviner and PGDA illumination. Mars: Mars 2020 CTX DTM, MOLA, MEDA, MSL RAD, SWIM, TES and CRISM. Non-NASA data (Copernicus DEM, AWS terrain tiles, Natural Earth borders) are optional, labelled extras that no score depends on. Full list with versions, DOIs and licences: [DATA_SOURCES.md](docs/DATA_SOURCES.md).

## How it works

1. **Same characteristics on every world.** The pipeline builds a global 0.1° stack of NASA Earth layers and a matching value for each target from NASA lunar and Mars data or cited mission results.
2. **Transparent score.** Each indicator is scored against Earth's own distribution: closeness when Earth can match the target, rank toward the target when it cannot (the gap is then stated). Dimension scores are averaged with equal weights by default; *Learned* weights come from a cross-validated logistic regression (the only fitted model; no deep learning).
3. **Same code in the browser.** The Python science core (`analysis/src/solmate/compute/`) is mirrored in TypeScript and kept identical by shared golden tests, so the browser scores any place instantly from precomputed tiles.
4. **100 m terrain on request.** A small Cloud Run API computes terrain from NASA ASTER GDEM for any box; screening leaders already carry it.

No AI model produces any number in SolMate; see [AI_USE.md](docs/AI_USE.md).

## What's next

SolMate's scores are tested against sites NASA already uses, but the new leads it finds have not been checked on the ground yet. To validate the method fully and at a finer scale, the team is looking for:

- **Field checks with scientists.** Geologists or planetary scientists to visit the top new sites, or review existing field studies of them, and compare the rocks, soil, slopes and temperatures with the scores.
- **Computing power.** Finer grids than 0.1°, and faster re-runs of screening and validation.
- **Higher-resolution NASA data.** Finer terrain and more mission data for the targets with few known analogs, such as Arcadia Planitia.

These are next steps. SolMate has no research partnership today.

## Team

Team Northern Lights: five computer science students from Dhaka, Bangladesh.

| Name | Role |
|---|---|
| Md. Rifat Ul Islam | Project Lead & Systems Architect |
| Umme Kulsum Esha | Research & Data Science Lead |
| Md. Abdulla Ibna Sina | Machine Learning & Validation Lead |
| Nur Hasin Ahammad | NASA Data Integration Lead |
| Md. Tanbin Islam | Product, Frontend & UX Lead |

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | React 19 + Vite + TypeScript web app: MapLibre map, three.js Twin Drive, browser scoring worker |
| `analysis/` | Python (uv) science pipeline: NASA downloads, global stack, screening, validation, web export |
| `api/` | FastAPI terrain service on Cloud Run (App Check, rate limit, cache) |
| `infra/` | Firestore rules, GCP setup, monitoring |
| `docs/` | [Report](docs/REPORT.md), [validation](docs/VALIDATION.md), [architecture](docs/ARCHITECTURE.md), [data sources](docs/DATA_SOURCES.md), [AI use](docs/AI_USE.md), [runbook](docs/RUNBOOK.md), [decisions](docs/adr/) |

## Run locally

```bash
cd frontend && npm ci && npm run dev        # http://localhost:5173
cd frontend && npm test                     # web tests, including Python/TypeScript parity
cd analysis && uv sync && uv run pytest     # science tests
```

The web app reads precomputed results from `frontend/public/data/v2/`. Scoring any place also needs the web tiles (~65 MB, not in git), which the pipeline rebuilds; the full rebuild order is on the [Data page](https://solmate-analog.web.app/provenance#reproduce) and in [RUNBOOK.md](docs/RUNBOOK.md).

## Security

No secrets in the repository or the web bundle; gitleaks runs on every commit and pull request. The API verifies Firebase App Check, rate-limits clients and validates every request; Firestore denies all client access. GitHub Actions are pinned to commit SHAs and deploy keylessly through Workload Identity Federation. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## History

SolMate started as an October prototype that compared terrain only, for Jezero and one lunar region; it passed Bangladesh prescreening and is kept as tag `v0.2.0-prototype`. The prototype began in a team member's repository ([hellorifat/solmate](https://github.com/hellorifat/solmate)), whose history and authorship are kept here.

## Licence

Code: Apache-2.0 (see `LICENSE`). Data keep their own terms; see `NOTICE` and [DATA_SOURCES.md](docs/DATA_SOURCES.md).
