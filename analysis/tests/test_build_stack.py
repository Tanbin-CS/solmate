import numpy as np

from solmate.pipeline.build_stack import snow_months


def test_missing_snow_months_are_not_snow_free():
    n = np.nan
    months = np.array([
        [[100.0]] * 24,  # snow in every month: 12 per year
        [[n]] * 24,  # never observed: no data, not 0
        [[80.0]] * 6 + [[n]] * 18,  # six observed months, all snowy: scaled to 12
        [[80.0]] * 5 + [[n]] * 19,  # fewer than six observed: no data
        [[0.0]] * 12 + [[90.0]] * 6 + [[n]] * 6,  # 6 of 18 observed months snowy: 4 per year
    ]).reshape(5, 24).T[:, :, None]
    out = snow_months(months)[:, 0]
    assert out[0] == 12
    assert np.isnan(out[1]) and np.isnan(out[3])
    assert out[2] == 12
    assert out[4] == np.float32(4)
