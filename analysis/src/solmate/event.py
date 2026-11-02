"""Event-day datasets (config/event_layers.yaml): load and check every entry before use.

A mistake in the config should fail here, with a message that says what to fix, not halfway
through a pipeline run. See docs/EVENT_DAY.md.
"""

from __future__ import annotations

import json
import re
from importlib import resources
from pathlib import Path

import yaml

from solmate.io.generic import ID_RE, LayerError, Source

DATA = Path(__file__).resolve().parents[3] / "data"
TARGET_SAMPLES = DATA / "targets" / "event.v2.json"
ROLES = ("context", "scored")
REQUIRED = ("id", "name", "units", "source", "url", "licence", "role", "earth")


def _cfg(name: str) -> dict:
    with resources.files("solmate.config").joinpath(name).open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load(config: dict | None = None, dimensions: dict | None = None, target_ids: dict[str, str] | None = None
         ) -> list[dict]:
    """Checked layer entries. Arguments override the packaged configs (for tests)."""
    doc = _cfg("event_layers.yaml") if config is None else config
    dims = (_cfg("dimensions.yaml") if dimensions is None else dimensions)["dimensions"]
    if target_ids is None:
        target_ids = {t["id"]: t["body"] for t in _cfg("targets.yaml")["targets"]}
    scored_in_dims = {i for d in dims.values() for i in d["indicators"]}
    layers, seen = [], set()
    for n, e in enumerate(doc.get("layers") or []):
        where = f"event_layers.yaml layer {n + 1} ({e.get('id', '?')})"
        missing = [k for k in REQUIRED if not e.get(k)]
        if missing:
            raise LayerError(f"{where}: missing {', '.join(missing)}")
        if not ID_RE.match(e["id"]) or e["id"] in seen:
            raise LayerError(f"{where}: id must be unique snake_case (3-41 characters)")
        seen.add(e["id"])
        if not re.match(r"^https://[^\s]+$", str(e["url"])):
            raise LayerError(f"{where}: url must be https")
        if e["role"] not in ROLES:
            raise LayerError(f"{where}: role must be one of {ROLES}")
        Source.from_config(e["earth"])
        in_dims = e["id"] in scored_in_dims
        if e["role"] == "scored" and not in_dims:
            raise LayerError(f"{where}: role scored, so list {e['id']} under a dimension in dimensions.yaml")
        if e["role"] == "context" and in_dims:
            raise LayerError(f"{where}: role context, but dimensions.yaml scores it; set role: scored")
        t = e.get("targets") or {}
        for tid in (t.get("values") or {}):
            if tid not in target_ids:
                raise LayerError(f"{where}: unknown target {tid}")
            if "value" not in t["values"][tid] or not (t["values"][tid].get("url") or t["values"][tid].get("doi")):
                raise LayerError(f"{where}: target {tid} needs a value and a url or doi")
        d = e.get("download")
        if d is not None:
            if not re.match(r"^[A-Za-z0-9_.-]{2,60}$", str(d.get("short_name", ""))) or not d.get("version"):
                raise LayerError(f"{where}: download needs the CMR short_name and version")
            dates = [str(x) for x in d.get("temporal") or []]  # YAML reads unquoted dates as dates
            e = {**e, "download": {**d, "temporal": dates or None}}
            if dates and not (len(dates) == 2 and all(re.match(r"^\d{4}-\d{2}-\d{2}$", str(x)) for x in dates)):
                raise LayerError(f"{where}: download.temporal must be [YYYY-MM-DD, YYYY-MM-DD]")
        if t.get("sample") and t["sample"].get("body") not in ("moon", "mars"):
            raise LayerError(f"{where}: targets.sample.body must be moon or mars")
        if e["role"] == "scored":
            bodies = {b for d in dims.values() if e["id"] in d["indicators"] for b in d["applies_to"]}
            sampled = t.get("sample", {}).get("body") if t.get("sample") else None
            lacking = [tid for tid, body in target_ids.items()
                       if body in bodies and body != sampled and tid not in (t.get("values") or {})]
            if lacking:
                raise LayerError(f"{where}: role scored needs a target value for {', '.join(lacking)}")
        layers.append({**e, "digits": int(e.get("digits", 2))})
    return layers


def layer_info(layers: list[dict] | None = None) -> dict[str, tuple[str, str]]:
    """(units, source) per event layer, the same shape as build_stack.LAYER_INFO."""
    return {e["id"]: (e["units"], e["source"]) for e in (load() if layers is None else layers)}


def context_layers(layers: list[dict] | None = None) -> list[dict]:
    """What the web app needs to show each event layer in the place panel."""
    return [{k: e[k] for k in ("id", "name", "units", "digits", "source", "url", "role")}
            for e in (load() if layers is None else layers)]


def target_values(layers: list[dict] | None = None, samples_path: Path = TARGET_SAMPLES) -> dict[str, dict[str, dict]]:
    """{target id: {indicator: entry}} from cited values and computed samples."""
    layers = load() if layers is None else layers
    samples = json.loads(samples_path.read_text(encoding="utf-8"))["targets"] if samples_path.exists() else {}
    out: dict[str, dict[str, dict]] = {}
    for e in layers:
        for tid, v in ((e.get("targets") or {}).get("values") or {}).items():
            out.setdefault(tid, {})[e["id"]] = {"unit": e["units"], "method": v.get("method", "literature"), **v}
        for tid, v in samples.get(e["id"], {}).items():
            out.setdefault(tid, {})[e["id"]] = {"unit": e["units"], "method": "computed", **v}
    return out
