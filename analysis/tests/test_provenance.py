from pathlib import Path

from solmate.pipeline import provenance

REPO = Path(__file__).resolve().parents[2]

MD = """# Data sources

## Earth (scored)

| Dataset | Agency / product | Version, period | Used for (dimension) | Terms |
|---|---|---|---|---|
| MODIS LST | NASA LP DAAC `MYD11C3.061` (Aqua) | monthly 0.05° | Day/night temperature (Th) | NASA open data |

## Optional non-NASA extras (never needed for a score)

| Dataset | Publisher | Used for | Terms |
|---|---|---|---|
| Copernicus DEM | ESA | Cross-check | Free with attribution |
"""


def test_parses_each_section_and_strips_markdown():
    ds = provenance.datasets(MD)
    assert [d["section"] for d in ds] == ["Earth (scored)", "Optional non-NASA extras (never needed for a score)"]
    assert ds[0]["agency"] == "NASA LP DAAC MYD11C3.061 (Aqua)"
    assert ds[1]["agency"] == "ESA" and ds[1]["use"] == "Cross-check"


def test_raw_files_summarise_products():
    m = {"files": [
        {"product": "A", "bytes": 10, "time_start": "2023-02-01T00:00Z", "url": "https://x.nasa.gov/a"},
        {"product": "A", "bytes": 5, "time_start": "2023-01-01T00:00Z", "url": "https://x.nasa.gov/b"},
        {"product": "B", "bytes": 1, "url": "https://y.gov/c"},
    ]}
    r = provenance.raw_files(m)
    assert r["files"] == 3 and r["bytes"] == 16
    a = r["products"][0]
    assert (a["files"], a["first"], a["last"], a["host"]) == (2, "2023-01-01", "2023-02-01", "x.nasa.gov")


def test_real_data_sources_doc_is_fully_parsed():
    ds = provenance.datasets((REPO / "docs" / "DATA_SOURCES.md").read_text(encoding="utf-8"))
    assert len(ds) >= 20
    assert all(d["name"] for d in ds)
    assert any("ASTER GDEM" in d["name"] for d in ds)
