"""Water-ice stability statistics over a window of LRO Diviner Polar Resource Product triangles.

Pure: no I/O. The PRP `ice_depth` is the depth (m) at which water ice would sublimate at 1 kg m-2 per
billion years: 0 means ice is stable at the surface, -999 means deeper than 2.87 m.
"""

from __future__ import annotations

import numpy as np

INVALID = -999.0
DRILL_DEPTH_M = 1.0


def ice_stats(depth: np.ndarray, area: np.ndarray, temp_avg: np.ndarray, temp_max: np.ndarray) -> dict:
    """Area-weighted ice stability over one window. Triangles without a temperature are left out."""
    ok = (temp_avg != INVALID) & np.isfinite(depth) & (area > 0)
    if not ok.any():
        raise ValueError("no PRP triangles with data in the window")
    d, w = depth[ok], area[ok]
    stable = d != INVALID
    total = w.sum()
    return {
        "ice_stable_surface_pct": round(float(100 * w[stable & (d == 0)].sum() / total), 1),
        "ice_stable_1m_pct": round(float(100 * w[stable & (d >= 0) & (d <= DRILL_DEPTH_M)].sum() / total), 1),
        "temp_avg_median_k": round(float(np.median(temp_avg[ok])), 1),
        "temp_max_median_k": round(float(np.median(temp_max[ok][temp_max[ok] != INVALID])), 1),
        "n_triangles": int(ok.sum()),
    }
