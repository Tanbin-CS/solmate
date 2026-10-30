"""The target file must stay consistent with dimensions.yaml and fully cited."""

from importlib import resources

import pytest
import yaml


def _load(name):
    with resources.files("solmate.config").joinpath(name).open(encoding="utf-8") as f:
        return yaml.safe_load(f)


TARGETS = _load("targets.yaml")["targets"]
DIMS = _load("dimensions.yaml")["dimensions"]
MINERAL = {"mafic_index", "carbonate_index", "quartz_index"}


def test_eleven_targets_with_unique_ids():
    ids = [t["id"] for t in TARGETS]
    assert len(ids) == 11 and len(set(ids)) == 11
    assert sum(t["body"] == "moon" for t in TARGETS) == 9


@pytest.mark.parametrize("target", TARGETS, ids=lambda t: t["id"])
def test_every_applicable_indicator_has_a_value_or_is_computed(target):
    ind = target["indicators"]
    for dim in DIMS.values():
        if target["body"] not in dim["applies_to"]:
            continue
        for name, spec in dim["indicators"].items():
            if spec.get("direction") or name in MINERAL:
                continue  # operations have no target value; minerals use mineral_class
            assert name in ind, f"{target['id']} lacks {name}"
            assert ind[name]["method"] in {"literature", "proxy", "computed"}
    assert set(ind["mineral_class"]) >= {"mafic", "carbonate", "quartz_rich", "source"}


@pytest.mark.parametrize("target", TARGETS, ids=lambda t: t["id"])
def test_every_non_computed_value_is_cited(target):
    entries = list(target["indicators"].items()) + list(target["breaks_down"].items())
    for name, v in entries:
        if not isinstance(v, dict) or v.get("method") == "computed":
            continue
        assert v.get("source"), f"{target['id']}.{name} has no source"
        assert v.get("doi") or v.get("url"), f"{target['id']}.{name} has no DOI or URL"
