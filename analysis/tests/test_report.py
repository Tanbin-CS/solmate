from solmate.pipeline import report, report_images


def test_markdown_renders_every_block_type():
    md = report.to_markdown([
        {"type": "h2", "text": "Title"},
        {"type": "p", "text": "Body."},
        {"type": "ul", "items": ["a", "b"]},
        {"type": "table", "head": ["x", "y"], "rows": [["1", "2"]]},
        {"type": "figure", "images": [{"src": "data/report/y.webp", "alt": "alt", "caption": "cap"}]},
    ])
    assert "## Title" in md and "- a\n- b" in md and "| x | y |\n|---|---|\n| 1 | 2 |" in md
    assert f"![alt]({report.SITE}/data/report/y.webp)" in md and "*cap*" in md


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


def test_case_study_pictures_are_saved_site_files():
    data = report.load()
    figs = [i["src"] for b in report.build(data) if b["type"] == "figure" for i in b["images"]]
    assert len(figs) == 4
    for src in figs:
        assert src.startswith("data/report/") and (report.REPO / "frontend" / "public" / src).is_file()


def test_tile_window_matches_the_web_app():
    # Same numbers as frontend/src/lib/gibs.ts: zoom 12 at the equator for 20 km drawn at 512 px,
    # and the window is centred on the point.
    z, left, top, w = report_images.tile_window(0, 0)
    assert z == 12 and abs(left + w / 2 - 2**11) < 1e-9 and abs(top + w / 2 - 2**11) < 1e-9
    assert 2 <= w < 4  # at least 512 source pixels across, never more than twice that
