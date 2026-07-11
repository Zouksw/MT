"""Statistical forecasting models — ARIMA, Holt-Winters, Exponential Smoothing, Naive, STL, SARIMAX."""

import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.seasonal import STL
from sktime.forecasting.naive import NaiveForecaster


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
    z = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}.get(level, 1.96)
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
    lower = pred - 1.96 * fc.se_mean
    upper = pred + 1.96 * fc.se_mean
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
        z = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}.get(confidence_level, 1.96)
        se = fc.se_mean
        lower = pred - z * se
        upper = pred + z * se
        return {
            "values": pred.tolist(),
            "lower_bound": lower.tolist(),
            "upper_bound": upper.tolist(),
            "n_factors": n_factors,
        }
    except (np.linalg.LinAlgError, ValueError) as e:
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
    # Extrapolate the DETRENDED level (trend + seasonal removed → residual
    # mean) using only the most recent period, then anchor to the last observed
    # value. Pure trend-line extrapolation diverges badly on long, trending
    # real-price series (e.g. crude oil's multi-year decline), so we use a
    # damped-drift forecast: last value + small local slope, clamped.
    trend = res.trend
    # Local slope from the last period of the trend component
    recent = trend[-period:]
    local_slope = float(np.mean(np.diff(recent)))
    last_val = float(arr[-1])
    # Damp the slope (sqrt scaling) so multi-step extrapolation stays bounded
    steps = np.arange(1, horizon + 1)
    pred = last_val + np.sign(local_slope) * np.sqrt(abs(local_slope)) * steps
    lower, upper = _bootstrap_ci(values, pred, horizon, confidence_level)
    return {"values": pred.tolist(), "lower_bound": lower, "upper_bound": upper}
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
