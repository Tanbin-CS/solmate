# Data sources

Every input SolMate uses: what it is, who publishes it, how we use it and its terms.
- **Scored indicators use NASA data only.** Non-NASA data are optional, labelled extras
  (see ADR-0003).
- File-level provenance (URL, size, sha256) is in `data/manifest.v2.json`.
- Layer metadata is in `data/stack/layers.v2.json`.

## Space Apps Resources tab (published 13 Nov 2026)

The challenge's Resources tab lists these NASA resources. SolMate uses each of them:
- **NASA Earthdata Search**: every Earth download goes through its catalogue (CMR) with an Earthdata Login token (`analysis/download_nasa.py`).
- **NASA Worldview**: the Explorer links each place to Worldview; the maps use GIBS, the imagery service behind it.
- **NASA Planetary Data System**: MOLA Mars terrain (PDS Geosciences) and the Diviner Polar Resource Product.
- **NASA LRO**: LOLA terrain and illumination, Diviner temperatures, and (added on event day) Diviner ice stability.
- **NASA LRO Diviner**: seasonal polar temperatures (scored, via the thermal dimension) and the Polar Resource Product (context).

Partner-agency resources in the tab: the Copernicus DEM (ESA Copernicus Data Space) is already an optional terrain
cross-check. CSA RADARSAT (Canada-focused SAR scenes), the ESA Open Science Catalog and JAXA G-Portal were reviewed and
not added: they do not provide a global gridded layer that a SolMate dimension needs.

## Earth (scored)

| Dataset | Agency / product | Version, period | Used for (dimension) | Terms |
|---|---|---|---|---|
| ASTER GDEM v3 | NASA/METI, LP DAAC `ASTGTM.003` | 1″ global DEM | 100 m terrain: stage 2 and the live API (T); 3D terrain view (context) | NASA open data; cite NASA/METI/AIST/Japan Spacesystems |
| SRTMGL30 | NASA LP DAAC `SRTMGL30.002` | 30″ | ~1 km terrain stage 1: slope, relief (T, O) | NASA open data |
| NASADEM | NASA LP DAAC `NASADEM_HGT.001` | 1″, 56°S–60°N | Terrain cross-check (validation) | NASA open data |
| MODIS LST | NASA LP DAAC `MYD11C3.061` (Aqua) | monthly 0.05°, 2023–24 | Day/night surface temperature, diurnal range, coldest night (Th), land mask | NASA open data |
| MODIS albedo | NASA LP DAAC `MCD43C3.061` | 0.05°, mid-month 2023–24 | White-sky shortwave albedo (S) | NASA open data |
| MODIS land cover | NASA LP DAAC `MCD12C1.061` | 0.05°, 2023 | Barren, forest, vegetation, snow/ice, water % (S, context) | NASA open data |
| MODIS snow | NASA NSIDC `MOD10CM.61` | monthly 0.05°, 2023–24 | Snow persistence (I): months above 50 % snow among the months MOD10CM observed (cloud and polar night are not counted as snow-free), scaled to 12; cells with fewer than 6 observed months have no value | NASA open data |
| ASTER GED | NASA LP DAAC `AG5KMMOH.041` | 5 km monthly, 2013–15 | TIR emissivity, Ninomiya quartz/carbonate/mafic indices (M) | NASA open data |
| MERRA-2 aerosol | NASA GMAO / GES DISC `M2TMNXAER.5.12.4` | monthly, 2023–24 | Dust optical depth (D) | NASA open data |
| NASA POWER | NASA LaRC POWER (MERRA-2 climatology, Zarr on AWS) | climatology | Temperature, precipitation, humidity, wind, pressure, frost days; Hargreaves PET and P/PET (C, Th, I, D) | NASA open data |
| Landsat WELD | NASA/USGS Web-Enabled Landsat Data, via NASA GIBS | 1990 global annual true colour (Landsat 5 TM) | Map imagery and site thumbnails (display only) | NASA open data |
| GIBS | NASA EOSDIS GIBS | Blue Marble, ASTER GDEM greyscale shaded relief | Basemap, relief view, thumbnails where Landsat has no data (display only) | NASA open data |

### After MODIS: the VIIRS path

NASA's Terra and Aqua satellites, which carry MODIS, are near the end of their missions, and Suomi NPP data left NASA on 1 Nov 2026. SolMate's MODIS inputs are fixed v6.1 files for 2023–24. They stay in NASA's archive and in our sha256-checked mirror, so every published result can be rebuilt as it is.

To refresh the Earth layers after MODIS, each MODIS product has a VIIRS successor from NOAA-20 (JPSS-1) on the same 0.05° grid, all in NASA's CMR catalogue (checked 7 Nov 2026):

| MODIS input (now) | VIIRS successor | Change needed |
|---|---|---|
| `MYD11C3.061` land surface temperature, monthly | `VJ121C3.002` LST and emissivity, monthly | Different retrieval method, so check the bias against MODIS over the overlap years before mixing them |
| `MCD43C3.061` albedo | `VJ143C3.002` albedo, daily | Average to the same months |
| `MOD10CM.61` snow, monthly | `VJ110C1.2` snow, daily | Build the monthly snow persistence from daily files |
| `MCD12C1.061` land cover, yearly | No 0.05° VIIRS land-cover product found | Keep the 2023 file; land cover changes slowly |

ASTER, MERRA-2, NASA POWER, GLDAS and the DEMs do not depend on MODIS.

## Earth (context, shown but not scored)

Added through `config/event_layers.yaml` (see `docs/EVENT_DAY.md`) and shown in the
Explorer's place panel with their source.

| Dataset | Agency / product | Version, period | Used for | Terms |
|---|---|---|---|---|
| GLDAS Noah land surface model | NASA GSFC Hydrological Sciences / GES DISC `GLDAS_NOAH025_M.2.1` | monthly 0.25°, 2023–24 mean | Topsoil moisture 0–10 cm (context). Model output driven by satellite and ground data, not a direct measurement; no data south of 60° S | NASA open data |

## Moon (targets)

| Dataset | Agency / product | Used for | Terms |
|---|---|---|---|
| LRO LOLA LDEM_80S_20MPP_ADJ | NASA GSFC PGDA | Target terrain (stage 1 and 100 m); 3D terrain view | NASA open data; cite Barker et al. |
| LRO Diviner seasonal polar temperatures | NASA LRO Diviner (Williams et al. 2019, doi 10.1029/2019JE006028) | Per-region temperature range, minimum, mean; cold traps | NASA open data |
| LRO Diviner Polar Resource Product (south) | NASA LRO Diviner, PDS Geosciences `LRO-L-DLRE-5-PRP-V2.0` (Paige et al. 2010, doi 10.1126/science.1187726) | Share of each region where water ice is stable at the surface or within 1 m (context for the 9 Moon targets, not scored). Added on event day from the Space Apps Resources tab | NASA open data |
| LRO illumination (sun visibility) | NASA GSFC PGDA (Mazarico et al.) | Illumination context | NASA open data |
| Candidate landing regions near the lunar south pole (named for Artemis III; NASA now plans the first crewed landing for Artemis IV) | NASA release, 28 Oct 2024 | The 9 Moon targets | NASA public information |
| Region centroids | Wueller et al. 2026, doi 10.1029/2025JE009434 | Coordinates of the candidate landing sites | Citation |
| Lunar mineralogy, albedo, CRaTER dose | Peer-reviewed literature (see `targets.yaml`) | Cited constants | Citation |
| LRO LROC WAC global mosaic | NASA LRO, via NASA Moon Trek (JPL Solar System Treks) | Moon globe texture on the home page (`frontend/public/media/moon-1k.webp`; display only) | NASA open data |

## Mars (targets)

| Dataset | Agency / product | Used for | Terms |
|---|---|---|---|
| MOLA MEGDR 64 px/deg | NASA MGS, PDS Geosciences | Target terrain stage 1 (Jezero, Arcadia) | NASA open data |
| Mars 2020 CTX DTM, Jezero | USGS Astrogeology / NASA Mars 2020 (Fergason et al. 2020) | Target terrain at 100 m; 3D terrain view | Public domain |
| Mars 2020 MEDA | NASA Mars 2020 (Munguira et al. 2023 and others) | Jezero temperatures, wind, humidity, pressure | Citation |
| MSL RAD | NASA MSL (Hassler et al. 2014) | Mars surface dose (breaks-down) | Citation |
| SWIM | NASA / PSI Subsurface Water Ice Mapping | Arcadia Planitia target selection and ice | Citation |
| TES, CRISM | NASA MGS / MRO (literature) | Albedo, mineral classes | Citation |
| Viking MDIM 2.1 colour mosaic | USGS Astrogeology / NASA Ames, from NASA Viking Orbiter images | Mars globe texture on the home page (`frontend/public/media/mars-1k.webp`; display only) | NASA open data |

## Validation and novelty labels

| Source | Used for |
|---|---|
| NASA Planetary Analog Explorer | Documented analog sites (positives) |
| NASA/ESA analog missions (HMP, MDRS, MARTE, AMASE, Desert RATS, HI-SEAS, PANGAEA, High Lakes, Pavilion Lake) | Positives and known sites for novelty |
| Xiao et al. 2017 (Qaidam Basin) | Known Mars analog for novelty |

## Optional non-NASA extras (never needed for a score)

| Dataset | Publisher | Used for | Terms |
|---|---|---|---|
| Copernicus DEM GLO-30 | ESA / DLR / Airbus | Terrain cross-check (v1 prototype) | Free with attribution |
| AWS Terrain Tiles (Terrarium) | Mapzen / AWS | Optional 3D terrain view | Open |
| Chang'e-4 LND lunar dose | CNSA (Zhang et al. 2020) | Breaks-down context only | Citation |
| UNSCEAR 2008 background dose | UN | Earth reference dose (breaks-down) | Citation |
| Natural Earth Admin 0 countries, 1:110m | Natural Earth (`nvkelso/natural-earth-vector` @ ca96624, sha256 6866c877…977f) | Country names for places in the Explorer, Learn and home page (display only). Shrunk by `scripts/shrink_countries.py` to `frontend/public/data/countries.v1.json` | Public domain |
| Natural Earth populated places, 1:50m | Natural Earth (`nvkelso/natural-earth-vector` @ ca96624, sha256 8e70756b…d978) | 1,251 cities and towns for the Explorer place search (display only). Shrunk by `scripts/shrink_places.py` to `frontend/public/data/places.v1.json` | Public domain |

**Removed in v2:** Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0). Its non-commercial
terms do not meet the Space Apps open-licence rule.
