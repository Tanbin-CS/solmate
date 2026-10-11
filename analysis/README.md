# SolMate analysis pipeline

Computes terrain indicators for Jezero Crater (Mars) and Earth sites from real elevation models, then writes the static
artifacts that the frontend reads from `frontend/public/data/`.

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # (.venv/bin/pip on macOS/Linux)
.venv/Scripts/python -m pytest -q tests        # analytic checks of the terrain indicators
.venv/Scripts/python run.py                    # downloads DEM windows (cached in ./cache), writes JSON + quicklooks
```

| File | Purpose |
|---|---|
| `sites.yaml` | Reference target, documented analog sites (NASA Planetary Analog Explorer), other candidates and negative controls |
| `fetch.py` | Copernicus GLO-30 windows (AWS Open Data) and the USGS Jezero CTX DTM, resampled to a common metric grid |
| `terrain.py` | Slope, local relief, ruggedness (TRI) and hypsometric integral (pure functions) |
| `similarity.py` | Robust-z Gaussian similarity and weighted score (mirrored by `frontend/src/science/similarity.ts`) |
| `run.py` | Pipeline: indicators for three analysis configurations, validation, weight perturbation, provenance |
| `sources/` | Verbatim source excerpts (with URL and retrieval date) behind each site's context claim |
| `claims_check.py` | Optional TypeSafe/Jev evidence check of context claims against `sources/` (needs `TYPESAFE_API_KEY`; `--offline` writes "not checked") |

No credentials are needed for the terrain pipeline; all inputs are public open data. The evidence check reads `TYPESAFE_API_KEY`
from the environment only, runs on the developer machine, and never affects scores.
