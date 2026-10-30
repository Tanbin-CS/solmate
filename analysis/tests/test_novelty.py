import numpy as np
import pytest

from solmate.compute import novelty


def test_haversine_known_distances():
    assert novelty.haversine_km(0.0, 0.0, 0.0, 1.0) == pytest.approx(111.195, rel=1e-4)
    assert novelty.haversine_km(90.0, 0.0, -90.0, 0.0) == pytest.approx(np.pi * novelty.EARTH_RADIUS_KM)
    assert novelty.haversine_km(10.0, 179.9, 10.0, -179.9) < 25  # across the antimeridian


def test_nearest_known_site():
    sites = [{"lat": 0.0, "lon": 0.0}, {"lat": 10.0, "lon": 10.0}]
    d, i = novelty.nearest_known(np.array([1.0, 9.0]), np.array([0.0, 10.0]), sites)
    assert i.tolist() == [0, 1]
    assert d[0] == pytest.approx(111.195, rel=1e-3)


def test_spaced_top_suppresses_neighbours_and_skips_nan():
    scores = np.array([0.9, 0.95, 0.5, np.nan, 0.8])
    lat = np.array([0.0, 0.1, 5.0, 9.0, 10.0])
    lon = np.zeros(5)
    assert novelty.spaced_top(scores, lat, lon, n=10, min_km=50) == [1, 4, 2]
    assert novelty.spaced_top(scores, lat, lon, n=1, min_km=50) == [1]
