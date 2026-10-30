"""Score Earth places against one target: indicators -> dimensions -> SAI inputs.

Works on any array shape (a single place, a list of sites, or every land cell), so the
global screen, the API and the validation all share one implementation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from solmate.compute import aggregate, modes

# Mineral classes map to a direction on the ASTER Ninomiya indices (each rises with
# the mineral's abundance): True -> toward high, False -> toward low.
MINERAL_INDEX = {"mafic": "mafic_index", "carbonate": "carbonate_index", "quartz_rich": "quartz_index"}


@dataclass(frozen=True)
class IndicatorPlan:
    name: str
    weight: float
    target: float | None  # None for direction-only indicators (minerals, operations)
    mode: modes.Mode


def plan_dimension(dim: dict, target_indicators: dict, stats: dict[str, modes.EarthStats]) -> list[IndicatorPlan]:
    """Decide each indicator's mode for one dimension and one target (deterministic rules)."""
    plans = []
    mineral = target_indicators.get("mineral_class", {})
    for name, spec in dim["indicators"].items():
        w = float(spec.get("weight", 1.0))
        es = stats[name]
        if spec.get("direction") == "lower_is_better":
            plans.append(IndicatorPlan(name, w, None, modes.Mode("toward", -1)))
        elif name in MINERAL_INDEX.values():
            cls = next(k for k, v in MINERAL_INDEX.items() if v == name)
            if cls in mineral:
                plans.append(IndicatorPlan(name, w, None, modes.Mode("toward", 1 if mineral[cls] else -1)))
        else:
            entry = target_indicators.get(name)
            value = entry.get("value") if isinstance(entry, dict) else None
            if value is None:
                continue  # computed later (e.g. 100 m terrain) or not applicable
            plans.append(IndicatorPlan(name, w, float(value), modes.choose_mode(float(value), es)))
    return plans


def indicator_similarity(values: np.ndarray, plan: IndicatorPlan, es: modes.EarthStats) -> np.ndarray:
    if plan.target is None:  # direction-only: rank among Earth's land in that direction
        p = modes.ecdf(values, es)
        s = p if plan.mode.direction > 0 else 1.0 - p
        return np.where(np.isfinite(values), s, np.nan)
    return modes.similarity(values, plan.target, es, plan.mode)


def dimension_scores(layers: dict[str, np.ndarray], plans: list[IndicatorPlan],
                     stats: dict[str, modes.EarthStats]) -> tuple[np.ndarray, np.ndarray]:
    """Weighted mean similarity of a dimension's indicators and the share of weight with data."""
    if not plans:
        shape = next(iter(layers.values())).shape
        return np.full(shape, np.nan), np.zeros(shape)
    sims = np.stack([indicator_similarity(layers[p.name], p, stats[p.name]) for p in plans], axis=-1)
    w = np.array([p.weight for p in plans])
    return aggregate.weighted_mean(sims, w)


def sai_grid(dim_scores: dict[str, np.ndarray], dim_weights: dict[str, float]) -> tuple[np.ndarray, np.ndarray]:
    """Vectorised SAI (0-100) and coverage over arrays of dimension scores."""
    ids = [k for k, w in dim_weights.items() if w > 0 and k in dim_scores]
    if not ids:
        raise ValueError("no weighted dimension has scores")
    stack = np.stack([dim_scores[k] for k in ids], axis=-1)
    mean, cov = aggregate.weighted_mean(stack, np.array([dim_weights[k] for k in ids]))
    applicable = sum(w for w in dim_weights.values() if w > 0)
    cov = cov * sum(dim_weights[k] for k in ids) / applicable  # dimensions without plans count as missing
    return mean * 100.0, cov
