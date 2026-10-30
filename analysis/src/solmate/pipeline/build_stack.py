"""Build the SolMate v2 global stack: every Earth layer on one 0.1 degree grid.

Inputs are the NASA files in analysis/cache/raw (see data/manifest.v2.json) plus the
NASA POWER climatology Zarr. Output:

  analysis/cache/stack/stack_v2.npz   float32 layers, 1800 x 3600 (not in git; mirrored to GCS)
  data/stack/layers.v2.json           layer names, units, sources and global statistics

Run:  uv run python -m solmate.pipeline.build_stack
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import time
from collections.abc import Callable
from pathlib import Path

import numpy as np

from solmate.compute import grid
from solmate.io import nasa

ANALYSIS = Path(__file__).resolve().parents[3]
RAW = ANALYSIS / "cache" / "raw"
OUT_NPZ = ANALYSIS / "cache" / "stack" / "stack_v2.npz"
OUT_META = ANALYSIS.parent / "data" / "stack" / "layers.v2.json"

# Mid-month day of year for the 12 POWER climatology months.
MID_MONTH_DOY = np.array([15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349])
DAYS_IN_MONTH = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _monthly_mean(files: list[Path], reader: Callable[[Path], np.ndarray], factor: int = 2) -> np.ndarray:
    """Mean over files of each file's 0.1 degree block mean, ignoring NaN cells per month."""
    total = np.zeros((grid.NROWS, grid.NCOLS), np.float64)
    count = np.zeros((grid.NROWS, grid.NCOLS), np.float64)
    for f in files:
        m = grid.block_reduce(reader(f), factor, "mean")
        ok = np.isfinite(m)
        total[ok] += m[ok]
        count[ok] += 1
    with np.errstate(invalid="ignore", divide="ignore"):
        return (total / count).astype(np.float32)


def thermal_layers(files: list[Path]) -> dict[str, np.ndarray]:
    """MYD11C3: annual mean day/night LST, mean diurnal range, coldest night, hottest day."""
    day = np.stack([grid.block_reduce(nasa.modis_lst_kelvin(f, "Day"), 2) for f in files])
    night = np.stack([grid.block_reduce(nasa.modis_lst_kelvin(f, "Night"), 2) for f in files])
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return {
            "lst_day_mean_k": np.nanmean(day, axis=0),
            "lst_night_mean_k": np.nanmean(night, axis=0),
            "lst_diurnal_range_k": np.nanmean(day - night, axis=0),
            "lst_night_min_k": np.nanmin(night, axis=0),
            "lst_day_max_k": np.nanmax(day, axis=0),
            "land_frac": grid.block_reduce(nasa.modis_land_percent(files[0]), 2) / 100.0,
        }


def snow_layers(files: list[Path]) -> dict[str, np.ndarray]:
    """MOD10CM: mean monthly snow cover and number of months (per year) above 50 %."""
    months = np.stack([grid.block_reduce(nasa.modis_snow_percent(f), 2) for f in files])
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        years = len(files) / 12
        return {
            "snow_cover_mean_pct": np.nanmean(months, axis=0),
            "snow_months_per_year": (np.nansum(months > 50, axis=0) / years).astype(np.float32),
        }


def surface_layers(albedo_files: list[Path], landcover_file: Path) -> dict[str, np.ndarray]:
    """MCD43C3 white-sky shortwave albedo (mean of monthly samples) and MCD12C1 cover groups."""
    out = {"albedo_wsa_sw": _monthly_mean(albedo_files, nasa.modis_albedo_wsa_shortwave)}
    for name, g in nasa.modis_igbp_groups(landcover_file).items():
        out[name] = grid.block_reduce(g, 2)
    return out


def mineral_layers(files: list[Path]) -> dict[str, np.ndarray]:
    """ASTER GED: mean band 10-14 emissivity over months, then Ninomiya indices."""
    total = np.zeros((5, grid.NROWS, grid.NCOLS), np.float64)
    count = np.zeros((5, grid.NROWS, grid.NCOLS), np.float64)
    for f in files:
        e = nasa.aster_ged_emissivity(f)
        for b in range(5):
            m = grid.block_reduce(e[b], 2)
            ok = np.isfinite(m)
            total[b][ok] += m[ok]
            count[b][ok] += 1
    with np.errstate(invalid="ignore", divide="ignore"):
        emis = (total / count).astype(np.float32)
    out = {f"emis_b{b + 10}": emis[b] for b in range(5)}
    out.update(grid.ninomiya_indices(*emis))
    return out


def dust_layers(files: list[Path]) -> dict[str, np.ndarray]:
    """MERRA-2 dust extinction AOD, mean of monthly means, regridded bilinearly to 0.1 degree."""
    fields = []
    for f in files:
        v, lat, lon = nasa.merra2_dust_aod(f)
        fields.append(v)
    mean = np.nanmean(np.stack(fields), axis=0)
    return {"dust_aod_mean": grid.regrid_bilinear(mean, lat, lon)}


def terrain_layers(files: list[Path]) -> dict[str, np.ndarray]:
    """SRTMGL30 (30 arc-sec, ~1 km): per 0.1 degree cell mean and std of elevation, median slope."""
    keys = ("elev_mean_m", "elev_std_m", "slope_median_deg", "slope_p90_proxy_deg")
    out = {k: np.full((grid.NROWS, grid.NCOLS), np.nan, np.float32) for k in keys}
    for f in files:
        z, top, left = nasa.srtmgl30_tile(f)
        slope = grid.slope_deg_latlon(z, top, 1 / 120)
        r0, c0 = int(round((90 - top) / grid.RES)), int(round((left + 180) / grid.RES))
        rs, cs = slice(r0, r0 + 500), slice(c0, c0 + 400)
        out["elev_mean_m"][rs, cs] = grid.block_reduce(z, 12, "mean")
        out["elev_std_m"][rs, cs] = grid.block_reduce(z, 12, "std")
        out["slope_median_deg"][rs, cs] = grid.block_reduce(slope, 12, "median")
        out["slope_p90_proxy_deg"][rs, cs] = grid.block_reduce(slope, 12, "max")
    return out


def climate_layers(power: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """NASA POWER climatology: temperature, precipitation, aridity (Hargreaves PET), humidity, wind."""
    lat, lon = power["lat"], power["lon"]
    t, tx, tn = power["T2M"][:12], power["T2M_MAX"][:12], power["T2M_MIN"][:12]
    p = power["PRECTOTCORR"][:12]  # mm/day
    ra = np.stack([grid.extraterrestrial_radiation_mm(lat[:, None] * np.ones_like(t[0]), d) for d in MID_MONTH_DOY])
    pet = grid.hargreaves_pet_mm_day(t, tx, tn, ra)
    w = DAYS_IN_MONTH[:, None, None] / DAYS_IN_MONTH.sum()
    p_ann, pet_ann = (p * w).sum(axis=0), (pet * w).sum(axis=0)
    fields = {
        "t2m_mean_c": power["T2M"][12],
        "t2m_warmest_month_c": t.max(axis=0),
        "t2m_coldest_month_c": t.min(axis=0),
        "precip_mm_day": p_ann,
        "pet_mm_day": pet_ann,
        "aridity_index": grid.aridity_index(p_ann, pet_ann),
        "rh2m_pct": power["RH2M"][12],
        "ws10m_m_s": power["WS10M"][12],
        "surface_pressure_hpa": power["PS"][12],
        "frost_days_per_year": power["FROST_DAYS"][:12].sum(axis=0),
    }
    return {k: grid.regrid_bilinear(np.asarray(v, np.float32), lat, lon) for k, v in fields.items()}


LAYER_INFO = {
    "land_frac": ("fraction", "MYD11C3 v061 Percent_land_in_grid"),
    "lst_day_mean_k": ("K", "MYD11C3 v061, 2023-24"), "lst_night_mean_k": ("K", "MYD11C3 v061, 2023-24"),
    "lst_diurnal_range_k": ("K", "MYD11C3 v061, 2023-24"), "lst_night_min_k": ("K", "MYD11C3 v061, 2023-24"),
    "lst_day_max_k": ("K", "MYD11C3 v061, 2023-24"),
    "snow_cover_mean_pct": ("%", "MOD10CM v61, 2023-24"), "snow_months_per_year": ("months", "MOD10CM v61, 2023-24"),
    "albedo_wsa_sw": ("fraction", "MCD43C3 v061, 2023-24 mid-month"),
    **{k: ("%", "MCD12C1 v061, 2023") for k in nasa.IGBP_GROUPS},
    **{f"emis_b{b}": ("emissivity", "ASTER GED AG5KMMOH v041, 2013-15") for b in range(10, 15)},
    "quartz_index": ("ratio", "ASTER GED (Ninomiya 2005)"), "carbonate_index": ("ratio", "ASTER GED (Ninomiya 2005)"),
    "mafic_index": ("ratio", "ASTER GED (Ninomiya 2005)"),
    "dust_aod_mean": ("AOD 550 nm", "MERRA-2 M2TMNXAER 5.12.4, 2023-24"),
    "elev_mean_m": ("m", "SRTMGL30 v002"), "elev_std_m": ("m", "SRTMGL30 v002"),
    "slope_median_deg": ("deg", "SRTMGL30 v002"), "slope_p90_proxy_deg": ("deg", "SRTMGL30 v002 (cell max)"),
    **{k: (u, "NASA POWER MERRA-2 climatology") for k, u in {
        "t2m_mean_c": "degC", "t2m_warmest_month_c": "degC", "t2m_coldest_month_c": "degC",
        "precip_mm_day": "mm/day", "pet_mm_day": "mm/day (Hargreaves)", "aridity_index": "P/PET",
        "rh2m_pct": "%", "ws10m_m_s": "m/s", "surface_pressure_hpa": "hPa", "frost_days_per_year": "days"}.items()},
}


def _save(layers: dict[str, np.ndarray]) -> None:
    OUT_NPZ.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT_NPZ.with_name(OUT_NPZ.stem + ".tmp.npz")
    np.savez_compressed(tmp, **layers)
    tmp.replace(OUT_NPZ)  # atomic swap: never leave a half-written stack


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="build only these groups (thermal snow surface mineral dust terrain climate)")
    args = ap.parse_args()
    groups: dict[str, Callable[[], dict[str, np.ndarray]]] = {
        "thermal": lambda: thermal_layers(sorted((RAW / "MYD11C3").glob("*.hdf"))),
        "snow": lambda: snow_layers(sorted((RAW / "MOD10CM").glob("*.hdf"))),
        "surface": lambda: surface_layers(sorted((RAW / "MCD43C3").glob("*.hdf")),
                                          next((RAW / "MCD12C1").glob("*.hdf"))),
        "mineral": lambda: mineral_layers(sorted((RAW / "AG5KMMOH").glob("*.h5"))),
        "dust": lambda: dust_layers(sorted((RAW / "M2TMNXAER").glob("*.nc4"))),
        "terrain": lambda: terrain_layers(sorted((RAW / "SRTMGL30").glob("*.zip"))),
        "climate": lambda: climate_layers(nasa.power_climatology(RAW / "POWER")),
    }
    layers: dict[str, np.ndarray] = {}
    if OUT_NPZ.exists():
        with np.load(OUT_NPZ) as z:
            layers = {k: z[k] for k in z.files}
    for name, build in groups.items():
        if args.only and name not in args.only:
            continue
        _log(f"building {name} layers")
        layers.update({k: v.astype(np.float32) for k, v in build().items()})
        _save(layers)  # checkpoint after every group so a later failure keeps finished work
    digest = hashlib.sha256(OUT_NPZ.read_bytes()).hexdigest()
    land = layers.get("land_frac")
    mask = (land > 0.5) if land is not None else np.ones((grid.NROWS, grid.NCOLS), bool)
    meta = {
        "version": 2,
        "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "grid": {"res_deg": grid.RES, "rows": grid.NROWS, "cols": grid.NCOLS,
                 "origin": "row 0 = 89.95N, col 0 = 179.95W (MODIS CMG orientation)"},
        "file": OUT_NPZ.relative_to(ANALYSIS).as_posix(),
        "sha256": digest,
        "layers": {
            k: {
                "units": LAYER_INFO.get(k, ("?", "?"))[0],
                "source": LAYER_INFO.get(k, ("?", "?"))[1],
                "land_coverage": float(np.isfinite(v[mask]).mean()),
                "land_p1_p50_p99": [float(x) for x in np.nanpercentile(v[mask], [1, 50, 99])],
            }
            for k, v in sorted(layers.items())
        },
    }
    OUT_META.parent.mkdir(parents=True, exist_ok=True)
    OUT_META.write_text(json.dumps(meta, indent=1) + "\n")
    _log(f"wrote {len(layers)} layers to {OUT_NPZ} ({OUT_NPZ.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
