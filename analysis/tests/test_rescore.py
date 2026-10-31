import math

import pytest

from solmate.pipeline.rescore import refined_sai


def test_refined_sai_replaces_coarse_terrain():
    assert refined_sai({"T": 0.2, "C": 0.8, "Th": 0.6}, 1.0) == pytest.approx(80.0)


def test_refined_sai_keeps_coarse_terrain_without_100m_score():
    assert refined_sai({"T": 0.2, "C": 0.8}, float("nan")) == pytest.approx(50.0)


def test_refined_sai_skips_missing_dimensions():
    assert refined_sai({"T": None, "C": 0.4, "Th": None}, 0.6) == pytest.approx(50.0)
    assert math.isnan(refined_sai({}, float("nan")))
