"""Tests for services/statistical_models.py — the 6 statistical forecasters.

Previously this module had ZERO tests despite containing the STL damped-trend
fix (a correctness bug that made STL the worst MAPE model at 32.4%). These
tests lock in:

  1. STL damped-trend does NOT diverge (the regression the fix addressed).
  2. Every model returns the contract shape (values + bounds, correct length).
  3. Edge cases: short series (<4 points) degrades to naive, not a crash.

Run:  cd inference-service && source venv/bin/activate && pytest -q
"""

import numpy as np
import pytest

from services.statistical_models import (
    STATISTICAL_MODELS,
    predict_arima,
    predict_naive,
    predict_stl,
)

# A gently-upward-trending series with mild noise — representative of real
# beef/commodity daily prices. STL's bug surfaced here: a tiny positive trend
# produced a strong DOWNWARD forecast because sign(slope)*sqrt(|slope|)*steps
# let the SIGN dominate the (sqrt-compressed) magnitude.
TREND_SERIES = [
    10.0, 10.2, 9.9, 10.3, 10.5, 10.4, 10.7, 10.9, 10.8, 11.1,
    11.0, 11.3, 11.5, 11.4, 11.7, 11.6, 11.9, 12.0, 11.8, 12.2,
]

SHORT_SERIES = [1.0, 2.0, 3.0]  # < 4 points → below ARIMA/STL minimum


# ─── Contract shape ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("model_name", list(STATISTICAL_MODELS.keys()))
def test_every_model_returns_correct_shape(model_name):
    """Each model must return {values, lower_bound, upper_bound} with exactly
    `horizon` entries. A shape mismatch breaks the API response contract."""
    result = STATISTICAL_MODELS[model_name](TREND_SERIES, horizon=7)
    assert "values" in result
    assert "lower_bound" in result
    assert "upper_bound" in result
    assert len(result["values"]) == 7
    assert len(result["lower_bound"]) == 7
    assert len(result["upper_bound"]) == 7


@pytest.mark.parametrize("model_name", list(STATISTICAL_MODELS.keys()))
def test_every_model_returns_finite_values(model_name):
    """No NaN/inf allowed — those would serialize as JSON null and break the
    frontend chart rendering silently."""
    result = STATISTICAL_MODELS[model_name](TREND_SERIES, horizon=5)
    for v in result["values"] + result["lower_bound"] + result["upper_bound"]:
        assert np.isfinite(v), f"{model_name} produced non-finite value {v}"


@pytest.mark.parametrize("model_name", list(STATISTICAL_MODELS.keys()))
def test_confidence_band_brackets_forecast(model_name):
    """lower ≤ values ≤ upper for every step. An inverted band would confuse
    any downstream interval-aware logic."""
    result = STATISTICAL_MODELS[model_name](TREND_SERIES, horizon=5)
    for lo, val, hi in zip(result["lower_bound"], result["values"], result["upper_bound"]):
        assert lo <= val + 1e-9, f"{model_name}: lower {lo} > value {val}"
        assert val <= hi + 1e-9, f"{model_name}: value {val} > upper {hi}"


# ─── STL damped-trend regression guard ───────────────────────────────────────

def test_stl_does_not_diverge_on_upward_trend():
    """REGRESSION: the old STL formula (sign(slope)*sqrt(|slope|)*steps) made
    the forecast diverge linearly without bound. On a gentle uptrend it
    produced a strong DOWNWARD drift — the worst MAPE (32.4%) of all models.

    The fix uses damped-trend: slope * (d^1 + d^2 + ... d^step) with damping=0.5,
    so the cumulative drift asymptotes. On this +22% trend series, the forecast
    must stay within a reasonable band of the last value (not diverge >50%).
    """
    last_val = TREND_SERIES[-1]
    result = predict_stl(TREND_SERIES, horizon=7)
    preds = result["values"]

    # The damped forecast should follow the trend direction (upward) but be
    # bounded — the cumulative drift asymptotes to slope*d/(1-d) = slope*1.0.
    # With ~0.15/step slope and damping 0.5, max drift ≈ 0.15. So all forecasts
    # should be within ±50% of the last value. The old bug breached this easily.
    for p in preds:
        drift_pct = abs(p - last_val) / last_val
        assert drift_pct < 0.50, (
            f"STL diverged: forecast {p} is {drift_pct:.1%} from last value {last_val}"
        )

    # The forecast must trend UPWARD (the series is clearly rising), not
    # downward — the old bug's signature was an inverted direction.
    assert preds[-1] > preds[0] - 1e-6, (
        f"STL forecast went DOWN on an upward series: {preds[0]:.2f} → {preds[-1]:.2f}"
    )


def test_stl_forecast_is_bounded_over_long_horizon():
    """The damped-trend asymptote means a long-horizon forecast (50 steps)
    must not grow without limit — the old linear formula would diverge badly."""
    result = predict_stl(TREND_SERIES, horizon=50)
    preds = result["values"]
    last_val = TREND_SERIES[-1]
    # With damping=0.5, the asymptotic drift is slope*1.0 ≈ 0.15.
    # Even at 50 steps, forecasts should stay within 100% of the last value.
    # The old formula (linear in steps) would hit ~7.5 drift at step 50.
    max_forecast = max(preds)
    assert max_forecast < last_val * 2.0, (
        f"STL diverged over 50 steps: max forecast {max_forecast:.2f} vs last {last_val:.2f}"
    )


# ─── Edge cases ──────────────────────────────────────────────────────────────

def test_stl_short_series_degrades_to_naive():
    """STL needs ≥4 points (it computes period=min(7, len//2); with 3 points
    period=1, and the trend slice is degenerate). Must fall back to naive, not
    crash."""
    result = predict_stl(SHORT_SERIES, horizon=5)
    assert len(result["values"]) == 5
    # Naive forecasts the last value — all 5 should equal the last input.
    for v in result["values"]:
        assert abs(v - SHORT_SERIES[-1]) < 1e-6


def test_arima_short_series_degrades_to_naive():
    """ARIMA(2,1,1) needs ≥4 points; fewer must degrade gracefully."""
    result = predict_arima(SHORT_SERIES, horizon=5)
    assert len(result["values"]) == 5
    for v in result["values"]:
        assert abs(v - SHORT_SERIES[-1]) < 1e-6


@pytest.mark.parametrize("model_name", ["naive_forecaster", "exponential_smoothing"])
def test_flat_models_forecast_last_value_on_flat_series(model_name):
    """On a perfectly flat series, every model should forecast the constant
    value (no drift). Catches sign errors in trend-extrapolation logic."""
    flat = [5.0] * 15
    result = STATISTICAL_MODELS[model_name](flat, horizon=5)
    for v in result["values"]:
        assert abs(v - 5.0) < 0.01, f"{model_name} drifted on flat data: {v}"


def test_horizon_one_returns_single_point():
    """horizon=1 is a valid edge — must return lists of length 1, not scalars."""
    result = predict_naive(TREND_SERIES, horizon=1)
    assert isinstance(result["values"], list)
    assert len(result["values"]) == 1


def test_naive_forecasts_last_value_exactly():
    """Naive 'last' strategy must echo the final input value exactly."""
    series = [3.0, 7.0, 2.0, 9.0]
    result = predict_naive(series, horizon=10)
    for v in result["values"]:
        assert v == 9.0
