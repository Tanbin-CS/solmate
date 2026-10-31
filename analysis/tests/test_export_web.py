import numpy as np

from solmate.pipeline.export_web import choose_transform, decode, dequantise, encode, quantise, tile_layers


def test_quantise_roundtrip_is_precise_and_keeps_nan():
    a = np.array([0.0, 0.5, 1.0, np.nan, 123.456])
    q = quantise(a, 0.0, 200.0)
    back = dequantise(q, 0.0, 200.0)
    assert np.isnan(back[3]) and q[3] == 65535
    assert np.allclose(back[[0, 1, 2, 4]], a[[0, 1, 2, 4]], atol=200.0 / 65534)


def test_quantise_clips_and_handles_flat_layers():
    assert quantise(np.array([-5.0, 500.0]), 0.0, 100.0).tolist() == [0, 65534]
    assert dequantise(quantise(np.array([3.0]), 3.0, 3.0), 3.0, 3.0)[0] == 3.0


def test_tile_layers_scored_first_then_context():
    dims = {"T": {"indicators": {"b": {}, "a": {}}}, "C": {"indicators": {"a": {}, "c": {}}}}
    layers = tile_layers(dims)
    assert layers[:3] == ["a", "b", "c"] and "surface_pressure_hpa" in layers and len(layers) == len(set(layers))


def test_heavy_tailed_layers_use_log_and_keep_small_values_precise():
    aridity = np.concatenate([np.full(1000, 0.3), [0.0, 0.004, 4843.0]])
    assert choose_transform(aridity) == "log"
    assert choose_transform(np.array([0.0, 20.0, 45.0])) == "linear"
    assert choose_transform(np.array([-3.0, 40.0, 4000.0])) == "linear"
    assert choose_transform(np.array([0.0, 0.0, 0.0, 100.0])) == "linear"  # zero median: percentages
    x = np.array([0.0, 0.004, 0.03, 4843.0])
    enc = encode(x, "log")
    lo, hi = float(enc.min()), float(enc.max())
    back = decode(dequantise(quantise(enc, lo, hi), lo, hi), "log")
    assert np.allclose(back, x, rtol=2e-4, atol=2e-8)
