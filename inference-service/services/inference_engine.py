"""Unified inference engine — routes to statistical or deep learning models."""

import logging
import time

from services.statistical_models import STATISTICAL_MODELS
from services.deep_models import DEEP_MODELS

logger = logging.getLogger(__name__)

CHRONOS_AVAILABLE = False
try:
    from chronos import ChronosPipeline
    import numpy as np
    CHRONOS_AVAILABLE = True
    logger.info("Chronos-forecasting available")
except ImportError:
    logger.warning("chronos-forecasting not installed — chronos model unavailable")

_all_models = {**STATISTICAL_MODELS, **DEEP_MODELS}
if CHRONOS_AVAILABLE:
    _all_models["chronos"] = None  # handled separately

MODEL_IDS = list(_all_models.keys())


def predict(
    model_id: str,
    values: list[float],
    timestamps: list[int],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    """Run prediction with the specified model. Returns dict with values, lower_bound, upper_bound."""
    if model_id not in _all_models:
        raise ValueError(f"Unknown model: {model_id}. Available: {MODEL_IDS}")

    start = time.time()

    if model_id == "chronos":
        result = _predict_chronos(values, horizon, confidence_level)
    elif model_id in STATISTICAL_MODELS:
        result = STATISTICAL_MODELS[model_id](values, horizon, confidence_level)
    elif model_id in DEEP_MODELS:
        result = DEEP_MODELS[model_id](values, horizon, confidence_level)
    else:
        raise ValueError(f"Model {model_id} not implemented")

    elapsed = time.time() - start
    logger.info(f"Model {model_id}: predicted {horizon} steps in {elapsed:.2f}s")
    return result


def _predict_chronos(
    values: list[float],
    horizon: int,
    confidence_level: float,
) -> dict:
    if not CHRONOS_AVAILABLE:
        raise RuntimeError("chronos-forecasting not installed")

    import numpy as np
    from chronos import ChronosPipeline

    pipeline = ChronosPipeline.from_pretrained(
        "amazon/chronos-t5-tiny",
        device_map="cpu",
        torch_dtype="auto",
    )
    context = np.array(values, dtype=np.float32)
    quantiles, mean = pipeline.predict_quantiles(
        context,
        prediction_length=horizon,
        quantile_levels=[1 - confidence_level, 0.5, confidence_level],
    )
    return {
        "values": mean[0].tolist(),
        "lower_bound": quantiles[0][0].tolist(),
        "upper_bound": quantiles[0][2].tolist(),
    }


def list_models() -> list[dict]:
    """Return metadata for all available models."""
    models = [
        {"id": "arima", "name": "ARIMA", "type": "statistical", "description": "AutoRegressive Integrated Moving Average"},
        {"id": "holtwinters", "name": "Holt-Winters", "type": "statistical", "description": "Triple exponential smoothing with trend and seasonality"},
        {"id": "exponential_smoothing", "name": "Exponential Smoothing", "type": "statistical", "description": "Simple exponential smoothing"},
        {"id": "naive_forecaster", "name": "Naive Forecaster", "type": "statistical", "description": "Last-value baseline forecaster"},
        {"id": "stl_forecaster", "name": "STL Forecaster", "type": "statistical", "description": "STL decomposition with linear trend extrapolation"},
        {"id": "timer_xl", "name": "Timer-XL (LSTM)", "type": "deep_learning", "description": "LSTM-based forecaster, trains on input data"},
        {"id": "sundial", "name": "Sundial (Transformer)", "type": "deep_learning", "description": "Transformer-based forecaster, trains on input data"},
    ]
    if CHRONOS_AVAILABLE:
        models.append({
            "id": "chronos", "name": "Chronos-2", "type": "foundation",
            "description": "Amazon Chronos T5 time-series foundation model",
        })
    return models
