"""Statistical forecasting models.

ARIMA, Holt-Winters, Exponential Smoothing, Naive, STL, SARIMAX.
"""

import numpy as np
from sktime.forecasting.naive import NaiveForecaster
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.statespace.sarimax import SARIMAX


def _z_for_level(level: float) -> float:
    """Two-sided z-score for a confidence level.

    Shared by _bootstrap_ci, predict_arima, and predict_sarimax so that the
    confidence_level requested by the caller is consistently honored. Includes
    the 0.80 floor (pydantic allows confidence_level as low as 0.80).

    For a level not exactly in the table, clamp UP to the next supported level
    (e.g. 0.88 → 0.90 → 1.645, 0.97 → 0.99 → 2.576). This keeps the returned
    interval at least as wide as the requested level promises — a narrower
    interval (snap-to-nearest returning the 80% z for an 0.88 request) would
    overstate precision. Exact table levels and float drift (0.949999...) hit
    the equality branch directly.
    """
    table = {0.80: 1.282, 0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
    # Exact match (absorbs float drift like 0.949999... via the tolerance).
    for tbl_level, z in table.items():
        if abs(tbl_level - level) < 1e-6:
            return z
    # Clamp up: smallest supported level that is >= the request. If the request
    # exceeds the max table level (can't happen — pydantic caps at 0.99), use
    # the largest z available.
    candidates = [lvl for lvl in table if lvl >= level]
    target = min(candidates) if candidates else max(table)
    return table[target]


def _bootstrap_ci(
    values: list[float], forecasts: np.ndarray, horizon: int, level: float = 0.95
) -> tuple[list[float], list[float]]:
    """Simple residual-based confidence interval."""
    residuals = np.array(values) - np.roll(np.array(values), 1)
    residuals = residuals[1:]  # drop first NaN
    if len(residuals) == 0:
        pad = [0.0] * horizon
        return pad, pad
    std = np.std(residuals)
    # Constant / near-constant series → residuals are all ~0 → std=0 → CI
    # width 0 (claims 100% confidence, which is statistically wrong). Use a
    # small floor based on the series scale so the interval is non-degenerate.
    # The floor is 1% of the mean abs value (or 1e-6 for an all-zero series),
    # matching the scale-aware pattern used by the STL signal-to-noise gate.
    if std < 1e-9:
        series_scale = float(np.mean(np.abs(np.array(values))))
        std = max(series_scale * 0.01, 1e-6)
    z = _z_for_level(level)
    margin = z * std * np.sqrt(np.arange(1, horizon + 1))
    lower = (forecasts - margin).tolist()
    upper = (forecasts + margin).tolist()
    return lower, upper


def predict_arima(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    arr = np.array(values, dtype=float)
    # ARIMA(2,1,1) needs at least p+d+1 = 4 points for conditional least squares;
    # with fewer, statsmodels' sum-of-squares slicing degenerates to a 0-d array
    # and raises "too many indices for array". Degrade gracefully to the naive
    # forecaster instead of crashing the batch prediction pipeline.
    if len(arr) < 4:
        return predict_naive(values, horizon, confidence_level)
    model = ARIMA(arr, order=(2, 1, 1))
    fitted = model.fit()
    fc = fitted.get_forecast(steps=horizon)
    pred = fc.predicted_mean
    # Respect the caller's confidence_level (previously hardcoded 1.96 = 95%,
    # which silently ignored any other requested level). Mirrors SARIMAX.
    z = _z_for_level(confidence_level)
    se = fc.se_mean
    lower = pred - z * se
    upper = pred + z * se
    return {
        "values": pred.tolist(),
        "lower_bound": lower.tolist(),
        "upper_bound": upper.tolist(),
    }


def predict_sarimax(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
    exog: list[list[float]] | None = None,
    future_exog: list[list[float]] | None = None,
) -> dict:
    """ARIMAX / SARIMAX — ARIMA with exogenous (external) variables.

    This is the multivariate path: instead of forecasting a price from its own
    history alone, it conditions on *leading/driving factors* (FX rates, freight
    indices, feed prices, a correlated commodity, etc.). For a platform like
    mooket.com where import-meat to-land price ≈ origin price × FX × tariff, the
    exogenous channel is where most of the real signal lives.

    `exog` shape: (n_observations, n_factors) — historical exogenous values,
    one row per element of `values`, same length.
    `future_exog` shape: (horizon, n_factors) — known/projected exogenous values
    for the forecast window. If omitted, we forward-fill the last observed row,
    which is a reasonable default for slowly-moving drivers (FX, freight).
    """
    arr = np.array(values, dtype=float)
    if len(arr) < 4:
        return predict_naive(values, horizon, confidence_level)

    # No exogenous data supplied → degrade to plain ARIMA(2,1,1).
    if not exog or len(exog) == 0:
        return predict_arima(values, horizon, confidence_level)

    exog_arr = np.array(exog, dtype=float)
    # Guard: exog must align with the target series.
    if exog_arr.shape[0] != len(arr):
        raise ValueError(
            f"exog length ({exog_arr.shape[0]}) must equal values length ({len(arr)})"
        )
    if exog_arr.ndim == 1:
        exog_arr = exog_arr.reshape(-1, 1)

    n_factors = exog_arr.shape[1]
    if future_exog is None or len(future_exog) == 0:
        # Forward-fill last observed exogenous row for the horizon. Suitable for
        # slow-moving drivers; volatile ones should pass explicit future_exog.
        last_row = exog_arr[-1, :].reshape(1, -1)
        future_exog_arr = np.repeat(last_row, horizon, axis=0)
    else:
        future_exog_arr = np.array(future_exog, dtype=float)
        if future_exog_arr.ndim == 1:
            future_exog_arr = future_exog_arr.reshape(-1, 1)
        if future_exog_arr.shape[0] != horizon:
            raise ValueError(
                f"future_exog length ({future_exog_arr.shape[0]}) must equal horizon ({horizon})"
            )
        # Column count must match the historical exog. A mismatch would raise
        # inside the SARIMAX fit below, be caught by the broad except, and
        # silently degrade to univariate ARIMA — the caller asked for a
        # multivariate forecast and got a different one with no error. Validate
        # here (outside the try) so it surfaces as a 422 instead.
        if future_exog_arr.shape[1] != n_factors:
            raise ValueError(
                f"future_exog has {future_exog_arr.shape[1]} factors but exog has "
                f"{n_factors}; they must match"
            )

    try:
        model = SARIMAX(
            arr,
            exog=exog_arr,
            order=(2, 1, 1),
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        fitted = model.fit(disp=False, maxiter=100)
        fc = fitted.get_forecast(steps=horizon, exog=future_exog_arr)
        pred = fc.predicted_mean
        # Native SARIMAX confidence interval — respects confidence_level.
        z = _z_for_level(confidence_level)
        se = fc.se_mean
        lower = pred - z * se
        upper = pred + z * se
        return {
            "values": pred.tolist(),
            "lower_bound": lower.tolist(),
            "upper_bound": upper.tolist(),
            "n_factors": n_factors,
        }
    except (np.linalg.LinAlgError, ValueError):
        # SARIMAX can fail to converge on messy real data; fall back to ARIMA
        # rather than crashing the prediction pipeline.
        return predict_arima(values, horizon, confidence_level)


def predict_holtwinters(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    arr = np.array(values, dtype=float)
    # Need at least 2 full seasons for seasonal HW
    if len(arr) >= 14:
        model = ExponentialSmoothing(arr, trend="add", seasonal="add", seasonal_periods=7)
    else:
        model = ExponentialSmoothing(arr, trend="add", seasonal=None)
    fitted = model.fit()
    pred = fitted.forecast(horizon)
    lower, upper = _bootstrap_ci(values, pred, horizon, confidence_level)
    return {"values": pred.tolist(), "lower_bound": lower, "upper_bound": upper}


def predict_exponential_smoothing(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    arr = np.array(values, dtype=float)
    model = ExponentialSmoothing(arr, trend=None, seasonal=None)
    fitted = model.fit()
    pred = fitted.forecast(horizon)
    lower, upper = _bootstrap_ci(values, pred, horizon, confidence_level)
    return {"values": pred.tolist(), "lower_bound": lower, "upper_bound": upper}


def predict_naive(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    arr = np.array(values, dtype=float)
    fc = NaiveForecaster(strategy="last")
    fc.fit(arr)
    pred = fc.predict(np.arange(1, horizon + 1))
    pred = np.asarray(pred).flatten()
    lower, upper = _bootstrap_ci(values, pred, horizon, confidence_level)
    return {"values": pred.tolist(), "lower_bound": lower, "upper_bound": upper}


def predict_stl(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    arr = np.array(values, dtype=float)
    if len(arr) < 4:
        return predict_naive(values, horizon, confidence_level)
    period = min(7, len(arr) // 2)
    stl = STL(arr, period=period, robust=True)
    res = stl.fit()
    # Damped-trend extrapolation anchored to the last observed value.
    #
    # The previous implementation used sign(slope)*sqrt(|slope|)*steps, which
    # had two bugs: (1) sqrt compressed the slope magnitude so the SIGN dominated
    # (a tiny negative trend produced a full-strength downward drift), and (2)
    # the *steps linear growth meant the drift accumulated without bound. On a
    # gentle uptrend this produced a strong DOWNWARD forecast (MAPE 8.5% vs
    # naive 3.5% on synthetic beef-like series; 32.4% in production MAPE logs —
    # the worst of all 5 voting models).
    #
    # Correct damping: slope * (damping^step), where damping < 1 geometrically
    # shrinks the per-step drift so the forecast asymptotes instead of
    # diverging. This is the standard damped-trend (Gardner-McKenzie) approach.
    trend = res.trend
    recent = trend[-period:]
    local_slope = float(np.mean(np.diff(recent)))
    last_val = float(arr[-1])
    # Signal-to-noise gate: only extrapolate the trend if it is strong
    # relative to the series' inherent volatility. On a flat/mean-reverting
    # series (e.g. FX rates oscillating in a tight band), the STL trend
    # slope is noise-driven and extrapolating it adds error — naive (no
    # drift) is the correct forecast. We gate on the ratio of the
    # per-step slope to the detrended residual std; a slope below this
    # threshold is indistinguishable from noise and is zeroed out.
    residual = arr - res.trend - res.seasonal
    noise_std = float(np.std(residual))
    series_scale = abs(last_val) if abs(last_val) > 1e-9 else 1.0
    # Trend is "real" only if extrapolating it full-horizon would move the
    # forecast by more than ~1% of the series level (a conservative bar
    # that lets genuine trends through while suppressing noise on flat
    # series). Without this gate, stl_forecaster ran 3-15x worse MAPE than
    # naive on mean-reverting commodities (AUD/USD 5.94 vs 0.34).
    total_drift = abs(local_slope * horizon)
    if noise_std > 0 and total_drift < 0.01 * series_scale:
        effective_slope = 0.0
    else:
        effective_slope = local_slope
    damping = 0.5  # halve the drift each step → bounded extrapolation
    steps = np.arange(1, horizon + 1)
    # Cumulative drift: slope * (d^1 + d^2 + ... + d^step) = slope*d*(1-d^step)/(1-d)
    cumulative = damping * (1 - damping**steps) / (1 - damping)
    pred = last_val + effective_slope * cumulative
    lower, upper = _bootstrap_ci(values, pred, horizon, confidence_level)
    return {"values": pred.tolist(), "lower_bound": lower, "upper_bound": upper}


STATISTICAL_MODELS = {
    "arima": predict_arima,
    "sarimax": predict_sarimax,
    "holtwinters": predict_holtwinters,
    "exponential_smoothing": predict_exponential_smoothing,
    "naive_forecaster": predict_naive,
    "stl_forecaster": predict_stl,
}
