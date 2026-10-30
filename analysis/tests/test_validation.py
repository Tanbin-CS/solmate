import numpy as np
import pytest

from solmate.compute import validation as v


def test_auc_basics():
    assert v.auc([3, 4], [1, 2]) == 1.0
    assert v.auc([1, 2], [3, 4]) == 0.0
    assert v.auc([1], [1]) == 0.5


def test_bootstrap_ci_brackets_point_and_is_seeded():
    rng = np.random.default_rng(0)
    pos, neg = rng.normal(1, 1, 30), rng.normal(0, 1, 30)
    lo, hi = v.bootstrap_auc_ci(pos, neg, n_boot=300)
    assert lo < v.auc(pos, neg) < hi
    assert (lo, hi) == v.bootstrap_auc_ci(pos, neg, n_boot=300)


def test_weighted_scores_skip_nan():
    d = np.array([[1.0, np.nan], [0.0, 1.0]])
    assert v.weighted_scores(d, np.array([1.0, 1.0])).tolist() == [1.0, 0.5]


def test_dirichlet_auc_shape_and_range():
    pos = np.array([[0.9, 0.8], [0.7, 0.9]])
    neg = np.array([[0.1, 0.2], [0.3, 0.1]])
    a = v.dirichlet_auc(pos, neg, n=50)
    assert a.shape == (50,) and np.all(a == 1.0)


def test_learned_weights_are_nonnegative_and_find_the_signal():
    rng = np.random.default_rng(1)
    n = 200
    y = (rng.random(n) < 0.5).astype(float)
    signal = y * 0.6 + rng.normal(0, 0.2, n)
    noise = rng.normal(0.5, 0.2, n)
    anti = (1 - y) * 0.6 + rng.normal(0, 0.2, n)  # anti-correlated: must be clipped at 0
    w, _ = v.fit_nonneg_logistic(np.c_[signal, noise, anti], y, l2=0.01)
    assert np.all(w >= 0)
    assert w[0] > w[1] and w[2] == pytest.approx(0.0, abs=1e-6)


def test_cv_learned_auc_detects_separable_data():
    rng = np.random.default_rng(2)
    y = np.r_[np.ones(25), np.zeros(25)]
    x = np.c_[y + rng.normal(0, 0.3, 50), rng.normal(0, 1, 50)]
    med, lo, hi = v.cv_learned_auc(x, y, folds=5, repeats=3)
    assert med > 0.8 and lo <= med <= hi
