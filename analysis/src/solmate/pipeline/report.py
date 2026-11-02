"""Write the findings report from the v2 results: docs/REPORT.md and the web copy report.json.

One structured document (a list of blocks) is built from the exported data, then rendered
to Markdown for GitHub and the NASA project page, and saved as JSON for the web Findings
page, so every number and sentence is the same in both. Nothing here computes science; it
reads the screen, validation and target files that the pipeline already wrote.

Run:  uv run python -m solmate.pipeline.report
"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path
from urllib.parse import urlencode

import yaml

ANALYSIS = Path(__file__).resolve().parents[3]
REPO = ANALYSIS.parent
WEB = REPO / "frontend" / "public" / "data" / "v2"
SITE = "https://solmate-analog.web.app"

# Same boxes as frontend/src/lib/places.ts: broad names only where the cells were checked.
REGIONS = [("Tibetan Plateau", 30, 38.1, 75, 95), ("Tarim Basin", 38.1, 42, 75, 95),
           ("Puna de Atacama", -30, -21, -71, -65), ("Sistan Basin", 29, 35, 57, 64)]
DIM_NAMES = {"T": "Terrain", "C": "Climate & aridity", "Th": "Thermal", "S": "Surface & barrenness",
             "M": "Mineralogy", "I": "Ice & cold-trap", "D": "Dust & wind", "O": "Mission operations"}
CASES = [("jezero_crater", "Mars"), ("mons_mouton", "Moon")]


def region(lat: float, lon: float) -> str | None:
    return next((n for n, s, nn, w, e in REGIONS if s <= lat < nn and w <= lon < e), None)


def coords(lat: float, lon: float) -> str:
    return f"{abs(lat):.2f}°{'N' if lat >= 0 else 'S'} {abs(lon):.2f}°{'E' if lon >= 0 else 'W'}"


def place(lat: float, lon: float) -> str:
    r = region(lat, lon)
    return f"{r} ({coords(lat, lon)})" if r else coords(lat, lon)


# Display names for site ids whose plain capitalisation reads wrong (mirrors frontend labels.ts).
SITE_NAMES = {"mdrs-utah": "MDRS (Utah)", "atacama-yungay": "Atacama (Yungay)",
              "haughton-devon-island": "Haughton Crater (Devon Island)",
              "qaidam-dalangtan": "Qaidam Basin (Dalangtan)", "qaidam-east": "Qaidam Basin (east)",
              "licancabur-high-lakes": "Licancabur (High Lakes)", "antarctica-dry-valleys": "McMurdo Dry Valleys",
              "teide-tenerife": "Teide (Tenerife)", "svalbard-bockfjorden": "Bockfjorden (Svalbard)", "rio-tinto": "Río Tinto",
              "sf-volcanic-field": "San Francisco Volcanic Field", "mauna-kea-hi-seas": "Mauna Kea (HI-SEAS)"}


def site_name(sid: str) -> str:
    return SITE_NAMES.get(sid) or " ".join(w.capitalize() for w in sid.replace("_", "-").split("-"))


def sai_of(c: dict) -> float:
    return c["sai_refined"] if c.get("sai_refined") is not None else c["sai"]


def explorer(tid: str, lat: float, lon: float) -> str:
    q = {**({"t": tid} if tid != "jezero_crater" else {}), "p": f"{lat},{lon}"}
    return f"{SITE}/explorer?{urlencode(q)}"


def gibs(lat: float, lon: float, kind: str, km: float = 20, px: int = 512) -> str:
    d = km / 2 / 111.32
    import math

    dl = d / math.cos(math.radians(lat))
    q = {"SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "STYLES": "", "CRS": "EPSG:4326",
         "LAYERS": "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual" if kind == "imagery"
         else "ASTER_GDEM_Greyscale_Shaded_Relief",
         "BBOX": ",".join(f"{v:.5f}" for v in (lat - d, lon - dl, lat + d, lon + dl)),
         "WIDTH": px, "HEIGHT": px, "FORMAT": "image/jpeg", **({"TIME": "1990-12-01"} if kind == "imagery" else {})}
    return f"https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?{urlencode(q)}"


def load() -> dict:
    j = lambda p: json.loads(p.read_text(encoding="utf-8"))  # noqa: E731
    targets = j(WEB / "targets.json")["targets"]
    return {
        "targets": targets,
        "screens": {t["id"]: j(WEB / "screening" / f"{t['id']}.json") for t in targets},
        "validation": j(WEB / "validation.json"),
        "model": j(WEB / "model.json"),
        "stage2": j(REPO / "data" / "screening" / "stage2.v2.json")["targets"],
        "subsurface": yaml.safe_load(resources.files("solmate.config").joinpath("subsurface_sites.yaml")
                                     .read_text(encoding="utf-8")),
    }


def build(d: dict) -> list[dict]:
    targets, screens, v, model = d["targets"], d["screens"], d["validation"], d["model"]
    reg = v.get("addendum_1", {})
    jez = v["targets"]["jezero_crater"]
    novelty_km = model["known_analogs"]["novelty_km"]
    tops = {tid: sorted(s["top"], key=lambda c: -sai_of(c)) for tid, s in screens.items()}
    leads = {tid: sorted(s["novel_leads"], key=lambda c: -sai_of(c)) for tid, s in screens.items()}
    top5_regions: dict[str, int] = {}
    for tid in screens:
        for c in tops[tid][:5]:
            r = region(c["lat"], c["lon"]) or "elsewhere"
            top5_regions[r] = top5_regions.get(r, 0) + 1
    n_top5 = sum(top5_regions.values())
    n_novel5 = sum(1 for tid in screens for c in tops[tid][:5] if (c.get("nearest_known_km") or 0) > novelty_km)
    moon_auc = v["summary"]["moon"]["auc_median"]
    arc_auc = v["targets"]["arcadia_planitia"]["auc_equal"]
    n_known = len(model["known_analogs"]["sites"])

    b: list[dict] = [
        {"type": "h1", "text": "SolMate findings: where Earth comes closest to NASA's Moon base regions and Mars sites"},
        {"type": "p", "text": (
            f"SolMate scored every land cell on Earth, about 1.9 million of them at 0.1°, against {len(targets)} NASA targets: "
            "the nine Artemis III candidate base regions near the lunar south pole, Jezero Crater and Arcadia Planitia. "
            "Each place gets a SolMate Analog Index (SAI, 0–100) built from seven characteristics measured with 41 NASA data "
            "layers, a statement of where the analogy breaks down, and what the place could be used for.")},
        {"type": "p", "text": (
            f"The method was checked against sites NASA has already used as analogs, with a test written down before the "
            f"results: for Jezero, documented Mars analog sites outscore controls with an AUC of {jez['auc_equal']:.2f} "
            f"(95% CI {jez['auc_ci95'][0]:.2f}–{jez['auc_ci95'][1]:.2f}); the Moon regions reach a median of "
            f"{moon_auc:.2f}, and Arcadia Planitia {arc_auc:.2f}, "
            "which is reported as a weak result.")},
        {"type": "p", "text": f"Interactive version: {SITE}/findings · Explorer: {SITE}/explorer · Method: {SITE}/method"},

        {"type": "h2", "text": "Headline findings"},
        {"type": "ul", "items": [
            (f"High, cold, barren plateaus are Earth's closest match to both worlds. Of the top five places for each of "
             f"the {len(targets)} targets ({n_top5} in all), {top5_regions.get('Tibetan Plateau', 0)} lie on the Tibetan "
             f"Plateau and {top5_regions.get('Puna de Atacama', 0)} in the Puna de Atacama, roughly 3,500–5,000 m high "
             "(judged from NASA POWER surface pressure)."),
            (f"{n_novel5} of those {n_top5} are more than {novelty_km} km from all {n_known} known analog sites "
             "(NASA field sites, the Atacama, Antarctica, Iceland, Hawaiʻi, Devon Island and others): leads nobody has "
             "tested, listed for expert and field review."),
            ("No place matches everything. Nowhere on Earth is as cold, as dry or as airless as the lunar south pole or Mars; "
             "those characteristics are ranked toward the target, and the gap is stated with every result."),
            ("Different places lead on different characteristics: the best terrain match is often not the best thermal or "
             "mineral match, which is why every result shows all seven dimensions."),
        ]},

        {"type": "h2", "text": "Best places for every target"},
        {"type": "p", "text": (
            "SAI with equal weights, with terrain measured at 100 m from NASA ASTER GDEM where available. "
            f"A novel lead is more than {novelty_km} km from every known analog site.")},
        {"type": "table",
         "head": ["Target", "Best place on Earth", "SAI", "Best novel lead", "SAI", "Distance to nearest known site"],
         "rows": [[t["name"], place(tops[t["id"]][0]["lat"], tops[t["id"]][0]["lon"]), f"{sai_of(tops[t['id']][0]):.1f}",
                   place(leads[t["id"]][0]["lat"], leads[t["id"]][0]["lon"]), f"{sai_of(leads[t['id']][0]):.1f}",
                   f"{leads[t['id']][0]['nearest_known_km']:.0f} km from {site_name(leads[t['id']][0]['nearest_known'])}"]
                  for t in targets]},
    ]

    for tid, world in CASES:
        t = next(x for x in targets if x["id"] == tid)
        c = leads[tid][0]
        ver = c["verdict"]
        t100 = c.get("terrain_100m") or {}
        ti = (t100.get("indicators") or {})
        tt = d["stage2"].get(tid, {})
        dims = {x["id"]: x["score"] for x in ver["dimensions"]}
        if t100.get("score") is not None:
            dims["T"] = t100["score"]
        where = region(c["lat"], c["lon"]) or coords(c["lat"], c["lon"])
        here = coords(c["lat"], c["lon"])
        b += [
            {"type": "h2", "text": f"Case study: {t['name']} ({world}) and the {where}"},
            {"type": "p", "text": (
                f"The best novel lead for {t['name']} is the cell at {coords(c['lat'], c['lon'])}, "
                f"{c['nearest_known_km']:.0f} km from the nearest known analog site, {site_name(c['nearest_known'])}. "
                f"Its SAI is {sai_of(c):.1f}.")},
            {"type": "figure", "images": [
                {"src": gibs(c["lat"], c["lon"], "imagery"), "alt": f"Landsat image, 20 km around {here}",
                 "caption": "NASA/USGS Landsat WELD 1990, 20 km window"},
                {"src": gibs(c["lat"], c["lon"], "relief"), "alt": f"ASTER GDEM shaded relief, 20 km around {here}",
                 "caption": "NASA/METI ASTER GDEM shaded relief, 20 km window"},
            ]},
            {"type": "h3", "text": "Why it is analogous"},
            {"type": "table", "head": ["Characteristic", "Score (0–1)"],
             "rows": [[DIM_NAMES[k], f"{s:.2f}" if s is not None else "–"] for k, s in dims.items()]},
        ]
        if ti and tt:
            b.append({"type": "table", "head": ["100 m terrain (20 km window)", t["name"], "This place"], "rows": [
                ["Median slope", f"{tt['slope_median']:.1f}°", f"{ti['slope_median']:.1f}°"],
                ["Steepest 10% of slopes", f"{tt['slope_p90']:.1f}°", f"{ti['slope_p90']:.1f}°"],
                ["Hypsometric integral", f"{tt['hypsometric_integral']:.2f}", f"{ti['hypsometric_integral']:.2f}"],
            ]})
        if ver["process_tags"]:
            b.append({"type": "ul", "items": [f"Process: {p['name']}. {p['analog']}." for p in ver["process_tags"]]})
        if ver.get("habitability"):
            b += [{"type": "h3", "text": "Biology and habitability"},
                  {"type": "ul", "items": [h["text"] for h in ver["habitability"]]}]
        b += [
            {"type": "h3", "text": "Where the analogy breaks down"},
            {"type": "ul", "items": [x["text"] for x in ver["breaks_down"]]},
            {"type": "h3", "text": "What it could be used for"},
            {"type": "ul", "items": [u["text"] for u in ver["use_it_for"]] or ["No use rule fired for this place."]},
            {"type": "p", "text": (
                "Suggested next step: an expert desk review of geology maps and high-resolution imagery, then a short field "
                "visit to check surface materials and access before any test is planned. This is an unreviewed lead, not a "
                f"recommendation. Open it: {explorer(tid, c['lat'], c['lon'])}")},
        ]

    sub = d["subsurface"]
    b += [
        {"type": "h2", "text": "Caves, lava tubes and mines"},
        {"type": "p", "text": (
            "Satellites see only the surface, so SolMate cannot score caves or lava tubes; every result says so. "
            "These underground places have been used by space agencies and NASA-funded teams as analogs:")},
        {"type": "ul", "items": [f"{x['name']} ({x['country']}): {x['use']} Source: {x['url']}"
                                 for x in sub["earth"]]},
        {"type": "p", "text": "On the targets themselves:"},
        {"type": "ul", "items": [f"{'Moon' if x['body'] == 'moon' else 'Mars'}: {x['text']} {x['url']}" for x in sub["targets"]]},
        {"type": "p", "text": (
            "Impact craters are covered by the validation instead: Haughton, Meteor Crater, Ries, Lonar and Sudbury are "
            "among the analog sites the scores were tested against.")},
    ]

    pos = sorted(jez["positives"].items(), key=lambda kv: -(kv[1]["sai"] or 0))
    b += [
        {"type": "h2", "text": "Characterizing the famous analog sites"},
        {"type": "p", "text": (
            "Well-known analog sites are rarely measured against a target in the same terms. Here are the documented Mars "
            "analog sites scored against Jezero Crater, with the share of Earth's land each one beats.")},
        {"type": "table", "head": ["Site", "SAI vs Jezero", "Beats this share of Earth's land"],
         "rows": [[site_name(k), f"{s['sai']:.1f}", f"{s['land_percentile']:.1f}%"] for k, s in pos]},
    ]

    b.append({"type": "p", "text": (
        "The best place for a single characteristic can fail the others: a strong mineral or terrain match may sit in a humid "
        "lowland or a hot desert. That is why the index combines all of them, and why the Explorer shows every dimension "
        "for every place.")})
    for tid in ("jezero_crater", "mons_mouton_plateau"):
        t = next(x for x in targets if x["id"] == tid)
        lead = screens[tid]["dimension_leaders"]
        b += [{"type": "h3", "text": f"Different places for different characteristics: {t['name']}"},
              {"type": "table", "head": ["Characteristic", "Best place", "Score"],
               "rows": [[DIM_NAMES[k], place(cs[0]["lat"], cs[0]["lon"]), f"{cs[0]['dims'][k]:.2f}"]
                        for k, cs in lead.items() if cs]}]

    rows = []
    for t in targets:
        r = v["targets"][t["id"]]
        rr = reg.get("targets", {}).get(t["id"], {}).get("equal", {})
        rows.append([t["name"], f"{r['auc_equal']:.2f}", f"{r['auc_ci95'][0]:.2f}–{r['auc_ci95'][1]:.2f}",
                     f"{rr['auc_region_weighted']:.2f}" if rr else "–"])
    b += [
        {"type": "h2", "text": "How far to trust it"},
        {"type": "p", "text": (
            "AUC is the chance that a site NASA has used as an analog outscores a control (farmland, forest, cities, ice); "
            "0.5 is chance. The last column counts each 500 km cluster of sites once, a check added after mentor review "
            "and written down before it was run.")},
        {"type": "table", "head": ["Target", "AUC", "95% CI", "Each region once"], "rows": rows},
        {"type": "ul", "items": [
            "Jezero is the strongest result; the Moon targets have only 10 analog sites each, so their intervals are wide.",
            "Arcadia Planitia is weak with equal weights and is reported rather than hidden.",
            ("Terrain-first Moon weights (Lunar ops) were tested after mentor review: they help the rugged massifs and hurt "
             "the plateaus, so equal weights stay the default."),
        ]},
        {"type": "h2", "text": "Limits"},
        {"type": "ul", "items": [
            "Gravity, atmosphere, radiation and surface chemistry differ from Earth everywhere; they are stated, never scored.",
            ("Near the lunar south pole the Sun never rises more than a few degrees; no place on Earth reproduces that "
             "lighting, and every Moon result compares it with the place's own noon Sun."),
            "Caves, lava tubes and other underground environments cannot be assessed from satellite data.",
            "Biology and habitability are described for every place but not scored.",
            "A 0.1° cell averages about 11 km of ground; only terrain is refined at 100 m.",
            "Novel leads are unreviewed: they need expert review and field data before anyone plans a test.",
            "Validation labels reflect where agencies have worked, which includes logistics as well as science.",
        ]},
        {"type": "h2", "text": "Data and reproducibility"},
        {"type": "p", "text": (
            "All scored inputs are NASA data: MODIS (MYD11C3, MOD10CM, MCD43C3, MCD12C1), ASTER GED and GDEM v3, "
            "MERRA-2, NASA POWER and SRTMGL30 on Earth; LRO LOLA and Diviner on the Moon; MOLA, CTX and Mars 2020 results "
            f"on Mars. Sources, licences and checksums: {SITE}/provenance. Code: https://github.com/Tanbin-CS/solmate "
            f"(results version {model['model_version']}).")},
    ]
    return b


def to_markdown(blocks: list[dict]) -> str:
    out = []
    for blk in blocks:
        k = blk["type"]
        if k in ("h1", "h2", "h3"):
            out.append(f"{'#' * int(k[1])} {blk['text']}\n")
        elif k == "p":
            out.append(blk["text"] + "\n")
        elif k == "ul":
            out.append("\n".join(f"- {i}" for i in blk["items"]) + "\n")
        elif k == "table":
            out.append("| " + " | ".join(blk["head"]) + " |\n|" + "---|" * len(blk["head"]) + "\n"
                       + "\n".join("| " + " | ".join(r) + " |" for r in blk["rows"]) + "\n")
        elif k == "figure":
            out.append(" ".join(f"![{i['alt']}]({i['src']})" for i in blk["images"]) + "\n\n"
                       + " · ".join(f"*{i['caption']}*" for i in blk["images"]) + "\n")
    return "\n".join(out)


def main() -> None:
    blocks = build(load())
    md = to_markdown(blocks)
    (REPO / "docs" / "REPORT.md").write_text(md, encoding="utf-8", newline="\n")
    (WEB / "report.json").write_text(json.dumps({"version": 1, "blocks": blocks},
                                                ensure_ascii=False, separators=(",", ":")) + "\n",
                                     encoding="utf-8", newline="\n")
    print(f"REPORT.md: {len(md.splitlines())} lines; report.json: {len(blocks)} blocks")


if __name__ == "__main__":
    main()
