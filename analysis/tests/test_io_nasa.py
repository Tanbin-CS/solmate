"""Offline tests for NASA readers using small synthetic files."""

import zipfile

import h5py
import numpy as np
import pytest

from solmate.io import nasa


def test_srtmgl30_tile_parses_corner_and_nodata(tmp_path):
    z = np.full((6000, 4800), 120, dtype=">i2")
    z[0, 0] = -9999
    path = tmp_path / "w020n40.SRTMGL30.dem.zip"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("W020N40.DEM", z.tobytes())
    elev, top, left = nasa.srtmgl30_tile(path)
    assert (top, left) == (40.0, -20.0)
    assert np.isnan(elev[0, 0]) and elev[1, 1] == 120.0


def test_srtmgl30_southern_eastern_tile(tmp_path):
    path = tmp_path / "e140s10.SRTMGL30.dem.zip"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("E140S10.DEM", np.zeros((6000, 4800), dtype=">i2").tobytes())
    _, top, left = nasa.srtmgl30_tile(path)
    assert (top, left) == (-10.0, 140.0)


def test_aster_ged_scales_and_masks_zero(tmp_path):
    path = tmp_path / "ged.h5"
    raw = np.zeros((5, 2, 2), dtype=np.uint8)
    raw[:, 0, 0] = 230  # 230 * 0.002 + 0.49 = 0.95
    with h5py.File(path, "w") as h:
        h.create_dataset("SDS/Emissivity", data=raw)
    e = nasa.aster_ged_emissivity(path)
    assert e[0, 0, 0] == pytest.approx(0.95)
    assert np.isnan(e[0, 1, 1])


def test_merra2_dust_masks_fill(tmp_path):
    path = tmp_path / "m2.nc4"
    with h5py.File(path, "w") as h:
        d = h.create_dataset("DUEXTTAU", data=np.array([[[0.2, 1e15]]], dtype=np.float32))
        d.attrs["_FillValue"] = np.float32(1e15)
        h.create_dataset("lat", data=np.array([0.0]))
        h.create_dataset("lon", data=np.array([0.0, 0.625]))
    v, lat, lon = nasa.merra2_dust_aod(path)
    assert v[0, 0] == pytest.approx(0.2) and np.isnan(v[0, 1])
