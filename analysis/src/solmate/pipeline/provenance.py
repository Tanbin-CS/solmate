"""Provenance for the web Data page: datasets, stack layers, raw files and validation sites.

Built from the files that already record it, so the page cannot drift from them:
  docs/DATA_SOURCES.md         dataset tables (agency, product, use, terms), one table per section
  data/stack/layers.v2.json    the Earth layers: units, NASA source, land coverage, percentiles
  data/manifest.v2.json        every downloaded NASA file with URL, size and sha256
  config/validation_sites.yaml analog sites and controls used by the validation
"""

from __future__ import annotations

import re
from collections import defaultdict
from urllib.parse import urlparse


def parse_markdown_tables(md: str) -> list[dict]:
    """Rows of every pipe table, each tagged with the nearest preceding '## ' heading."""
    rows: list[dict] = []
    section, header = "", None
    for line in md.splitlines():
        s = line.strip()
        if s.startswith("## "):
            section, header = s[3:].strip(), None
            continue
        if not s.startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if header is None:
            header = cells
        elif all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            continue
        else:
            rows.append({"section": section, **dict(zip(header, cells, strict=False))})
    return rows


def _clean(text: str) -> str:
    """Markdown inline code and emphasis to plain text."""
    return re.sub(r"[`*]", "", text).strip()


def datasets(md: str) -> list[dict]:
    out = []
    for r in parse_markdown_tables(md):
        name = r.get("Dataset") or r.get("Source") or ""
        if not name:  # another kind of table (e.g. the MODIS-to-VIIRS mapping), not a dataset list
            continue
        out.append({
            "section": r["section"],
            "name": _clean(name),
            "agency": _clean(r.get("Agency / product") or r.get("Publisher") or ""),
            "detail": _clean(r.get("Version, period", "")),
            "use": _clean(r.get("Used for (dimension)") or r.get("Used for") or ""),
            "terms": _clean(r.get("Terms", "")),
        })
    return out


def raw_files(manifest: dict) -> dict:
    by: dict[str, dict] = defaultdict(lambda: {"files": 0, "bytes": 0, "first": None, "last": None, "host": None})
    for f in manifest["files"]:
        p = by[f["product"]]
        p["files"] += 1
        p["bytes"] += int(f.get("bytes") or 0)
        t = (f.get("time_start") or "")[:10] or None
        if t:
            p["first"] = min(filter(None, [p["first"], t]))
            p["last"] = max(filter(None, [p["last"], t]))
        p["host"] = p["host"] or urlparse(f.get("url", "")).netloc or None
    products = [{"product": k, **v} for k, v in sorted(by.items())]
    return {"files": len(manifest["files"]), "bytes": sum(p["bytes"] for p in products), "products": products}


def layers(doc: dict) -> list[dict]:
    out = []
    for name, m in doc["layers"].items():
        p = m.get("land_p1_p50_p99") or [None, None, None]
        out.append({"id": name, **({"name": m["name"]} if m.get("name") else {}), "units": m.get("units"),
                    "source": m.get("source"),
                    "land_coverage": round(float(m["land_coverage"]), 4) if m.get("land_coverage") is not None else None,
                    "p1": p[0], "p50": p[1], "p99": p[2]})
    return out


def build(md: str, layers_doc: dict, manifest: dict, sites: dict) -> dict:
    return {
        "version": 2,
        "generated_at": layers_doc.get("generated_at"),
        "grid": layers_doc.get("grid"),
        "datasets": datasets(md),
        "layers": layers(layers_doc),
        "raw": raw_files(manifest),
        "validation_sites": {"positives": sites["positives"], "controls": sites["controls"]},
    }
