"""Unified inference engine — routes to statistical models or the Chronos foundation model.

Architecture (IoTDB AINode-style): only pretrained / ready-to-use models are
served. Statistical models (ARIMA, Holt-Winters, etc.) do fast parameter
estimation at predict-time (standard for this model class); Chronos is a
zero-shot pretrained time-series foundation model. No model is trained from
scratch on request — the previous Timer-XL/Sundial online-training path was
removed as an anti-pattern.
"""

import logging
import time

from services.statistical_models import STATISTICAL_MODELS

logger = logging.getLogger(__name__)

CHRONOS_AVAILABLE = False
try:
    from chronos import ChronosPipeline  # noqa: F401
    import numpy as np  # noqa: F401

    CHRONOS_AVAILABLE = True
    logger.info("Chronos-forecasting importable")
except ImportError:
    logger.warning("chronos-forecasting not installed — chronos model unavailable")

# Honest availability probe for chronos. The pip import succeeding only means
# the library is installed — it does NOT mean the pretrained weights can be
# loaded. In this deployment huggingface.co is network-blocked, so
# ChronosPipeline.from_pretrained("amazon/chronos-t5-tiny") hangs/fails at
# runtime. We must not advertise chronos as usable in /models when every
# actual /predict {"model_id":"chronos"} call will fail. Probe once at import:
# if we have already cached the weights locally (HF_HOME / hub cache), chronos
# IS usable; otherwise it is blocked.
CHRONOS_USABLE = False
CHRONOS_BLOCKED_REASON: str | None = None
if CHRONOS_AVAILABLE:
    import os
    from pathlib import Path

    def _chronos_weights_cached() -> bool:
        """True iff the amazon/chronos-t5-tiny snapshot is present in any HF cache dir."""
        candidates = []
        hf_home = os.environ.get("HF_HOME") or os.environ.get("TRANSFORMERS_CACHE")
        if hf_home:
            candidates.append(Path(hf_home))
        candidates.append(Path.home() / ".cache" / "huggingface")
        for base in candidates:
            # HF hub cache layout: hub/models--amazon--chronos-t5-tiny/snapshots/<sha>/
            snapshot_root = base / "hub" / "models--amazon--chronos-t5-tiny" / "snapshots"
            if snapshot_root.exists() and any(snapshot_root.iterdir()):
                return True
        return False

    if _chronos_weights_cached():
        CHRONOS_USABLE = True
        logger.info("Chronos weights cached locally — chronos is usable")
    else:
        CHRONOS_BLOCKED_REASON = "model weights unreachable (huggingface.co blocked); pip import only"
        logger.warning("Chronos importable but weights not cached — advertised as blocked")

# Only pretrained / ready-to-use models. No self-training models.
_all_models = {**STATISTICAL_MODELS}
if CHRONOS_AVAILABLE:
    _all_models["chronos"] = None  # handled separately

MODEL_IDS = list(_all_models.keys())


def predict(
    model_id: str,
    values: list[float],
    timestamps: list[int],
    horizon: int,
    confidence_level: float = 0.95,
    exog: list[list[float]] | None = None,
    future_exog: list[list[float]] | None = None,
) -> dict:
    """Run prediction with the specified model. Returns dict with values, lower_bound, upper_bound."""
    if model_id not in _all_models:
        raise ValueError(f"Unknown model: {model_id}. Available: {MODEL_IDS}")

    start = time.time()

    if model_id == "chronos":
        # Fail fast with a clear message instead of hanging on the unreachable
        # huggingface.co fetch. /models already advertises this as blocked.
        if not CHRONOS_USABLE:
            raise RuntimeError(
                f"chronos is not available in this environment: {CHRONOS_BLOCKED_REASON}"
            )
        result = _predict_chronos(values, horizon, confidence_level)
    elif model_id == "sarimax":
        # SARIMAX is the only model that consumes exogenous variables.
        result = STATISTICAL_MODELS["sarimax"](
            values, horizon, confidence_level, exog=exog, future_exog=future_exog
        )
    elif model_id in STATISTICAL_MODELS:
        result = STATISTICAL_MODELS[model_id](values, horizon, confidence_level)
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
    """Return metadata for all available models.

    chronos is included for transparency (it is installed), but its
    `available` flag reflects whether the pretrained weights can actually be
    loaded in this environment. /models MUST NOT imply a blocked model is
    callable — a client picking chronos and calling /predict would otherwise
    hang on the unreachable huggingface.co fetch.
    """
    models = [
        {"id": "arima", "name": "ARIMA", "type": "statistical", "description": "AutoRegressive Integrated Moving Average", "available": True},
        {"id": "sarimax", "name": "SARIMAX", "type": "statistical", "description": "ARIMA with exogenous variables (multivariate: FX, freight, feed, etc.)", "available": True},
        {"id": "holtwinters", "name": "Holt-Winters", "type": "statistical", "description": "Triple exponential smoothing with trend and seasonality", "available": True},
        {"id": "exponential_smoothing", "name": "Exponential Smoothing", "type": "statistical", "description": "Simple exponential smoothing", "available": True},
        {"id": "naive_forecaster", "name": "Naive Forecaster", "type": "statistical", "description": "Last-value baseline forecaster", "available": True},
        {"id": "stl_forecaster", "name": "STL Forecaster", "type": "statistical", "description": "STL decomposition with linear trend extrapolation", "available": True},
    ]
    if CHRONOS_AVAILABLE:
        models.append({
            "id": "chronos", "name": "Chronos-2", "type": "foundation",
            "description": "Amazon Chronos T5 time-series foundation model (pretrained, zero-shot)",
            "available": CHRONOS_USABLE,
            **({"blocked_reason": CHRONOS_BLOCKED_REASON} if CHRONOS_BLOCKED_REASON else {}),
        })
    return models
