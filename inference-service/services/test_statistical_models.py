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


# A flat, mean-reverting series — FX-rate-like (AUD/USD oscillating in a
# tight band around 0.70). On such series the STL trend slope is
# noise-driven; extrapolating it added error. Production MAPE was 5.94
# for stl vs 0.34 for naive on AUD/USD before the signal-to-noise gate.
FLAT_SERIES = [
    0.6996, 0.7012, 0.6988, 0.7005, 0.6991, 0.7023, 0.6984, 0.7010,
    0.6993, 0.7008, 0.6999, 0.7037, 0.7054, 0.7035, 0.7035, 0.7021,
    0.7023, 0.7026, 0.7008, 0.7022, 0.6952, 0.6930, 0.6975, 0.6984,
]


def test_stl_does_not_extrapolate_noise_on_flat_series():
    """REGRESSION: on a flat/mean-reverting series, the STL trend component is
    pure noise. Extrapolating it made stl_forecaster 3-15x worse MAPE than
    naive (AUD/USD: 5.94 vs 0.34 in production logs).

    The signal-to-noise gate must detect that the trend is insignificant
    relative to the series volatility and suppress the drift — so on a flat
    series the forecast stays at the last value (like naive), instead of
    running off in a noise-driven direction.
    """
    last_val = FLAT_SERIES[-1]
    result = predict_stl(FLAT_SERIES, horizon=7)
    preds = result["values"]

    # The forecast must not drift more than 1% from the last value — on a
    # series that oscillates in a 0.69–0.71 band, any larger drift is the
    # noise-extrapolation bug. Before the gate, the forecast ran off to
    # 0.68–0.73 territory.
    for p in preds:
        drift_pct = abs(p - last_val) / last_val
        assert drift_pct < 0.01, (
            f"STL extrapolated noise on flat series: forecast {p:.4f} drifted "
            f"{drift_pct:.2%} from last value {last_val:.4f}"
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


# ─── Confidence interval correctness (round-84 audit) ────────────────────────

def test_arima_respects_confidence_level():
    """REGRESSION: predict_arima hardcoded z=1.96 (95%), ignoring the caller's
    confidence_level. A 90% request silently got a 95% interval, and a 99%
    request got a too-narrow 95% interval. Verify the interval width actually
    changes with the requested level."""
    series = list(range(100, 120))  # clean upward trend, ARIMA fits well
    result_90 = predict_arima(series, horizon=5, confidence_level=0.90)
    result_99 = predict_arima(series, horizon=5, confidence_level=0.99)
    width_90 = result_90["upper_bound"][0] - result_90["lower_bound"][0]
    width_99 = result_99["upper_bound"][0] - result_99["lower_bound"][0]
    # 99% interval must be wider than 90% (z=2.576 vs 1.645).
    assert width_99 > width_90 * 1.2, (
        f"ARIMA CI width barely changed with confidence_level: "
        f"90%={width_90:.4f}, 99%={width_99:.4f}"
    )


def test_bootstrap_ci_non_degenerate_on_constant_series():
    """REGRESSION: _bootstrap_ci computed residuals from a constant series as
    all-zeros → std=0 → margin=0 → lower==upper (a 0-width interval claiming
    100% confidence). The fix floors std to a small scale-aware minimum so the
    interval is non-degenerate. Test via naive (which uses _bootstrap_ci)."""
    from services.statistical_models import _bootstrap_ci

    const_series = [5.0] * 20
    forecasts = np.array([5.0, 5.0, 5.0, 5.0, 5.0])
    lower, upper = _bootstrap_ci(const_series, forecasts, horizon=5, level=0.95)
    # Every step must have a strictly positive interval width (upper > lower).
    for lo, hi in zip(lower, upper):
        assert hi > lo, (
            f"Degenerate CI on constant series: lower={lo}, upper={hi} (width=0 "
            f"implies false 100% confidence)"
        )


# ─── _z_for_level clamp-up (round-86 audit) ─────────────────────────────────


def test_z_for_level_clamps_up_for_non_table_levels():
    """REGRESSION: _z_for_level snapped to the NEAREST table level, so an 0.88
    request got the 80% z (1.282) — a NARROWER interval than the caller asked
    for, overstating precision. The docstring promised a fallback "rather than
    silently returning a different interval width", but the code did the
    opposite. The fix clamps UP: a non-table level gets the smallest table
    level that is >= it, keeping the interval at least as wide as requested."""
    from services.statistical_models import _z_for_level

    # Exact table levels return their z directly (float-drift tolerant).
    assert _z_for_level(0.80) == pytest.approx(1.282)
    assert _z_for_level(0.90) == pytest.approx(1.645)
    assert _z_for_level(0.95) == pytest.approx(1.96)
    assert _z_for_level(0.99) == pytest.approx(2.576)

    # Non-table levels clamp UP (never down — no narrower-than-requested z).
    # 0.88 is between 0.80 and 0.90 → must get 0.90's z (1.645), NOT 0.80's.
    assert _z_for_level(0.88) == pytest.approx(1.645), (
        "0.88 request must clamp up to 0.90 (z=1.645), not snap down to 0.80"
    )
    # 0.97 is between 0.95 and 0.99 → must get 0.99's z (2.576).
    assert _z_for_level(0.97) == pytest.approx(2.576), (
        "0.97 request must clamp up to 0.99 (z=2.576), not snap down to 0.95"
    )
    # 0.85 (closer to 0.80 but still > 0.80) → clamps up to 0.90.
    assert _z_for_level(0.85) == pytest.approx(1.645)

    # Monotonic: a higher requested level never yields a narrower interval.
    levels = [0.80, 0.85, 0.88, 0.90, 0.95, 0.97, 0.99]
    zs = [_z_for_level(lvl) for lvl in levels]
    for i in range(len(zs) - 1):
        assert zs[i] <= zs[i + 1], (
            f"_z_for_level not monotonic: level {levels[i]}→z {zs[i]} but "
            f"level {levels[i+1]}→z {zs[i+1]}"
        )


def test_sarimax_rejects_future_exog_factor_count_mismatch():
    """REGRESSION (round-92): predict_sarimax did not validate that future_exog
    and exog have the same number of factors (columns). A mismatch raised inside
    the SARIMAX fit, was caught by the broad `except (LinAlgError, ValueError)`,
    and silently degraded to univariate ARIMA — the caller asked for a
    multivariate forecast and got a different model with no error. The fix adds
    an explicit column-count check BEFORE the try block so it surfaces as a
    ValueError (422 at the API edge) instead of a silent model swap."""
    import pytest

    from services.statistical_models import predict_sarimax

    values = [100.0 + i for i in range(20)]
    exog = [[float(i), float(i) * 0.5] for i in range(20)]  # 2 factors
    # future_exog with 1 factor (mismatch) — must raise, not silently degrade.
    future_exog = [[float(i)] for i in range(5)]
    with pytest.raises(ValueError, match="factors"):
        predict_sarimax(values, horizon=5, exog=exog, future_exog=future_exog)
