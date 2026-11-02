# Event day: adding a dataset from the Resources tab

The Space Apps Resources tab for our challenge opens on **Friday 13 Nov 2026**. This is
how a dataset from it gets into SolMate in about an hour, well before the 18:30 video
upload. Rehearsed on 3 Nov with NASA GLDAS soil moisture: download 3 min 44 s, release
3 min 11 s, everything else (review, pull request, deploy) about 20 minutes.

No live API call or model server is involved. New data goes through the same offline
pipeline as every other layer: download, put on the 0.1° grid, export static files,
deploy. The learned weights (the only ML) are refitted inside validation in seconds.

## 1. Triage the Resources tab (15 min)

For each listed resource, decide one of:

| Case | Action |
|---|---|
| Already used (MODIS, ASTER, SRTM, POWER, MERRA-2, LRO LOLA, Diviner, Mars 2020 CTX, Landsat via GIBS) | Cite it on the project page and in `docs/DATA_SOURCES.md` ("listed in the Resources tab"). No code. |
| New gridded Earth data (GeoTIFF/COG, NetCDF, HDF5, HDF4) | Add it as a **context** layer (steps 2-5). |
| New Moon or Mars raster (Moon Trek, Mars Trek, PDS, LRO, MRO) | Sample it at the targets (`targets.sample`), as context unless step 6 applies. |
| Tool, viewer, tutorial or non-gridded data | Mention it on the project page if we used it; nothing to ingest. |

Prefer NASA datasets. Non-NASA data can only be context, never scored (CLAUDE.md rule 1).

## 2. Describe the dataset in `analysis/src/solmate/config/event_layers.yaml`

Copy the GLDAS entry and change it. The fields are documented at the top of the file.

- `id`: snake_case with the unit, e.g. `ndvi_mean`, `soil_moisture_kg_m2`.
- `download`: the CMR short name and version from the dataset's Earthdata page, and the
  period (default to 2023-01-01 to 2024-12-31, the same years as the other layers).
  If the dataset is not in CMR, download the files by hand into `analysis/cache/raw/<folder>/`
  and leave `download` out.
- `earth.files`: glob under `analysis/cache/raw`. `earth.variable`: the dataset name inside
  the file. To list names: `uv run python -c "import h5py; h5py.File('<file>').visit(print)"`
  (NetCDF-4 and HDF5), or `gdalinfo <file>` for GeoTIFF.
- Scale or fill: the reader applies the file's CF attributes. Give `scale`, `offset`, `fill`
  or `valid_range` only if the file's own documentation says to.

A mistake in the file fails at the first command, with a message saying what to fix.

## 3. Download

```
cd analysis
uv run python download_nasa.py --list --only <SHORT_NAME>   # check the granule count first
uv run python download_nasa.py --only <SHORT_NAME>
```

The Earthdata token is read from Secret Manager (`edl-token`); nothing to paste.

## 4. Release

```
uv run python -m solmate.pipeline.release --push
```

This runs, in order: target sampling, the new stack layer, web export with tiles, the
findings report, golden parity cases, all science and web tests, and publishes the tiles
under their content hash in GCS. It stops at the first failure.

Check two numbers by hand before going on: open `data/stack/layers.v2.json`, find the new
layer and read `land_coverage` and `land_p1_p50_p99`. They should be plausible for the
dataset (units, range, where it has data).

## 5. Ship

1. Branch, commit (`feat(data): add <dataset> as a context layer`), open the PR against
   `Tanbin-CS/solmate` main.
2. Add one row to `docs/DATA_SOURCES.md` (section "Earth (context, shown but not scored)").
   Add the product to the source lists on the Home page if it is a new family.
3. Wait for CI, merge (rebase). Deploy runs on its own; its smoke test checks every page,
   the tiles and that the site and API report the same results version.
4. Open the Explorer, click a place, and look for "More NASA data at this place".

## 6. Scoring a new dataset (only if there is time, and only by the rule)

The rule is pre-registered in `docs/VALIDATION.md`, addendum 2. In short: the median AUC of
each body it is scored on may fall by at most 0.02, or the layer stays context.

1. Set `role: scored` and give a value for every target of the bodies its dimension applies
   to (`targets.values` with a source, or `targets.sample`).
2. In `dimensions.yaml`, list the id under one dimension with a weight and a `label`.
3. `uv run python -m solmate.pipeline.release --scored --push` (re-screens and re-validates;
   allow 30-60 minutes).
4. If the release says the rule says no: follow its message (back to context) and say so on
   the project page. Either outcome is reported.

## If something breaks

- A reader error names the file and the missing variable or coordinate: fix the config.
- The release stopped at tests: read the failing test; `git restore data frontend/public`
  returns to the committed state.
- A bad deploy: Actions → Rollback → `web` (see `docs/RUNBOOK.md`).
