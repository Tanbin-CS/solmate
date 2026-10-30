"""Per-indicator similarity modes for SolMate v2.

Earth cannot reach every Moon or Mars value (no place on Earth is as cold as a lunar
polar crater). Each indicator therefore uses one of two deterministic modes:

* match:  the target lies inside Earth's observed range [p1, p99]; similarity is a
          Gaussian of the robust-standardised distance, s = exp(-0.5 * ((x - t) / sigma)^2),
          with sigma = 1.4826 x MAD over a fixed global land sample.
* toward: the target lies beyond Earth's range; similarity is how far toward it a place
          gets among all land, s = ECDF(x) (target above) or 1 - ECDF(x) (target below).
          The remaining gap is reported under "breaks down".

The mode is chosen by rule, never by hand, from the target value and the Earth ECDF.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

MAD_TO_SIGMA = 1.4826
N_QUANTILES = 101  # 0, 1, ..., 100th percentile


@dataclass(frozen=True)
class EarthStats:
    """Distribution of one indicator over the fixed global land sample."""

    quantiles: tuple[float, ...]  # N_QUANTILES values, ascending
    median: float
    sigma: float  # robust scale, never zero

    @property
    def p1(self) -> float:
        return self.quantiles[1]

    @property
    def p99(self) -> float:
        return self.quantiles[99]


def _weighted_quantiles(v: np.ndarray, w: np.ndarray, probs: np.ndarray) -> np.ndarray:
    order = np.argsort(v)
    v, w = v[order], w[order]
    cw = np.cumsum(w)
    centre = (cw - 0.5 * w) / cw[-1]  # mid-point plotting positions
    return np.interp(probs, centre, v)


def earth_stats(values: np.ndarray, weights: np.ndarray | None = None) -> EarthStats:
    """Build EarthStats from sample values (NaN ignored).

    weights: optional per-value area weights (e.g. cos(latitude) on a lat/lon grid) so
    the distribution describes Earth's land area, not its grid-cell count.
    """
    v = np.asarray(values, dtype=float).ravel()
    w = np.ones_like(v) if weights is None else np.asarray(weights, dtype=float).ravel()
    ok = np.isfinite(v) & np.isfinite(w) & (w > 0)
    v, w = v[ok], w[ok]
    if v.size < 10:
        raise ValueError("need at least 10 finite values to describe Earth's distribution")
    probs = np.linspace(0.0, 1.0, N_QUANTILES)
    q = _weighted_quantiles(v, w, probs)
    med = float(_weighted_quantiles(v, w, np.array([0.5]))[0])
    mad = float(_weighted_quantiles(np.abs(v - med), w, np.array([0.5]))[0]) * MAD_TO_SIGMA
    std = float(np.sqrt(np.average((v - np.average(v, weights=w)) ** 2, weights=w)))
    sigma = mad if mad > 1e-12 else std if std > 1e-12 else 1.0
    return EarthStats(tuple(float(x) for x in q), med, sigma)


def ecdf(x: np.ndarray, stats: EarthStats) -> np.ndarray:
    """Fraction of Earth's land sample at or below x (piecewise-linear in the quantile table)."""
    q = np.asarray(stats.quantiles)
    probs = np.linspace(0.0, 1.0, N_QUANTILES)
    # np.interp needs strictly increasing xp; collapse ties to their mean probability
    uq, inv = np.unique(q, return_inverse=True)
    up = np.bincount(inv, weights=probs) / np.bincount(inv)
    return np.interp(np.asarray(x, dtype=float), uq, up, left=0.0, right=1.0)


@dataclass(frozen=True)
class Mode:
    kind: str  # "match" | "toward"
    direction: int  # +1 target above Earth's range, -1 below, 0 for match


def choose_mode(target: float, stats: EarthStats) -> Mode:
    """match if p1 <= target <= p99, else toward in the target's direction."""
    if stats.p1 <= target <= stats.p99:
        return Mode("match", 0)
    return Mode("toward", 1 if target > stats.p99 else -1)


def similarity(x: np.ndarray, target: float, stats: EarthStats, mode: Mode | None = None) -> np.ndarray:
    """Per-indicator similarity in [0, 1]; NaN where x is NaN."""
    m = mode or choose_mode(target, stats)
    x = np.asarray(x, dtype=float)
    if m.kind == "match":
        s = np.exp(-0.5 * ((x - target) / stats.sigma) ** 2)
    elif m.kind == "toward":
        p = ecdf(x, stats)
        s = p if m.direction > 0 else 1.0 - p
    else:
        raise ValueError(f"unknown mode {m.kind!r}")
    return np.where(np.isfinite(x), s, np.nan)


def toward_gap(x: float, target: float, stats: EarthStats) -> float:
    """Share of the way from Earth's median to the target that a place still lacks (0..1)."""
    span = target - stats.median
    if abs(span) < 1e-12:
        return 0.0
    return float(np.clip((target - x) / span, 0.0, 1.0))
