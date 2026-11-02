"""Evaluate process-analog tags and "use it for" rules from processes.yaml."""

from __future__ import annotations

import math

from solmate.compute import modes


def condition_holds(value: float | None, cond: dict, stats: modes.EarthStats | None) -> bool:
    if value is None or not math.isfinite(value):
        return False
    for op, ref in cond.items():
        if op == "gte" and not value >= ref:
            return False
        if op == "lt" and not value < ref:
            return False
        if op == "gte_earth_quantile":
            if stats is None or not value >= stats.quantiles[int(ref)]:
                return False
    return True


def rule_fires(when: dict, values: dict[str, float], stats: dict[str, modes.EarthStats]) -> bool:
    return all(condition_holds(values.get(k), c, stats.get(k)) for k, c in when.items())


def tags_for(values: dict[str, float], body: str, config: dict, stats: dict[str, modes.EarthStats]) -> list[dict]:
    out = []
    for tid, t in config["tags"].items():
        if body in t["bodies"] and rule_fires(t["when"], values, stats):
            out.append({"id": tid, "name": t["name"], "analog": t["analog"],
                        "evidence": {k: round(values[k], 3) for k in t["when"]}})
    return out


def uses_for(values: dict[str, float], config: dict, stats: dict[str, modes.EarthStats]) -> list[dict]:
    return [{"id": u["id"], "text": u["text"]} for u in config["uses"] if rule_fires(u["when"], values, stats)]


def habitability_for(values: dict[str, float], body: str, config: dict, stats: dict[str, modes.EarthStats]) -> list[dict]:
    """Habitability and biology notes (never scored): the body's context, then every rule that holds."""
    h = config.get("habitability")
    if not h:
        return []
    out = [{"id": "context", "text": h["context"][body]}]
    for r in h["rules"]:
        if body in r["bodies"] and rule_fires(r["when"], values, stats):
            out.append({"id": r["id"], "text": r["text"], "evidence": {k: round(values[k], 3) for k in r["when"]}})
    return out
