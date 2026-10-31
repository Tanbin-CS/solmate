# Data sources

Every input SolMate uses: what it is, who publishes it, how we use it and its terms.
- **Scored indicators use NASA data only.** Non-NASA data are optional, labelled extras
  (see ADR-0003).
- File-level provenance (URL, size, sha256) is in `data/manifest.v2.json`.
- Layer metadata is in `data/stack/layers.v2.json`.

## Earth (scored)

| Dataset | Agency / product | Version, period | Used for (dimension) | Terms |
|---|---|---|---|---|
| ASTER GDEM v3 | NASA/METI, LP DAAC `ASTGTM.003` | 1″ global DEM | 100 m terrain: stage 2 and the live API (T) | NASA open data; cite NASA/METI/AIST/Japan Spacesystems |
| SRTMGL30 | NASA LP DAAC `SRTMGL30.002` | 30″ | ~1 km terrain stage 1: slope, relief (T, O) | NASA open data |
| NASADEM | NASA LP DAAC `NASADEM_HGT.001` | 1″, 56°S–60°N | Terrain cross-check (validation) | NASA open data |
| MODIS LST | NASA LP DAAC `MYD11C3.061` (Aqua) | monthly 0.05°, 2023–24 | Day/night surface temperature, diurnal range, coldest night (Th), land mask | NASA open data |
| MODIS albedo | NASA LP DAAC `MCD43C3.061` | 0.05°, mid-month 2023–24 | White-sky shortwave albedo (S) | NASA open data |
| MODIS land cover | NASA LP DAAC `MCD12C1.061` | 0.05°, 2023 | Barren, forest, vegetation, snow/ice, water % (S, context) | NASA open data |
| MODIS snow | NASA NSIDC `MOD10CM.61` | monthly 0.05°, 2023–24 | Snow persistence (I) | NASA open data |
| ASTER GED | NASA LP DAAC `AG5KMMOH.041` | 5 km monthly, 2013–15 | TIR emissivity, Ninomiya quartz/carbonate/mafic indices (M) | NASA open data |
| MERRA-2 aerosol | NASA GMAO / GES DISC `M2TMNXAER.5.12.4` | monthly, 2023–24 | Dust optical depth (D) | NASA open data |
| NASA POWER | NASA LaRC POWER (MERRA-2 climatology, Zarr on AWS) | climatology | Temperature, precipitation, humidity, wind, pressure, frost days; Hargreaves PET and P/PET (C, Th, I, D) | NASA open data |
| HLS v2 | NASA LP DAAC `HLSL30/HLSS30.020` | 30 m | Site imagery (display) | NASA open data |
| GIBS | NASA EOSDIS GIBS | Blue Marble, ASTER GDEM shaded relief | Basemap (display) | NASA open data |

## Moon (targets)

| Dataset | Agency / product | Used for | Terms |
|---|---|---|---|
| LRO LOLA LDEM_80S_20MPP_ADJ | NASA GSFC PGDA | Target terrain (stage 1 and 100 m) | NASA open data; cite Barker et al. |
| LRO Diviner seasonal polar temperatures | NASA LRO Diviner (Williams et al. 2019, doi 10.1029/2019JE006028) | Per-region temperature range, minimum, mean; cold traps | NASA open data |
| LRO illumination (sun visibility) | NASA GSFC PGDA (Mazarico et al.) | Illumination context | NASA open data |
| Artemis III candidate regions | NASA release, 28 Oct 2024 | The 9 Moon targets | NASA public information |
| Region centroids | Wueller et al. 2026, doi 10.1029/2025JE009434 | Coordinates of the candidate landing sites | Citation |
| Lunar mineralogy, albedo, CRaTER dose | Peer-reviewed literature (see `targets.yaml`) | Cited constants | Citation |

## Mars (targets)

| Dataset | Agency / product | Used for | Terms |
|---|---|---|---|
| MOLA MEGDR 64 px/deg | NASA MGS, PDS Geosciences | Target terrain stage 1 (Jezero, Arcadia) | NASA open data |
| Mars 2020 CTX DTM, Jezero | USGS Astrogeology / NASA Mars 2020 (Fergason et al. 2020) | Target terrain at 100 m | Public domain |
| Mars 2020 MEDA | NASA Mars 2020 (Munguira et al. 2023 and others) | Jezero temperatures, wind, humidity, pressure | Citation |
| MSL RAD | NASA MSL (Hassler et al. 2014) | Mars surface dose (breaks-down) | Citation |
| SWIM | NASA / PSI Subsurface Water Ice Mapping | Arcadia Planitia target selection and ice | Citation |
| TES, CRISM | NASA MGS / MRO (literature) | Albedo, mineral classes | Citation |

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

**Removed in v2:** Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0). Its non-commercial
terms do not meet the Space Apps open-licence rule.
