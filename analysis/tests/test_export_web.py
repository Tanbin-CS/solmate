import numpy as np

from solmate.pipeline.export_web import dequantise, quantise, tile_layers


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
