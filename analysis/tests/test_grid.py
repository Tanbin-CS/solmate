import numpy as np
import pytest

from solmate.compute import grid


def test_cell_centres_match_cmg_orientation():
    lat, lon = grid.cell_centres()
    assert lat.shape == (1800,) and lon.shape == (3600,)
    assert lat[0] == pytest.approx(89.95) and lat[-1] == pytest.approx(-89.95)
    assert lon[0] == pytest.approx(-179.95) and lon[-1] == pytest.approx(179.95)


def test_block_reduce_ignores_nan_and_marks_empty_blocks():
    a = np.array([[1, 3, np.nan, np.nan], [5, 7, np.nan, np.nan]], dtype=float)
    assert np.allclose(grid.block_reduce(a, 2, "mean"), [[4.0, np.nan]], equal_nan=True)
    assert np.allclose(grid.block_reduce(a, 2, "max"), [[7.0, np.nan]], equal_nan=True)
    assert np.allclose(grid.block_reduce(a, 2, "count"), [[4, 0]])
    assert grid.block_reduce(a, 2, "std")[0, 0] == pytest.approx(np.std([1, 3, 5, 7]))


def test_block_reduce_rejects_uneven_shape():
    with pytest.raises(ValueError):
        grid.block_reduce(np.zeros((3, 4)), 2)


def test_regrid_bilinear_reproduces_linear_field_and_wraps():
    src_lat = np.arange(-90, 90.1, 0.5)
    src_lon = np.arange(-180, 180, 0.625)
    field = np.add.outer(src_lat, np.zeros_like(src_lon))  # value = latitude
    out = grid.regrid_bilinear(field, src_lat, src_lon)
    lat, _ = grid.cell_centres()
    assert np.allclose(out[:, 0], lat, atol=1e-4)
    assert np.allclose(out[:, -1], lat, atol=1e-4)  # antimeridian column interpolates across the wrap


def test_extraterrestrial_radiation_matches_fao56_example():
    # FAO-56 Example 8: 20 S on 3 September (day 246) -> Ra = 32.2 MJ m-2 day-1 = 13.1 mm/day
    assert grid.extraterrestrial_radiation_mm(np.array(-20.0), 246) == pytest.approx(32.2 * 0.408, rel=0.01)
    assert grid.extraterrestrial_radiation_mm(np.array(-89.0), 172) == pytest.approx(0.0, abs=1e-9)  # polar night


def test_hargreaves_and_aridity_classes():
    pet = grid.hargreaves_pet_mm_day(np.array(30.0), np.array(40.0), np.array(20.0), np.array(15.0))
    assert pet == pytest.approx(0.0023 * 15 * 47.8 * np.sqrt(20), rel=1e-9)
    ai = grid.aridity_index(np.array([0.1, 1.0, 0.0]), np.array([5.0, 2.0, 0.0]))
    assert ai[0] == pytest.approx(0.02) and ai[1] == pytest.approx(0.5) and np.isnan(ai[2])


def test_ninomiya_indices_known_values():
    e = {f"e{b}": np.array(v) for b, v in zip(range(10, 15), [0.90, 0.95, 0.90, 0.96, 0.97], strict=True)}
    idx = grid.ninomiya_indices(**e)
    assert idx["quartz_index"] == pytest.approx(0.95 ** 2 / (0.90 * 0.90))
    assert idx["carbonate_index"] == pytest.approx(0.96 / 0.97)
    assert idx["mafic_index"] == pytest.approx(0.90 / 0.96)


def test_block_median():
    a = np.array([[1, 2, 9, np.nan], [3, 100, np.nan, np.nan]], dtype=float)
    assert np.allclose(grid.block_reduce(a, 2, "median"), [[2.5, 9.0]])


def test_slope_latlon_plane_at_equator_and_60n():
    res = 1 / 120  # 30 arc-seconds
    rows = np.arange(50)[:, None] * np.ones((1, 50))
    # 10 m rise per row southward -> slope atan(10 / dy)
    z = rows * 10.0
    s = grid.slope_deg_latlon(z, top_lat=0.2, res_deg=res)
    dy = res * 111_195.0
    assert np.nanmedian(s) == pytest.approx(np.degrees(np.arctan(10 / dy)), rel=1e-6)
    # same east-west gradient per cell is steeper at 60N because cells are narrower
    zx = np.ones((50, 1)) * np.arange(50)[None, :] * 10.0
    s_eq = np.nanmedian(grid.slope_deg_latlon(zx, top_lat=0.2, res_deg=res))
    s_60 = np.nanmedian(grid.slope_deg_latlon(zx, top_lat=60.2, res_deg=res))
    assert s_60 > s_eq
    assert np.isnan(grid.slope_deg_latlon(z, 0.2, res)[0, 0])  # borders excluded


def test_hargreaves_pet_never_negative_in_extreme_cold():
    pet = grid.hargreaves_pet_mm_day(np.array(-40.0), np.array(-35.0), np.array(-45.0), np.array(5.0))
    assert pet == 0.0
    assert np.isnan(grid.aridity_index(np.array(0.01), pet))


def test_slope_uses_planet_scale():
    res = 1 / 64
    z = np.arange(20)[:, None] * np.ones((1, 20)) * 10.0
    earth = np.nanmedian(grid.slope_deg_latlon(z, 0.2, res, grid.METRES_PER_DEG["earth"]))
    mars = np.nanmedian(grid.slope_deg_latlon(z, 0.2, res, grid.METRES_PER_DEG["mars"]))
    assert mars > earth  # same angular step is shorter on smaller Mars, so the same rise is steeper


def test_cell_terrain_stats():
    z = np.array([[0.0, 2.0], [4.0, np.nan]])
    s = np.array([[1.0, 3.0], [np.nan, 5.0]])
    out = grid.cell_terrain_stats(z, s)
    assert out == {"slope_median_deg": 3.0, "slope_p90_proxy_deg": 5.0, "elev_std_m": pytest.approx(np.std([0, 2, 4]))}
