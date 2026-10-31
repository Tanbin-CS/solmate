"""Full explanation of one Earth place against one target: the VerdictCard data.

matches        dimensions in the strong band, best first
differs        weak dimensions and dimensions without data
breaks_down    always-on environment limits, Earth-can-only-approach gaps, vegetation
process_tags   Earth processes that teach about the target body
use_it_for     exploration uses the place supports
"""

from __future__ import annotations

import math

import numpy as np

from solmate.compute import aggregate, breakdown, processes, score
from solmate.compute import modes as m


def explain(values: dict[str, float], target: dict, dims_config: dict, stats: dict[str, m.EarthStats],
            process_config: dict, weights: dict[str, float] | None = None) -> dict:
    """weights: dimension weights (a preset); default equal over the target's dimensions, operations off."""
    body = target["body"]
    if weights is None:
        weights = {k: 1.0 for k in dims_config if k != "O"}
    applicable = [k for k, d in dims_config.items() if body in d["applies_to"] and weights.get(k, 0.0) > 0]
    dim_scores: dict[str, float] = {}
    all_plans = []
    for k in applicable:
        plans = score.plan_dimension(dims_config[k], target["indicators"], stats)
        all_plans += plans
        if not plans:
            dim_scores[k] = math.nan
            continue
        layer = {p.name: np.array([values.get(p.name, math.nan)], dtype=float) for p in plans}
        d, _ = score.dimension_scores(layer, plans, stats)
        dim_scores[k] = float(d[0])
    result = aggregate.sai(dim_scores, {k: float(weights[k]) for k in applicable})
    strong = sorted((d for d in result.dimensions if d.band == "strong"), key=lambda d: -d.score)
    limits = (breakdown.environment_limits(target.get("breaks_down", {}), values.get("surface_pressure_hpa", math.nan))
              + breakdown.toward_gaps(values, all_plans, stats)
              + breakdown.vegetation_flag(values))
    return {
        "target": target["id"],
        "sai": None if not math.isfinite(result.sai) else round(result.sai, 2),
        "coverage": round(result.coverage, 3),
        "insufficient": result.insufficient,
        "dimensions": [{"id": d.id, "name": breakdown.DIMENSION_NAMES.get(d.id, d.id),
                        "score": None if not math.isfinite(d.score) else round(d.score, 4),
                        "band": d.band, "contribution": round(d.contribution, 4)} for d in result.dimensions],
        "matches": [{"id": d.id, "text": f"{breakdown.DIMENSION_NAMES.get(d.id, d.id)} matches (score {d.score:.2f})."}
                    for d in strong],
        "differs": breakdown.dimension_limits(dim_scores, applicable),
        "breaks_down": limits,
        "process_tags": processes.tags_for(values, body, process_config, stats),
        "use_it_for": processes.uses_for(values, process_config, stats),
    }
