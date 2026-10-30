"""Readers for the v2 NASA inputs listed in data/manifest.v2.json.

Each reader returns float32 arrays in physical units with fill values as NaN.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import numpy as np

POWER_STORE = "s3://nasa-power/merra2/spatial/power_merra2_climatology_spatial_lst.zarr"
POWER_VARS = ("T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS10M", "PS", "FROST_DAYS")


def read_hdf4_sds(path: Path, name: str) -> np.ndarray:
    """Read one HDF4 (MODIS) scientific dataset, applying scale/offset and masking fills.

    MODIS land products store physical = scale_factor * (raw - add_offset) for LST and
    albedo; MYD11C3 emissivity uses raw * scale + offset. Both conventions are handled by
    the product-specific wrappers below, this function only masks the declared fill.
    """
    from pyhdf.SD import SD, SDC

    sd = SD(str(path), SDC.READ)
    try:
        ds = sd.select(name)
        raw = ds.get()
        attrs = ds.attributes()
    finally:
        sd.end()
    out = raw.astype(np.float32)
    fill = attrs.get("_FillValue")
    if fill is not None:
        out[raw == fill] = np.nan
    return out


def modis_lst_kelvin(path: Path, which: str) -> np.ndarray:
    """MYD11C3 LST_Day_CMG / LST_Night_CMG in kelvin (scale 0.02, fill 0)."""
    raw = read_hdf4_sds(path, f"LST_{which}_CMG")
    return raw * 0.02


def modis_land_percent(path: Path) -> np.ndarray:
    """MYD11C3 Percent_land_in_grid (0-100)."""
    return read_hdf4_sds(path, "Percent_land_in_grid")


def modis_snow_percent(path: Path) -> np.ndarray:
    """MOD10CM monthly snow cover 0-100 %; codes above 100 (cloud, water, night...) become NaN."""
    raw = read_hdf4_sds(path, "Snow_Cover_Monthly_CMG")
    raw[raw > 100] = np.nan
    return raw


def modis_albedo_wsa_shortwave(path: Path) -> np.ndarray:
    """MCD43C3 white-sky shortwave albedo (scale 0.001, fill 32767)."""
    return read_hdf4_sds(path, "Albedo_WSA_shortwave") * 0.001


IGBP_GROUPS = {
    "water_pct": (0,),
    "forest_pct": (1, 2, 3, 4, 5),
    "shrub_pct": (6, 7),
    "grass_savanna_pct": (8, 9, 10),
    "wetland_pct": (11,),
    "cropland_pct": (12, 14),
    "urban_pct": (13,),
    "snow_ice_pct": (15,),
    "barren_pct": (16,),
}


def modis_igbp_groups(path: Path) -> dict[str, np.ndarray]:
    """MCD12C1 Land_Cover_Type_1_Percent grouped into the IGBP_GROUPS (% of each 0.05 cell).

    Grouping happens on the uint8 data to keep memory low (17 x 26 M cells).
    """
    from pyhdf.SD import SD, SDC

    sd = SD(str(path), SDC.READ)
    try:
        raw = sd.select("Land_Cover_Type_1_Percent").get()  # uint8 (rows, cols, 17), fill 255
    finally:
        sd.end()
    invalid = (raw == 255).any(axis=-1)
    out = {}
    for name, classes in IGBP_GROUPS.items():
        g = raw[..., list(classes)].sum(axis=-1, dtype=np.uint16).astype(np.float32)
        g[invalid] = np.nan
        out[name] = g
    return out


def aster_ged_emissivity(path: Path) -> np.ndarray:
    """ASTER GED v4.1 5 km emissivity for bands 10-14, shape (5, rows, cols); raw 0 is no data."""
    import h5py

    with h5py.File(path, "r") as h:
        raw = h["SDS/Emissivity"][:]
    out = raw.astype(np.float32) * 0.002 + 0.49
    out[raw == 0] = np.nan
    return out


def merra2_dust_aod(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """MERRA-2 M2TMNXAER monthly dust extinction AOD at 550 nm, with ascending lat and lon."""
    import h5py

    with h5py.File(path, "r") as h:
        v = h["DUEXTTAU"][0].astype(np.float32)
        lat = h["lat"][:].astype(np.float64)
        lon = h["lon"][:].astype(np.float64)
        fill = h["DUEXTTAU"].attrs.get("_FillValue")
    if fill is not None:
        v[v == np.asarray(fill).item()] = np.nan
    return v, lat, lon


def srtmgl30_tile(path: Path) -> tuple[np.ndarray, float, float]:
    """One SRTMGL30 (GTOPO30-style) tile: (elevation m with NaN, top latitude, left longitude).

    Tiles are 40 x 50 degrees at 30 arc-seconds (4800 x 6000), raw big-endian int16 with
    -9999 as no data. The name encodes the upper-left corner, e.g. W020N40 -> 20W, 40N.
    """
    with zipfile.ZipFile(path) as zf:
        member = next(n for n in zf.namelist() if n.upper().endswith(".DEM"))
        buf = zf.read(member)
    name = Path(member).stem.upper()
    lon = float(name[1:4]) * (-1 if name[0] == "W" else 1)
    lat = float(name[5:7]) * (-1 if name[4] == "S" else 1)
    z = np.frombuffer(buf, dtype=">i2").reshape(6000, 4800).astype(np.float32)
    z[z == -9999] = np.nan
    return z, lat, lon


def power_climatology(cache_dir: Path) -> dict[str, np.ndarray]:
    """NASA POWER MERRA-2 climatology (12 months + annual) for POWER_VARS.

    Read once from the anonymous public Zarr store and cached locally as .npz.
    Returns arrays shaped (13, 361, 576) plus 'lat' and 'lon' (ascending).
    """
    cache = cache_dir / "power_climatology.npz"
    if cache.exists():
        with np.load(cache) as z:
            return {k: z[k] for k in z.files}
    import xarray as xr

    ds = xr.open_zarr(POWER_STORE, storage_options={"anon": True})
    out = {v: ds[v].values.astype(np.float32) for v in POWER_VARS}
    out["lat"] = ds["lat"].values
    out["lon"] = ds["lon"].values
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache, **out)
    return out
