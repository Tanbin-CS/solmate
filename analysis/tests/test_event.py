"""Event-day config: mistakes fail early with a message; values reach targets and verdict text."""

import json

import pytest

from solmate import event
from solmate.compute import breakdown
from solmate.io.generic import LayerError
from solmate.pipeline import export_web

DIMS = {"dimensions": {"C": {"applies_to": ["moon", "mars"], "indicators": {"aridity_index": {"weight": 1.0}}}}}
TARGETS = {"jezero_crater": "mars", "haworth": "moon"}


def layer(**kw):
    base = {"id": "soil_moisture", "name": "Soil moisture", "units": "kg/m2", "source": "NASA GLDAS",
            "url": "https://disc.gsfc.nasa.gov/", "licence": "NASA open data", "role": "context",
            "earth": {"files": "GLDAS/*.nc4", "variable": "SoilMoi0_10cm_inst"}}
    return {**base, **kw}


def load(*layers, dims=DIMS):
    return event.load({"layers": list(layers)}, dims, TARGETS)


def test_packaged_config_is_valid():
    assert isinstance(event.load(), list)


def test_context_layer_loads_with_defaults():
    (e,) = load(layer())
    assert e["digits"] == 2 and event.context_layers([e])[0]["role"] == "context"


@pytest.mark.parametrize(("change", "message"), [
    ({"url": "http://x.org"}, "https"),
    ({"id": "Bad-Id"}, "snake_case"),
    ({"role": "maybe"}, "role must be"),
    ({"licence": ""}, "missing licence"),
    ({"earth": {"files": "../x"}}, "relative glob"),
    ({"role": "scored"}, "list soil_moisture under a dimension"),
    ({"targets": {"values": {"pluto": {"value": 1, "url": "https://x"}}}}, "unknown target pluto"),
    ({"targets": {"values": {"haworth": {"value": 1}}}}, "url or doi"),
])
def test_config_mistakes_are_reported(change, message):
    with pytest.raises(LayerError, match=message):
        load(layer(**change))


def test_duplicate_ids_are_rejected():
    with pytest.raises(LayerError, match="unique"):
        load(layer(), layer())


def test_scored_layer_needs_a_value_for_every_target_it_applies_to():
    dims = {"dimensions": {"C": {"applies_to": ["mars"], "indicators": {"soil_moisture": {"weight": 0.5}}}}}
    with pytest.raises(LayerError, match="target value for jezero_crater"):
        load(layer(role="scored"), dims=dims)
    ok = load(layer(role="scored", targets={"values": {"jezero_crater": {"value": 0.0, "doi": "10.1/x"}}}), dims=dims)
    assert ok[0]["role"] == "scored"
    with pytest.raises(LayerError, match="role context, but dimensions.yaml scores it"):
        load(layer(), dims=dims)


def test_cited_and_sampled_values_reach_targets(tmp_path):
    samples = tmp_path / "event.json"
    samples.write_text(json.dumps({"targets": {"soil_moisture": {"haworth": {"value": 0.0, "url": "https://x"}}}}))
    e = load(layer(targets={"values": {"jezero_crater": {"value": 1.5, "doi": "10.1/x"}}}))
    v = event.target_values(e, samples)
    assert v["jezero_crater"]["soil_moisture"] == {"unit": "kg/m2", "method": "literature", "value": 1.5,
                                                   "doi": "10.1/x"}
    assert v["haworth"]["soil_moisture"]["method"] == "computed"


def test_event_layers_are_appended_to_the_tiles_once():
    dims = DIMS["dimensions"]
    layers = export_web.tile_layers(dims, ["soil_moisture", "aridity_index"])
    assert layers[0] == "aridity_index" and layers[-1] == "soil_moisture" and layers.count("aridity_index") == 1


def test_dimension_label_names_event_indicators_in_verdict_text():
    dims = {"C": {"indicators": {"soil_moisture": {"weight": 1, "label": "Topsoil moisture"}}}}
    labels = breakdown.indicator_labels(dims)
    assert labels["soil_moisture"] == "Topsoil moisture" and labels["aridity_index"] == "Aridity (P/PET)"


def test_release_rule_allows_small_drops_only():
    from solmate.pipeline import release

    before = {"summary": {"mars": {"auc_median": 0.713}, "moon": {"auc_median": 0.75}}}
    ok = {"summary": {"mars": {"auc_median": 0.70}, "moon": {"auc_median": 0.70}}}
    assert release.check_rule(before, ok, {"mars"})["passes"]  # -0.013 on Mars; Moon not scored on
    assert not release.check_rule(before, ok, {"mars", "moon"})["passes"]  # -0.05 on the Moon


@pytest.mark.parametrize("download", [{"short_name": "bad name", "version": "2.1"}, {"short_name": "GLDAS"},
                                      {"short_name": "GLDAS", "version": "2.1", "temporal": ["2023", "2024"]}])
def test_download_block_is_checked(download):
    with pytest.raises(LayerError, match="download"):
        load(layer(download=download))


def test_unquoted_yaml_dates_become_text():
    import datetime as dt

    (e,) = load(layer(download={"short_name": "GLDAS", "version": "2.1",
                                "temporal": [dt.date(2023, 1, 1), dt.date(2024, 12, 31)]}))
    assert e["download"]["temporal"] == ["2023-01-01", "2024-12-31"]
