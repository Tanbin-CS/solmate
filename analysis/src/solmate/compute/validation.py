"""Validation statistics for the SAI: AUC with bootstrap CI, robustness and learned weights.

All randomness uses explicit seeds so results are reproducible.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize


def auc(pos: np.ndarray, neg: np.ndarray) -> float:
    """Probability that a random positive outscores a random negative (ties count half)."""
    p = np.asarray(pos, dtype=float)[:, None]
    n = np.asarray(neg, dtype=float)[None, :]
    return float(((p > n).sum() + 0.5 * (p == n).sum()) / (p.size * n.size))


def bootstrap_auc_ci(pos: np.ndarray, neg: np.ndarray, n_boot: int = 1000, seed: int = 2026,
                     level: float = 0.95) -> tuple[float, float]:
    """Percentile CI of the AUC from resampling positives and negatives with replacement."""
    rng = np.random.default_rng(seed)
    pos, neg = np.asarray(pos, float), np.asarray(neg, float)
    stats = [auc(rng.choice(pos, pos.size), rng.choice(neg, neg.size)) for _ in range(n_boot)]
    a = (1 - level) / 2
    return float(np.quantile(stats, a)), float(np.quantile(stats, 1 - a))


def weighted_scores(dims: np.ndarray, w: np.ndarray) -> np.ndarray:
    """NaN-aware weighted mean over the last axis (dims: sites x dimensions)."""
    ok = np.isfinite(dims)
    ww = np.where(ok, w, 0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(ww.sum(-1) > 0, np.where(ok, dims, 0.0) @ w / ww.sum(-1), np.nan)


def dirichlet_auc(dims_pos: np.ndarray, dims_neg: np.ndarray, n: int = 1000, seed: int = 2026) -> np.ndarray:
    """AUCs under random weight vectors drawn uniformly from the simplex."""
    rng = np.random.default_rng(seed)
    ws = rng.dirichlet(np.ones(dims_pos.shape[1]), size=n)
    return np.array([auc(weighted_scores(dims_pos, w), weighted_scores(dims_neg, w)) for w in ws])


def fit_nonneg_logistic(x: np.ndarray, y: np.ndarray, l2: float = 1.0) -> tuple[np.ndarray, float]:
    """L2-regularised logistic regression with non-negative coefficients (bias unconstrained).

    Non-negativity keeps the learned weights interpretable: a dimension can only add
    to analog-likeness. Missing dimension scores are imputed with the column mean.
    """
    x = np.where(np.isfinite(x), x, np.nanmean(x, axis=0))
    d = x.shape[1]

    def loss(theta: np.ndarray) -> tuple[float, np.ndarray]:
        w, b = theta[:d], theta[d]
        z = x @ w + b
        p = 1.0 / (1.0 + np.exp(-z))
        eps = 1e-12
        nll = -np.mean(y * np.log(p + eps) + (1 - y) * np.log(1 - p + eps))
        g = (p - y) / y.size
        return nll + 0.5 * l2 * w @ w, np.concatenate([x.T @ g + l2 * w, [g.sum()]])

    res = minimize(loss, np.zeros(d + 1), jac=True, method="L-BFGS-B",
                   bounds=[(0, None)] * d + [(None, None)])
    return res.x[:d], float(res.x[d])


def cv_learned_auc(x: np.ndarray, y: np.ndarray, folds: int = 5, repeats: int = 10, seed: int = 2026,
                   l2: float = 1.0) -> tuple[float, float, float]:
    """Repeated stratified k-fold out-of-fold AUC of the learned weights: (median, p5, p95)."""
    rng = np.random.default_rng(seed)
    aucs = []
    pos_idx, neg_idx = np.flatnonzero(y == 1), np.flatnonzero(y == 0)
    for _ in range(repeats):
        oof = np.full(y.size, np.nan)
        pf = np.array_split(rng.permutation(pos_idx), folds)
        nf = np.array_split(rng.permutation(neg_idx), folds)
        for k in range(folds):
            test = np.concatenate([pf[k], nf[k]])
            train = np.setdiff1d(np.arange(y.size), test)
            w, _ = fit_nonneg_logistic(x[train], y[train], l2)
            oof[test] = weighted_scores(x[test], w if w.sum() > 0 else np.ones_like(w))
        aucs.append(auc(oof[y == 1], oof[y == 0]))
    return float(np.median(aucs)), float(np.quantile(aucs, 0.05)), float(np.quantile(aucs, 0.95))


# --- Regional validation (docs/VALIDATION.md, addendum 1) ---------------------------------


def single_linkage_regions(lat: np.ndarray, lon: np.ndarray, km: float = 500.0) -> np.ndarray:
    """Region label per site: sites joined by a chain of great-circle gaps below `km` share one."""
    from solmate.compute.novelty import haversine_km

    lat, lon = np.asarray(lat, float), np.asarray(lon, float)
    n = lat.size
    parent = np.arange(n)

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(n):
        d = haversine_km(lat, lon, lat[i], lon[i])
        for j in np.flatnonzero(d < km):
            ri, rj = find(i), find(int(j))
            if ri != rj:
                parent[max(ri, rj)] = min(ri, rj)
    roots = np.array([find(i) for i in range(n)])
    _, labels = np.unique(roots, return_inverse=True)
    return labels


def region_weights(labels: np.ndarray) -> np.ndarray:
    """1 / (sites in the region), so each region carries a total weight of one."""
    counts = np.bincount(labels)
    return 1.0 / counts[labels]


def weighted_auc(pos: np.ndarray, neg: np.ndarray, w_pos: np.ndarray, w_neg: np.ndarray) -> float:
    """AUC with a weight on every positive-negative pair (ties count half)."""
    p = np.asarray(pos, float)[:, None]
    n = np.asarray(neg, float)[None, :]
    w = np.asarray(w_pos, float)[:, None] * np.asarray(w_neg, float)[None, :]
    return float(((p > n) * w + 0.5 * (p == n) * w).sum() / w.sum())


def block_bootstrap_auc_ci(pos: np.ndarray, neg: np.ndarray, g_pos: np.ndarray, g_neg: np.ndarray,
                           n_boot: int = 1000, seed: int = 2026, level: float = 0.95) -> tuple[float, float]:
    """Percentile CI of the AUC when whole regions, not sites, are resampled."""
    rng = np.random.default_rng(seed)
    pos, neg = np.asarray(pos, float), np.asarray(neg, float)
    rp = [np.flatnonzero(g_pos == r) for r in np.unique(g_pos)]
    rn = [np.flatnonzero(g_neg == r) for r in np.unique(g_neg)]
    stats = []
    for _ in range(n_boot):
        ip = np.concatenate([rp[k] for k in rng.integers(0, len(rp), len(rp))])
        ineg = np.concatenate([rn[k] for k in rng.integers(0, len(rn), len(rn))])
        stats.append(auc(pos[ip], neg[ineg]))
    a = (1 - level) / 2
    return float(np.quantile(stats, a)), float(np.quantile(stats, 1 - a))


def loro_learned_auc(x: np.ndarray, y: np.ndarray, groups: np.ndarray, l2: float = 1.0) -> float:
    """Leave-one-region-out AUC of learned weights: each region is scored by a fit without it."""
    oof = np.full(y.size, np.nan)
    for g in np.unique(groups):
        test = groups == g
        train = ~test
        if len(np.unique(y[train])) < 2:
            continue
        w, _ = fit_nonneg_logistic(x[train], y[train], l2)
        oof[test] = weighted_scores(x[test], w if w.sum() > 0 else np.ones_like(w))
    ok = np.isfinite(oof)
    return auc(oof[ok & (y == 1)], oof[ok & (y == 0)])
