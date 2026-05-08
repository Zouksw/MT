"""Statistical forecasting models — ARIMA, Holt-Winters, Exponential Smoothing, Naive, STL."""

import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
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
    period = min(7, len(arr) // 2) if len(arr) >= 4 else 2
    stl = STL(arr, period=period, robust=True)
    res = stl.fit()
    # Extrapolate trend with linear regression
    trend = res.trend
    x = np.arange(len(trend))
    coeffs = np.polyfit(x, trend, 1)
    future_x = np.arange(len(trend), len(trend) + horizon)
    pred = np.polyval(coeffs, future_x)
    lower, upper = _bootstrap_ci(values, pred, horizon, confidence_level)
    return {"values": pred.tolist(), "lower_bound": lower, "upper_bound": upper}


STATISTICAL_MODELS = {
    "arima": predict_arima,
    "holtwinters": predict_holtwinters,
    "exponential_smoothing": predict_exponential_smoothing,
    "naive_forecaster": predict_naive,
    "stl_forecaster": predict_stl,
}
