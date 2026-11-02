"""Where an Earth analog breaks down, and what it is still good for. Deterministic rules.

The challenge asks every analog to state "which characteristics provide a strong
analogy, where the analogy breaks down, and how studying or using the analog could help".
This module turns numbers into those statements; it never invents a value.
"""

from __future__ import annotations

import math

from solmate.compute import modes

EARTH_GRAVITY = 9.81  # m/s^2
MOON_OBLIQUITY = 1.54  # degrees: the Moon's spin axis is nearly upright, so polar Sun stays low
EARTH_OBLIQUITY = 23.44  # degrees
EARTH_DOSE_MSV_DAY = 2.4 / 365.25  # UNSCEAR 2008 world-average natural background, 2.4 mSv/yr
WEAK_DIMENSION = 0.40
GAP_LIMIT = 0.5
VEGETATION_LIMIT = 30.0  # % of the cell
DIMENSION_NAMES = {"T": "Terrain", "C": "Climate & aridity", "Th": "Thermal", "S": "Surface & barrenness",
                   "M": "Mineralogy", "I": "Ice & cold-trap", "D": "Dust & wind", "O": "Mission operations"}


INDICATOR_LABELS = {
    "rh2m_pct": "Air humidity", "aridity_index": "Aridity (P/PET)", "precip_mm_day": "Precipitation",
    "lst_diurnal_range_k": "Day-night surface temperature swing", "lst_night_min_k": "Coldest night surface temperature",
    "t2m_mean_c": "Mean temperature", "t2m_coldest_month_c": "Coldest-season temperature",
    "albedo_wsa_sw": "Surface brightness (albedo)", "barren_pct": "Bare ground", "forest_pct": "Forest cover",
    "snow_months_per_year": "Months of snow/ice", "frost_days_per_year": "Frost days",
    "dust_aod_mean": "Atmospheric dust", "ws10m_m_s": "Wind speed", "slope_median_deg": "Typical slope",
    "slope_p90_proxy_deg": "Steepest slopes", "elev_std_m": "Local relief",
}


def _ratio_text(target: float, ref: float, ref_name: str = "Earth") -> str:
    r = target / ref
    if r >= 1:
        return f"{r:.1f}x {ref_name}"
    if r > 1e-3:
        return f"{r:.2f}x {ref_name}"
    return f"about 10^{math.floor(math.log10(r))} of {ref_name}"


def environment_limits(target_breaks_down: dict, earth_pressure_hpa: float) -> list[dict]:
    """Always-on limits: gravity, atmospheric pressure, radiation, magnetic shielding."""
    out = []
    g = target_breaks_down.get("gravity_m_s2", {}).get("value")
    if g is not None:
        out.append({"kind": "always", "id": "gravity", "earth": EARTH_GRAVITY, "target": g, "unit": "m/s^2",
                    "text": f"Gravity is {_ratio_text(g, EARTH_GRAVITY)}: Earth tests overload structures, wheels and people."})
    p = target_breaks_down.get("surface_pressure_hpa", {}).get("value")
    if p is not None and math.isfinite(earth_pressure_hpa):
        out.append({"kind": "always", "id": "pressure", "earth": round(earth_pressure_hpa, 1), "target": p, "unit": "hPa",
                    "text": f"Surface pressure is {_ratio_text(p, earth_pressure_hpa, 'this place')}: no Earth site "
                            "reproduces vacuum or the thin Martian air (heat transfer, dust lofting, boiling)."})
    d = target_breaks_down.get("radiation_dose_msv_day", {}).get("value")
    if d is not None:
        out.append({"kind": "always", "id": "radiation", "earth": round(EARTH_DOSE_MSV_DAY, 4), "target": d,
                    "unit": "mSv/day",
                    "text": f"Surface radiation dose is {_ratio_text(d, EARTH_DOSE_MSV_DAY)}: Earth's atmosphere and "
                            "magnetic field shield every analog site."})
    return out


def max_sun_elevation(lat: float, obliquity: float) -> float:
    """Highest noon Sun elevation over a year at a latitude (degrees), capped at 90."""
    return min(90.0, 90.0 - abs(lat) + obliquity)


def illumination_limit(body: str, target_lat: float | None, place_lat: float | None) -> list[dict]:
    """Moon only: polar sunlight stays near the horizon; compare with the place's midsummer noon Sun."""
    if body != "moon" or target_lat is None or place_lat is None:
        return []
    t = max_sun_elevation(target_lat, MOON_OBLIQUITY)
    e = max_sun_elevation(place_lat, EARTH_OBLIQUITY)
    return [{"kind": "always", "id": "illumination", "earth": round(e, 1), "target": round(t, 1), "unit": "deg",
             "text": f"Sunlight: in this region the Sun never rises more than {t:.0f}° above the horizon, so long "
                     f"shadows and low light shape every operation. At this place on Earth the midsummer noon Sun "
                     f"reaches {e:.0f}°."}]


def subsurface_limit() -> list[dict]:
    """Always stated: remote data see only the surface."""
    return [{"kind": "always", "id": "subsurface",
             "text": "Caves, lava tubes and other underground environments are not assessed: satellite data see "
                     "only the surface. Documented cave and mine analogs are listed in the findings."}]


def dimension_limits(dim_scores: dict[str, float], applicable: list[str]) -> list[dict]:
    """Dimensions that score weak ("differs") or have no data ("not assessed")."""
    out = []
    for k in applicable:
        s = dim_scores.get(k)
        name = DIMENSION_NAMES.get(k, k)
        if s is None or not math.isfinite(s):
            out.append({"kind": "not_assessed", "id": k, "text": f"{name}: no data for this place or target."})
        elif s < WEAK_DIMENSION:
            out.append({"kind": "differs", "id": k, "score": round(s, 3), "text": f"{name} differs (score {s:.2f})."})
    return out


def toward_gaps(values: dict[str, float], plans: list, stats: dict[str, modes.EarthStats]) -> list[dict]:
    """Indicators where the target lies beyond anything on Earth and this place is far from it."""
    out = []
    for p in plans:
        if p.mode.kind != "toward" or p.target is None:
            continue
        x = values.get(p.name)
        if x is None or not math.isfinite(x):
            continue
        gap = modes.toward_gap(x, p.target, stats[p.name])
        if gap > GAP_LIMIT:
            out.append({"kind": "earth_can_only_approach", "id": p.name, "earth": round(x, 3), "target": p.target,
                        "gap": round(gap, 3),
                        "text": f"{INDICATOR_LABELS.get(p.name, p.name)}: the target value ({p.target:g}) lies beyond "
                                f"every place on Earth; this place gets {(1 - gap) * 100:.0f}% of the way from "
                                "Earth's typical value."})
    return out


def vegetation_flag(values: dict[str, float]) -> list[dict]:
    veg = sum(values.get(k, 0.0) or 0.0 for k in ("forest_pct", "shrub_pct", "grass_savanna_pct", "cropland_pct",
                                                    "wetland_pct"))
    if veg > VEGETATION_LIMIT:
        return [{"kind": "vegetation", "id": "vegetation", "earth": round(veg, 1), "unit": "%",
                 "text": f"{veg:.0f}% vegetation cover: biology and soils have no lunar or Martian counterpart, and "
                         "canopy inflates surface-model terrain."}]
    return []
