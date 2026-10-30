"""Distances to known analog sites and spaced top-N selection."""

from __future__ import annotations

import numpy as np

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: np.ndarray, lon1: np.ndarray, lat2: np.ndarray, lon2: np.ndarray) -> np.ndarray:
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlmb = np.radians(lon2) - np.radians(lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))


def nearest_known(lat: np.ndarray, lon: np.ndarray, sites: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Distance (km) to, and index of, the nearest known site for each place."""
    best = np.full(np.shape(lat), np.inf)
    idx = np.full(np.shape(lat), -1, dtype=int)
    for i, s in enumerate(sites):
        d = haversine_km(lat, lon, s["lat"], s["lon"])
        closer = d < best
        best = np.where(closer, d, best)
        idx = np.where(closer, i, idx)
    return best, idx


def spaced_top(scores: np.ndarray, lat: np.ndarray, lon: np.ndarray, n: int, min_km: float) -> list[int]:
    """Greedy non-maximum suppression: indices of up to n best scores at least min_km apart.

    Ties are broken by index for determinism. NaN scores are never selected.
    """
    order = np.lexsort((np.arange(scores.size), -np.nan_to_num(scores, nan=-np.inf)))
    chosen: list[int] = []
    for i in order:
        if not np.isfinite(scores[i]):
            break
        if chosen and np.min(haversine_km(lat[i], lon[i], lat[chosen], lon[chosen])) < min_km:
            continue
        chosen.append(int(i))
        if len(chosen) == n:
            break
    return chosen
