"""Generic event-day reader: every supported format lands on the 0.1 degree grid correctly."""

import h5py
import numpy as np
import pytest
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin

from solmate.compute import grid
from solmate.io import generic

LAT_C, LON_C = grid.cell_centres()


def cell(lat, lon):
    return int(np.argmin(np.abs(LAT_C - lat))), int(np.argmin(np.abs(LON_C - lon)))


def src(**kw):
    return generic.Source.from_config({"files": "*", **kw})


def test_geotiff_is_area_averaged_onto_the_grid(tmp_path):
    # 0.05 degree raster over 10-11 E, 45-46 N: west half 2, east half 4, one nodata pixel
    a = np.full((20, 20), 2.0, dtype=np.float32)
    a[:, 10:] = 4.0
    a[0, 0] = -9999
    with rasterio.open(tmp_path / "f.tif", "w", driver="GTiff", height=20, width=20, count=1, dtype="float32",
                       crs="EPSG:4326", transform=from_origin(10, 46, 0.05, 0.05), nodata=-9999) as d:
        d.write(a, 1)
    out = generic.read_layer(tmp_path, src(files="f.tif"))
    assert out[cell(45.55, 10.25)] == pytest.approx(2.0)
    assert out[cell(45.55, 10.75)] == pytest.approx(4.0)
    assert out[cell(45.95, 10.05)] == pytest.approx(2.0)  # nodata ignored, not averaged in
    assert np.isnan(out[cell(0.05, 0.05)])


def test_netcdf4_cf_attributes_time_mean_and_several_files(tmp_path):
    lat = np.arange(-89.75, 90, 0.5)[::-1]  # 0.5 degree, descending
    lon = np.arange(0.25, 360, 0.5)  # 0..360 convention
    for i, base in enumerate((10, 30)):
        with h5py.File(tmp_path / f"m{i}.nc4", "w") as h:
            raw = np.full((2, lat.size, lon.size), base, dtype=np.int16)
            raw[1] += 10  # second month
            raw[0, 0, 0] = -999
            v = h.create_dataset("soil", data=raw)
            v.attrs["scale_factor"] = np.float32(0.01)
            v.attrs["add_offset"] = np.float32(0.0)
            v.attrs["_FillValue"] = np.int16(-999)
            h["lat"], h["lon"] = lat, lon
    out = generic.read_layer(tmp_path, src(files="m*.nc4", variable="soil"))
    # per file: mean of months (base, base+10) * 0.01; across files: mean of 0.15 and 0.35
    assert out[cell(10.05, -100.05)] == pytest.approx(0.25, abs=1e-6)
    assert out[cell(10.05, 100.05)] == pytest.approx(0.25, abs=1e-6)


def test_imerg_style_lon_lat_layout_is_transposed(tmp_path):
    lat = np.arange(-89.95, 90, 0.1)
    lon = np.arange(-179.95, 180, 0.1)
    field = np.add.outer(np.zeros(lon.size), lat).astype(np.float32)  # value = latitude, shape (lon, lat)
    with h5py.File(tmp_path / "imerg.h5", "w") as h:
        h.create_dataset("Grid/precipitation", data=field[None])
        h["Grid/lat"], h["Grid/lon"] = lat, lon
    out = generic.read_layer(tmp_path, src(files="imerg.h5", variable="Grid/precipitation", lat="Grid/lat",
                                           lon="Grid/lon"))
    assert out[cell(23.85, 90.45)] == pytest.approx(23.85, abs=1e-4)


def test_swath_with_2d_coordinates(tmp_path):
    la, lo = np.meshgrid(np.linspace(30.01, 30.09, 5), np.linspace(-60.09, -60.01, 5), indexing="ij")
    with h5py.File(tmp_path / "s.h5", "w") as h:
        h["data/value"] = np.full(la.shape, 7.0)
        h["geo/latitude"], h["geo/longitude"] = la, lo
    out = generic.read_layer(tmp_path, src(files="s.h5", variable="data/value", lat="geo/latitude",
                                           lon="geo/longitude"))
    assert out[cell(30.05, -60.05)] == 7.0 and np.isfinite(out).sum() == 1


def test_netcdf3_and_valid_range(tmp_path):
    from scipy.io import netcdf_file

    with netcdf_file(tmp_path / "c.nc", "w") as f:
        f.createDimension("lat", 2)
        f.createDimension("lon", 2)
        f.createVariable("lat", "f8", ("lat",))[:] = [0.025, -0.025]
        f.createVariable("lon", "f8", ("lon",))[:] = [0.025, 0.075]
        f.createVariable("t", "f4", ("lat", "lon"))[:] = [[1.0, 500.0], [3.0, 5.0]]
    out = generic.read_layer(tmp_path, src(files="c.nc", variable="t", valid_range=[0, 100]))
    assert out[cell(0.05, 0.05)] == 1.0  # 500 is out of range, dropped
    assert out[cell(-0.05, 0.05)] == 4.0


def test_regular_grid_spec_for_files_without_coordinates(tmp_path):
    with h5py.File(tmp_path / "cmg.h5", "w") as h:
        h["v"] = np.arange(4, dtype=np.float32).reshape(2, 2)  # 0.05 degree cells at 90N, 180W
    out = generic.read_layer(tmp_path, src(files="cmg.h5", variable="v", grid={"north": 90, "west": -180, "res": 0.05}))
    assert out[0, 0] == pytest.approx(1.5)


def test_moon_target_sampled_in_polar_stereographic(tmp_path):
    crs = CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")
    a = np.full((200, 200), 5.0, dtype=np.float32)  # 1 km pixels, 200 km square on the pole
    with rasterio.open(tmp_path / "moon.tif", "w", driver="GTiff", height=200, width=200, count=1, dtype="float32",
                       crs=crs, transform=from_origin(-100_000, 100_000, 1000, 1000)) as d:
        d.write(a, 1)
    v = generic.sample_target(tmp_path, {"file": "moon.tif", "body": "moon", "window_km": 10}, -89.5, 45.0)
    assert v == 5.0
    with pytest.raises(generic.LayerError, match="outside"):
        generic.sample_target(tmp_path, {"file": "moon.tif", "body": "moon"}, -80.0, 0.0)


def test_mars_target_in_0_360_raster(tmp_path):
    with rasterio.open(tmp_path / "mars.tif", "w", driver="GTiff", height=10, width=10, count=1, dtype="float32",
                       crs=CRS.from_proj4("+proj=longlat +R=3396190 +no_defs"),
                       transform=from_origin(70, 25, 1, 1)) as d:
        d.write(np.full((10, 10), 0.25, dtype=np.float32), 1)
    assert generic.sample_target(tmp_path, {"file": "mars.tif", "body": "mars", "window_km": 60}, 18.4, 77.5) == 0.25


@pytest.mark.parametrize("files", ["/etc/passwd", "../secrets/*", r"a\..\..\x", "C:/x", "~/x", ""])
def test_config_cannot_point_outside_the_raw_directory(files):
    with pytest.raises(generic.LayerError):
        generic.Source.from_config({"files": files})


def test_missing_files_and_variables_are_clear_errors(tmp_path):
    with pytest.raises(generic.LayerError, match="no files match"):
        generic.read_layer(tmp_path, src(files="nothing*.nc"))
    with h5py.File(tmp_path / "x.h5", "w") as h:
        h["a"] = np.zeros((2, 2))
    with pytest.raises(generic.LayerError, match="available: a"):
        generic.read_layer(tmp_path, src(files="x.h5", variable="b"))
