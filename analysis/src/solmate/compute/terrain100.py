"""100 m (stage-2) terrain score of a window against a target.

Indicators: median slope, steep-slope tail (p90) and hypsometric integral. Local relief and
ruggedness are kept for display but not scored, because they correlate with median slope at
r ~ 0.98 (v1 finding) and would triple-count roughness. Earth statistics for these indicators
come from the pool of refined 100 m windows (stage2_stats), not from the 0.1 degree stack.
"""

from __future__ import annotations

import math

import numpy as np

from solmate.compute import modes, score

SCORED = ("slope_median", "slope_p90", "hypsometric_integral")


def plans(target_values: dict[str, float], stats: dict[str, modes.EarthStats]) -> list[score.IndicatorPlan]:
    out = []
    for name in SCORED:
        t = target_values.get(name)
        if t is None or not math.isfinite(t) or name not in stats:
            continue
        out.append(score.IndicatorPlan(name, 1.0, float(t), modes.choose_mode(float(t), stats[name])))
    return out


def terrain_score(indicators: dict[str, float], target_values: dict[str, float],
                  stats: dict[str, modes.EarthStats]) -> tuple[float, dict[str, float]]:
    """(score 0-1, per-indicator similarity) for one window; NaN score if nothing comparable."""
    per = {}
    for p in plans(target_values, stats):
        x = indicators.get(p.name)
        if x is None or not math.isfinite(x):
            continue
        per[p.name] = float(modes.similarity(np.array([x]), p.target, stats[p.name], p.mode)[0])
    return (float(np.mean(list(per.values()))) if per else float("nan")), per
