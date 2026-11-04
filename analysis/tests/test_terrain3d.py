import numpy as np
import pytest

from solmate.pipeline import terrain3d


def test_encode_round_trip_keeps_heights_within_quantisation():
    rng = np.random.default_rng(1)
    z = rng.uniform(-400, 5200, (20, 20)).astype(np.float32)
    z[3, 4] = np.nan
    buf, lo, hi = terrain3d.encode(z)
    assert len(buf) == 20 * 20 * 2
    back = terrain3d.decode(buf, 20, lo, hi)
    assert np.isnan(back[3, 4])
    ok = np.isfinite(z)
    assert np.nanmax(np.abs(back[ok] - z[ok])) <= (hi - lo) / 65534


def test_encode_flat_window_and_empty_window():
    buf, lo, hi = terrain3d.encode(np.full((4, 4), 12.5, dtype=np.float32))
    assert lo == hi == 12.5
    assert np.allclose(terrain3d.decode(buf, 4, lo, hi), 12.5)
    with pytest.raises(ValueError):
        terrain3d.encode(np.full((4, 4), np.nan))


def test_leading_places_dedupes_and_records_targets():
    e = {"lat": 1.0, "lon": 2.0}
    screen = {"targets": {"a": {"top": [e, {"lat": 3.0, "lon": 4.0}], "novel_leads": [e]}, "b": {"top": [e], "novel_leads": []}}}
    places = terrain3d.leading_places(screen, top=1, novel=1)
    assert list(places) == ["earth_1.000_2.000"]
    assert places["earth_1.000_2.000"]["for"] == ["a", "b"]
    assert terrain3d.place_id(-1.5, -70.25) == "earth_m1.500_m70.250"
