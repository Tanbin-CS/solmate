from solmate.pipeline import report


def test_markdown_renders_every_block_type():
    md = report.to_markdown([
        {"type": "h2", "text": "Title"},
        {"type": "p", "text": "Body."},
        {"type": "ul", "items": ["a", "b"]},
        {"type": "table", "head": ["x", "y"], "rows": [["1", "2"]]},
        {"type": "figure", "images": [{"src": "https://x/y.jpg", "alt": "alt", "caption": "cap"}]},
    ])
    assert "## Title" in md and "- a\n- b" in md and "| x | y |\n|---|---|\n| 1 | 2 |" in md
    assert "![alt](https://x/y.jpg)" in md and "*cap*" in md


def test_regions_and_names():
    assert report.region(37.05, 86.75) == "Tibetan Plateau"
    assert report.region(-27.85, -69.15) == "Puna de Atacama"
    assert report.region(0, 0) is None
    assert report.site_name("mdrs-utah") == "MDRS (Utah)" and report.site_name("lake-salda") == "Lake Salda"


def test_report_from_published_data_has_both_case_studies_and_every_target():
    data = report.load()
    blocks = report.build(data)
    heads = [b["text"] for b in blocks if b["type"] == "h2"]
    assert sum(h.startswith("Case study") for h in heads) == 2
    table = next(b for b in blocks if b["type"] == "table" and b["head"][0] == "Target")
    assert len(table["rows"]) == len(data["targets"])
