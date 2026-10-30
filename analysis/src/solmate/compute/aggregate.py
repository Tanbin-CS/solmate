"""Roll indicator similarities up to dimension sub-scores and the SolMate Analog Index (SAI).

D_k  = weighted mean of the available indicator similarities in dimension k
SAI  = 100 * sum(W_k D_k) / sum(W_k) over dimensions that apply to the target and have data
coverage = sum(W_k available) / sum(W_k applicable); below MIN_COVERAGE the score is flagged
contribution_k = W_k D_k / sum(W_k)  (share of the SAI each dimension carries)
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

MIN_COVERAGE = 0.6
BANDS = ((0.75, "strong"), (0.40, "partial"), (0.0, "weak"))


def band(score01: float) -> str:
    """Verdict band for a 0-1 score: strong >= 0.75, partial >= 0.40, else weak."""
    for lo, name in BANDS:
        if score01 >= lo:
            return name
    return "weak"


def weighted_mean(values: np.ndarray, weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """NaN-aware weighted mean over the last axis; returns (mean, share of weight available)."""
    v = np.asarray(values, dtype=float)
    w = np.broadcast_to(np.asarray(weights, dtype=float), v.shape)
    ok = np.isfinite(v)
    wsum = w.sum(axis=-1)
    wok = np.where(ok, w, 0.0).sum(axis=-1)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(wok > 0, np.where(ok, v * w, 0.0).sum(axis=-1) / wok, np.nan)
        share = np.where(wsum > 0, wok / wsum, 0.0)
    return mean, share


@dataclass
class DimensionResult:
    id: str
    score: float  # 0-1, NaN if no data
    weight: float
    contribution: float  # share of the SAI (0-1)
    coverage: float  # share of indicator weight with data
    band: str


@dataclass
class SAIResult:
    sai: float  # 0-100, NaN if nothing applies
    coverage: float
    insufficient: bool
    dimensions: list[DimensionResult] = field(default_factory=list)


def sai(dim_scores: dict[str, float], dim_weights: dict[str, float],
        dim_coverage: dict[str, float] | None = None) -> SAIResult:
    """SAI for one place from per-dimension scores (NaN = no data) and weights (0 = off)."""
    ids = [k for k, w in dim_weights.items() if w > 0]
    scores = np.array([dim_scores.get(k, np.nan) for k in ids], dtype=float)
    weights = np.array([dim_weights[k] for k in ids], dtype=float)
    mean, cov = weighted_mean(scores, weights)
    ok = np.isfinite(scores)
    wok = weights[ok].sum()
    dims = []
    for k, s, w in zip(ids, scores, weights, strict=True):
        contrib = float(w * s / wok) if np.isfinite(s) and wok > 0 else 0.0
        dims.append(DimensionResult(k, float(s), float(w), contrib,
                                    float((dim_coverage or {}).get(k, 1.0 if np.isfinite(s) else 0.0)),
                                    band(float(s)) if np.isfinite(s) else "n/a"))
    total = float(mean) * 100.0 if np.isfinite(mean) else float("nan")
    return SAIResult(total, float(cov), bool(cov < MIN_COVERAGE), dims)
