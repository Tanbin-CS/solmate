"""Global grid helpers for the v2 stack: aggregation, regridding and physical formulas.

The SolMate global grid is 0.1 degree, 1800 rows x 3600 columns. Row 0 is the
cell centred at 89.95 N and column 0 the cell centred at 179.95 W, the same
orientation as NASA's MODIS Climate Modeling Grid (CMG) products. Everything
here is a pure function of its inputs.
"""

from __future__ import annotations

import numpy as np

RES = 0.1
NROWS, NCOLS = 1800, 3600


def cell_centres() -> tuple[np.ndarray, np.ndarray]:
    """Latitude (rows, north to south) and longitude (columns, west to east) cell centres."""
    lat = 90.0 - RES / 2 - RES * np.arange(NROWS)
    lon = -180.0 + RES / 2 + RES * np.arange(NCOLS)
    return lat, lon


def block_reduce(a: np.ndarray, factor: int, how: str = "mean") -> np.ndarray:
    """Reduce a 2-D array by `factor` x `factor` blocks, ignoring NaN.

    how: "mean", "median", "std", "min", "max" or "count" (number of finite values).
    Blocks with no finite value become NaN (or 0 for "count").
    """
    h, w = a.shape
    if h % factor or w % factor:
        raise ValueError(f"shape {a.shape} not divisible by {factor}")
    b = a.reshape(h // factor, factor, w // factor, factor).swapaxes(1, 2).reshape(h // factor, w // factor, -1)
    finite = np.isfinite(b)
    if how == "count":
        return finite.sum(axis=-1).astype(np.float32)
    with np.errstate(invalid="ignore", divide="ignore"):
        if how == "mean":
            out = np.nansum(b, axis=-1) / finite.sum(axis=-1)
        elif how == "median":
            import warnings

            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN blocks -> NaN
                out = np.nanmedian(b, axis=-1)
        elif how == "std":
            n = finite.sum(axis=-1)
            mean = np.nansum(b, axis=-1) / n
            out = np.sqrt(np.nansum((b - mean[..., None]) ** 2, axis=-1) / n)
        elif how in ("min", "max"):
            fill = np.inf if how == "min" else -np.inf
            red = np.min if how == "min" else np.max
            out = red(np.where(finite, b, fill), axis=-1)
            out = np.where(finite.any(axis=-1), out, np.nan)
        else:
            raise ValueError(f"unknown reduction {how!r}")
    return out.astype(np.float32)


METRES_PER_DEG = {"earth": 111_195.0, "mars": 59_274.7, "moon": 30_323.2}  # 2*pi*R/360, mean radius


def slope_deg_latlon(z: np.ndarray, top_lat: float, res_deg: float, metres_per_deg: float = 111_195.0) -> np.ndarray:
    """Slope (degrees) of a geographic-grid DEM with Horn's method and per-row cell width.

    z: elevations (m), rows north to south starting at `top_lat` (upper edge), square
    `res_deg` cells. East-west spacing shrinks with cos(latitude). Border cells are NaN.
    """
    lat = top_lat - res_deg * (np.arange(z.shape[0]) + 0.5)
    dy = res_deg * metres_per_deg
    dx = (res_deg * metres_per_deg * np.cos(np.radians(lat)))[:, None]
    zp = np.pad(z.astype(np.float64), 1, constant_values=np.nan)
    a, b, c = zp[:-2, :-2], zp[:-2, 1:-1], zp[:-2, 2:]
    d, f = zp[1:-1, :-2], zp[1:-1, 2:]
    g, h, i = zp[2:, :-2], zp[2:, 1:-1], zp[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * dy)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy))).astype(np.float32)


def cell_terrain_stats(z: np.ndarray, slope: np.ndarray) -> dict[str, float]:
    """Stage-1 terrain indicators for one ~0.1 degree cell from ~1 km elevations and slopes.

    Matches the Earth stack: median slope, maximum slope (the p90 proxy) and elevation
    standard deviation over the cell's pixels.
    """
    s = slope[np.isfinite(slope)]
    e = z[np.isfinite(z)]
    return {
        "slope_median_deg": float(np.median(s)) if s.size else float("nan"),
        "slope_p90_proxy_deg": float(np.max(s)) if s.size else float("nan"),
        "elev_std_m": float(np.std(e)) if e.size else float("nan"),
    }


def regrid_bilinear(values: np.ndarray, src_lat: np.ndarray, src_lon: np.ndarray) -> np.ndarray:
    """Bilinear interpolation of a regular lat/lon field onto the 0.1 degree grid.

    src_lat must be ascending; src_lon ascending in [-180, 180). Longitude wraps
    around the antimeridian. NaN in the source propagates to touching cells.
    """
    from scipy.interpolate import RegularGridInterpolator

    lon_ext = np.concatenate([src_lon[-1:] - 360.0, src_lon, src_lon[:1] + 360.0])
    val_ext = np.concatenate([values[:, -1:], values, values[:, :1]], axis=1)
    f = RegularGridInterpolator((src_lat, lon_ext), val_ext, method="linear", bounds_error=False, fill_value=np.nan)
    lat, lon = cell_centres()
    la, lo = np.meshgrid(lat, lon, indexing="ij")
    return f(np.stack([la.ravel(), lo.ravel()], axis=-1)).reshape(NROWS, NCOLS).astype(np.float32)


def extraterrestrial_radiation_mm(lat_deg: np.ndarray, doy: np.ndarray | int) -> np.ndarray:
    """Daily extraterrestrial radiation Ra as evaporation equivalent (mm/day), FAO-56 eqs. 21-25."""
    gsc = 0.0820  # MJ m-2 min-1
    phi = np.radians(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi * np.asarray(doy) / 365)
    delta = 0.409 * np.sin(2 * np.pi * np.asarray(doy) / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1.0, 1.0))
    ra_mj = 24 * 60 / np.pi * gsc * dr * (ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws))
    return np.maximum(ra_mj, 0.0) * 0.408


def hargreaves_pet_mm_day(tmean: np.ndarray, tmax: np.ndarray, tmin: np.ndarray, ra_mm: np.ndarray) -> np.ndarray:
    """Hargreaves-Samani reference evapotranspiration (mm/day). Temperatures in degC.

    The formula turns negative below a mean of -17.8 degC; evaporative demand cannot be
    negative, so it is clipped at 0 (polar cold deserts then have an undefined P/PET).
    """
    pet = 0.0023 * ra_mm * (tmean + 17.8) * np.sqrt(np.clip(tmax - tmin, 0.0, None))
    return np.maximum(pet, 0.0)


def aridity_index(precip_mm_day: np.ndarray, pet_mm_day: np.ndarray) -> np.ndarray:
    """UNEP aridity index P/PET; < 0.05 hyper-arid, < 0.2 arid, < 0.5 semi-arid."""
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(pet_mm_day > 1e-6, precip_mm_day / pet_mm_day, np.nan).astype(np.float32)


def ninomiya_indices(e10: np.ndarray, e11: np.ndarray, e12: np.ndarray, e13: np.ndarray,
                     e14: np.ndarray) -> dict[str, np.ndarray]:
    """ASTER TIR mineral indices (Ninomiya et al. 2005) from band emissivities.

    QI quartz = e11^2 / (e10 e12); CI carbonate = e13 / e14; MI mafic = e12 / e13.
    """
    with np.errstate(invalid="ignore", divide="ignore"):
        return {
            "quartz_index": (e11 * e11 / (e10 * e12)).astype(np.float32),
            "carbonate_index": (e13 / e14).astype(np.float32),
            "mafic_index": (e12 / e13).astype(np.float32),
        }
