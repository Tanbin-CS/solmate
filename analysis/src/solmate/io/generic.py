"""Read any gridded dataset onto the SolMate 0.1 degree grid, from one config entry.

Built for event day (13 Nov 2026), when the Space Apps Resources tab publishes datasets:
adding one is an entry in config/event_layers.yaml, not new reader code.

Earth layers (`read_layer`):
  GeoTIFF / COG / VRT  any projection; GDAL reprojects with area averaging
  NetCDF-4 / HDF5      h5py; CF scale_factor, add_offset and _FillValue applied
  NetCDF-3             scipy
  HDF4 (MODIS)         pyhdf; give `grid` for products without coordinate arrays
Coordinates come from 1-D axes or 2-D lat/lon arrays, or from a regular `grid` spec.
Sources finer than 0.1 degree are averaged into cells; coarser regular grids are
interpolated bilinearly. Leading dimensions (time, layers) and several files are reduced
with `reduce` (mean, min or max).

Moon / Mars target values (`sample_target`): the mean of a raster in a window around the
target centroid, in the raster's own planetary projection.
"""

from __future__ import annotations

import glob
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from solmate.compute import grid

ID_RE = re.compile(r"^[a-z][a-z0-9_]{2,40}$")
RASTER_EXT = (".tif", ".tiff", ".vrt", ".img", ".jp2")
HDF5_EXT = (".h5", ".he5", ".hdf5", ".nc", ".nc4", ".cdf")
LAT_NAMES = ("lat", "latitude", "Latitude", "LAT", "y")
LON_NAMES = ("lon", "longitude", "Longitude", "LON", "x")
BODY_RADIUS_M = {"moon": 1_737_400.0, "mars": 3_396_190.0}
REDUCERS = {"mean": np.nanmean, "min": np.nanmin, "max": np.nanmax}


class LayerError(ValueError):
    """A config entry or source file that cannot become a layer."""


@dataclass(frozen=True)
class Source:
    files: str  # glob under the raw data directory
    variable: str | None = None  # HDF/NetCDF dataset path or HDF4 SDS name; raster band number as text
    lat: str | None = None
    lon: str | None = None
    grid: dict | None = None  # {north, west, res} for regular grids without coordinate arrays
    scale: float | None = None  # physical = raw * scale + offset (overrides the file's CF attributes)
    offset: float | None = None
    fill: float | None = None
    valid_range: tuple[float, float] | None = None
    reduce: str = "mean"

    @classmethod
    def from_config(cls, d: dict) -> Source:
        files = str(d.get("files", ""))
        parts = re.split(r"[\\/]+", files)
        if not files or files.startswith(("/", "\\", "~")) or re.match(r"^[A-Za-z]:", files) or ".." in parts:
            raise LayerError(f"files must be a relative glob under the raw data directory, got {files!r}")
        reduce = d.get("reduce", "mean")
        if reduce not in REDUCERS:
            raise LayerError(f"reduce must be one of {sorted(REDUCERS)}")
        vr = d.get("valid_range")
        return cls(files=files, variable=None if d.get("variable") is None else str(d["variable"]),
                   lat=d.get("lat"), lon=d.get("lon"), grid=d.get("grid"), scale=d.get("scale"),
                   offset=d.get("offset"), fill=d.get("fill"),
                   valid_range=None if vr is None else (float(vr[0]), float(vr[1])), reduce=reduce)


def resolve_files(raw_dir: Path, pattern: str) -> list[Path]:
    """Files matching the glob, all inside raw_dir (no escaping through links)."""
    root = raw_dir.resolve()
    out = []
    for p in sorted(glob.glob(str(raw_dir / pattern), recursive=True)):
        rp = Path(p).resolve()
        if root not in rp.parents:
            raise LayerError(f"{p} is outside {raw_dir}")
        if rp.is_file():
            out.append(rp)
    if not out:
        raise LayerError(f"no files match {pattern!r} under {raw_dir}")
    return out


# ---------------------------------------------------------------- Earth layers

def read_layer(raw_dir: Path, src: Source) -> np.ndarray:
    """The source on the 0.1 degree grid (float32, NaN where no data), reduced over files."""
    reducer = REDUCERS[src.reduce]
    grids = [_one_file(p, src) for p in resolve_files(raw_dir, src.files)]
    if len(grids) == 1:
        return grids[0]
    with np.errstate(all="ignore"), _quiet():
        return reducer(np.stack(grids), axis=0).astype(np.float32)


def _one_file(path: Path, src: Source) -> np.ndarray:
    name = path.name.lower()
    if name.endswith(RASTER_EXT):
        return _raster_to_grid(path, src)
    if name.endswith(".hdf"):
        values, lat, lon = _read_hdf4(path, src)
    elif name.endswith(HDF5_EXT):
        values, lat, lon = _read_hdf5_or_netcdf3(path, src)
    else:
        raise LayerError(f"unsupported file type: {path.name}")
    return _place(_clip(values, src), lat, lon, src)


def _raster_to_grid(path: Path, src: Source) -> np.ndarray:
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import from_origin
    from rasterio.warp import reproject

    band = int(src.variable or 1)
    with rasterio.open(path) as ds:
        raw = ds.read(band).astype(np.float64)
        if ds.nodata is not None:
            raw[raw == ds.nodata] = np.nan
        if src.fill is not None:
            raw[raw == src.fill] = np.nan
        scale = src.scale if src.scale is not None else (ds.scales[band - 1] if ds.scales else 1.0)
        offset = src.offset if src.offset is not None else (ds.offsets[band - 1] if ds.offsets else 0.0)
        values = _clip(raw * scale + offset, src)
        out = np.full((grid.NROWS, grid.NCOLS), np.nan, dtype=np.float32)
        reproject(values.astype(np.float32), out, src_transform=ds.transform, src_crs=ds.crs, src_nodata=np.nan,
                  dst_transform=from_origin(-180.0, 90.0, grid.RES, grid.RES), dst_crs="EPSG:4326", dst_nodata=np.nan,
                  resampling=Resampling.average)
    return out


def _read_hdf5_or_netcdf3(path: Path, src: Source) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None]:
    import h5py

    if not h5py.is_hdf5(path):
        return _read_netcdf3(path, src)
    with h5py.File(path, "r") as h:
        var = _pick(h, src.variable, "variable")
        ds = h[var]
        raw = ds[...].astype(np.float64)
        attrs = {k: _scalar(v) for k, v in ds.attrs.items()}
        lat = _coord(h, src.lat, LAT_NAMES)
        lon = _coord(h, src.lon, LON_NAMES)
    return _cf(raw, attrs, src), lat, lon


def _read_netcdf3(path: Path, src: Source) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None]:
    from scipy.io import netcdf_file

    try:
        f = netcdf_file(path, "r", mmap=False)
    except (TypeError, ValueError, OSError) as e:
        raise LayerError(f"{path.name} is neither HDF5 nor NetCDF-3") from e
    with f:
        var = _pick(f.variables, src.variable, "variable")
        v = f.variables[var]
        raw = np.array(v.data, dtype=np.float64)
        attrs = {k: _scalar(val) for k, val in v._attributes.items()}
        lat = _coord(f.variables, src.lat, LAT_NAMES)
        lon = _coord(f.variables, src.lon, LON_NAMES)
    return _cf(raw, attrs, src), lat, lon


def _read_hdf4(path: Path, src: Source) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None]:
    from pyhdf.SD import SD, SDC

    sd = SD(str(path), SDC.READ)
    try:
        names = sd.datasets()
        var = _pick(names, src.variable, "variable")
        ds = sd.select(var)
        raw = np.asarray(ds.get(), dtype=np.float64)
        attrs = {k: _scalar(v) for k, v in ds.attributes().items()}
        lat = np.asarray(sd.select(src.lat).get(), dtype=np.float64) if src.lat else None
        lon = np.asarray(sd.select(src.lon).get(), dtype=np.float64) if src.lon else None
    finally:
        sd.end()
    fill = attrs.get("_FillValue")
    if fill is not None:
        raw[raw == fill] = np.nan
    if src.fill is not None:
        raw[raw == src.fill] = np.nan
    # MODIS HDF4 conventions differ by product, so scale/offset come only from the config here.
    return raw * (src.scale if src.scale is not None else 1.0) + (src.offset or 0.0), lat, lon


def _cf(raw: np.ndarray, attrs: dict, src: Source) -> np.ndarray:
    """CF conventions: mask _FillValue / missing_value, then raw * scale_factor + add_offset."""
    for key in ("_FillValue", "missing_value"):
        if attrs.get(key) is not None:
            raw[raw == attrs[key]] = np.nan
    if src.fill is not None:
        raw[raw == src.fill] = np.nan
    scale = src.scale if src.scale is not None else float(attrs.get("scale_factor", 1.0))
    offset = src.offset if src.offset is not None else float(attrs.get("add_offset", 0.0))
    return raw * scale + offset


def _clip(values: np.ndarray, src: Source) -> np.ndarray:
    if src.valid_range is not None:
        lo, hi = src.valid_range
        values = np.where((values >= lo) & (values <= hi), values, np.nan)
    return values


def _place(values: np.ndarray, lat: np.ndarray | None, lon: np.ndarray | None, src: Source) -> np.ndarray:
    """Reduce leading dimensions and put the field on the 0.1 degree grid."""
    if lat is None or lon is None:
        if not src.grid:
            raise LayerError("no lat/lon arrays found: name them with lat/lon, or give grid {north, west, res}")
        ny, nx = values.shape[-2:]
        res = float(src.grid["res"])
        lat = float(src.grid["north"]) - res / 2 - res * np.arange(ny)
        lon = float(src.grid["west"]) + res / 2 + res * np.arange(nx)
    lat, lon = np.squeeze(lat), np.squeeze(lon)
    if lat.ndim == 1 and lon.ndim == 1 and values.ndim >= 2 and values.shape[-2:] == (lon.size, lat.size) \
            and lat.size != lon.size:
        values = np.swapaxes(values, -1, -2)  # (..., lon, lat) layouts such as GPM IMERG
    spatial = values.shape[-2:] if lat.ndim == 1 else lat.shape
    values = _reduce_leading(values, len(spatial), src.reduce)
    if lat.ndim == 2:
        return grid.scatter_mean(values, lat, lon)
    if values.shape != (lat.size, lon.size):
        raise LayerError(f"field shape {values.shape} does not match lat {lat.size} x lon {lon.size}")
    res = float(np.median(np.abs(np.diff(lat)))) if lat.size > 1 else grid.RES
    if res <= grid.RES * 1.01:
        return grid.scatter_mean(values, lat, lon)
    # Coarser than the grid: bilinear on ascending axes with longitude in [-180, 180).
    lon = (lon + 180.0) % 360.0 - 180.0
    oy, ox = np.argsort(lat), np.argsort(lon)
    return grid.regrid_bilinear(values[np.ix_(oy, ox)].astype(np.float64), lat[oy], lon[ox])


def _reduce_leading(values: np.ndarray, n_spatial: int, how: str) -> np.ndarray:
    lead = values.ndim - n_spatial
    if lead <= 0:
        return values
    with np.errstate(all="ignore"), _quiet():
        return REDUCERS[how](values.reshape((-1, *values.shape[lead:])), axis=0)


def _pick(container, name: str | None, what: str) -> str:
    keys = list(_walk(container)) if hasattr(container, "visit") else list(container)
    if name:
        if name in keys or (hasattr(container, "get") and container.get(name) is not None):
            return name
        raise LayerError(f"{what} {name!r} not found; available: {', '.join(keys[:30])}")
    raise LayerError(f"name the {what}; available: {', '.join(keys[:30])}")


def _walk(h5) -> list[str]:
    import h5py

    names: list[str] = []
    h5.visititems(lambda n, o: names.append(n) if isinstance(o, h5py.Dataset) else None)
    return names


def _coord(container, name: str | None, defaults: tuple[str, ...]) -> np.ndarray | None:
    candidates = (name,) if name else defaults
    for c in candidates:
        try:
            obj = container[c]
        except (KeyError, TypeError):
            continue
        return np.array(obj.data if hasattr(obj, "data") else obj[...], dtype=np.float64)
    if name:
        raise LayerError(f"coordinate {name!r} not found")
    return None


def _scalar(v):
    a = np.asarray(v)
    if a.dtype.kind in "SUO":
        return a.item() if a.size == 1 else a.tolist()
    return float(a.ravel()[0]) if a.size else None


class _quiet:
    """Silence 'mean of empty slice' warnings for cells with no data in any file."""

    def __enter__(self):
        import warnings

        self._w = warnings.catch_warnings()
        self._w.__enter__()
        warnings.simplefilter("ignore", RuntimeWarning)

    def __exit__(self, *exc):
        return self._w.__exit__(*exc)


# ---------------------------------------------------------------- Moon / Mars targets

def sample_target(raw_dir: Path, spec: dict, lat: float, lon: float) -> float:
    """Mean of a planetary raster within window_km of (lat, lon), in the raster's projection.

    spec: {file, body: moon|mars, band, window_km, scale, offset, fill, valid_range}.
    Mars longitudes may be 0..360 or -180..180; both are tried against the raster.
    """
    import rasterio
    from rasterio.crs import CRS
    from rasterio.warp import transform

    body = spec.get("body")
    if body not in BODY_RADIUS_M:
        raise LayerError(f"body must be one of {sorted(BODY_RADIUS_M)}")
    path = resolve_files(raw_dir, str(spec["file"]))[0]
    window_m = float(spec.get("window_km", 20)) * 1000.0
    src = Source.from_config({"files": str(spec["file"]), **{k: spec[k] for k in
                                                            ("scale", "offset", "fill", "valid_range") if k in spec}})
    with rasterio.open(path) as ds:
        geo = CRS.from_proj4(f"+proj=longlat +R={BODY_RADIUS_M[body]} +no_defs")
        best = None
        for lo in {lon, (lon + 180.0) % 360.0 - 180.0, lon % 360.0}:
            xs, ys = transform(geo, ds.crs, [lo], [lat]) if ds.crs and not ds.crs.is_geographic else ([lo], [lat])
            r, c = ds.index(xs[0], ys[0])
            if 0 <= r < ds.height and 0 <= c < ds.width:
                best = (r, c)
                break
        if best is None:
            raise LayerError(f"({lat}, {lon}) is outside {path.name}")
        px_m = abs(ds.transform.a) * (np.pi * BODY_RADIUS_M[body] / 180.0 if ds.crs is None or ds.crs.is_geographic
                                      else 1.0)
        half = max(1, int(round(window_m / 2 / px_m)))
        r, c = best
        win = rasterio.windows.Window(c - half, r - half, 2 * half + 1, 2 * half + 1)
        raw = ds.read(int(spec.get("band", 1)), window=win, boundless=True, fill_value=np.nan).astype(np.float64)
        if ds.nodata is not None:
            raw[raw == ds.nodata] = np.nan
    if src.fill is not None:
        raw[raw == src.fill] = np.nan
    values = _clip(raw * (src.scale if src.scale is not None else 1.0) + (src.offset or 0.0), src)
    finite = values[np.isfinite(values)]
    if not finite.size:
        raise LayerError(f"no data within {window_m / 1000:.0f} km of ({lat}, {lon}) in {path.name}")
    return float(finite.mean())
