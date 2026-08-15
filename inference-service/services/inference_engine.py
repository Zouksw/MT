"""Unified inference engine — Chronos foundation models (primary) + statistical
baselines (comparison only).

Architecture (IoTDB AINode-style): only pretrained / ready-to-use models are
served. The PRIMARY forecasters are three sizes of Amazon Chronos — a zero-shot
pretrained time-series foundation model — used as a multi-size ensemble (tiny /
mini / base) so the consensus pipeline gets model-capacity diversity. The
statistical models (ARIMA, Holt-Winters, etc.) are RETAINED as baselines for
the /ai accuracy-comparison page; they are not part of the main consensus.

No model is trained from scratch on request — the previous Timer-XL/Sundial
online-training path was removed as an anti-pattern.
"""

import logging
import os
import threading
import time
from pathlib import Path

from services.statistical_models import STATISTICAL_MODELS

logger = logging.getLogger(__name__)

# ─── Chronos foundation-model variants (the primary ensemble) ────────────────
# Three T5 sizes for capacity-diversity ensemble voting. The backend consensus
# (tradingSignals ALL_MODELS) votes across these three. Bolt variants are
# skipped — chronos-forecasting 2.3.1 has a config incompat with bolt's
# input_patch_size; the T5 family covers the size spectrum.
CHRONOS_VARIANTS: dict[str, str] = {
    "chronos_tiny": "amazon/chronos-t5-tiny",
    "chronos_mini": "amazon/chronos-t5-mini",
    "chronos_base": "amazon/chronos-t5-base",
}

CHRONOS_AVAILABLE = False
try:
    import torch  # noqa: F401
    from chronos import ChronosPipeline  # noqa: F401

    CHRONOS_AVAILABLE = True
    logger.info("Chronos-forecasting importable")
except ImportError:
    logger.warning("chronos-forecasting not installed — chronos models unavailable")


def _chronos_weights_cached(repo_id: str) -> bool:
    """True iff the given HF repo snapshot is present in any HF cache dir."""
    # repo_id amazon/chronos-t5-tiny → hub/models--amazon--chronos-t5-tiny
    repo_slug = repo_id.replace("/", "--")
    candidates = []
    hf_home = os.environ.get("HF_HOME") or os.environ.get("TRANSFORMERS_CACHE")
    if hf_home:
        candidates.append(Path(hf_home))
    candidates.append(Path.home() / ".cache" / "huggingface")
    for base in candidates:
        snapshot_root = base / "hub" / f"models--{repo_slug}" / "snapshots"
        if snapshot_root.exists() and any(snapshot_root.iterdir()):
            return True
    return False


# Per-variant availability: which chronos variants have cached weights?
# A variant with no cached weights is advertised as blocked (so /models is
# honest and /predict fail-fasts instead of hanging on an HF fetch).
CHRONOS_USABLE_VARIANTS: dict[str, bool] = {}
CHRONOS_BLOCKED_VARIANTS: dict[str, str] = {}
if CHRONOS_AVAILABLE:
    for vid, repo in CHRONOS_VARIANTS.items():
        if _chronos_weights_cached(repo):
            CHRONOS_USABLE_VARIANTS[vid] = True
        else:
            CHRONOS_USABLE_VARIANTS[vid] = False
            CHRONOS_BLOCKED_VARIANTS[vid] = (
                f"weights for {repo} not cached locally "
                "(set HF_ENDPOINT=https://hf-mirror.com and download)"
            )
    usable = [v for v, ok in CHRONOS_USABLE_VARIANTS.items() if ok]
    blocked = [v for v, ok in CHRONOS_USABLE_VARIANTS.items() if not ok]
    logger.info(
        "Chronos variants: usable=%s blocked=%s",
        usable or "none",
        blocked or "none",
    )

# Back-compat single flag (used by older callers): usable if ANY variant is.
CHRONOS_USABLE = any(CHRONOS_USABLE_VARIANTS.values())
CHRONOS_BLOCKED_REASON: str | None = (
    "no chronos variants have cached weights" if not CHRONOS_USABLE else None
)

# ─── Concurrency gate (round-104 / audit C9) ─────────────────────────────────
# Sync route handlers run in anyio's threadpool (default 40 threads). Without
# a gate, the 30-minute consensus refresh (~17 commodities × 3 variants) can
# run up to 40 concurrent CPU-bound chronos forwards — each allocating its
# own intermediate tensors, each defaulting to all-core OpenMP. That
# oversubscription is the RSS 3.5G+ spike PM2 killed at 3769MB
# (2026-08-15). gc.collect / max_memory_restart / MALLOC_ARENA_MAX only
# treated the symptoms; capping concurrent forwards addresses the cause.
# Requests beyond the cap queue in the threadpool instead of exploding RSS.
_CHRONOS_MAX_CONCURRENCY = max(
    1, int(os.environ.get("INFERENCE_MAX_CONCURRENT_CHRONOS", "3"))
)
_chronos_semaphore = threading.Semaphore(_CHRONOS_MAX_CONCURRENCY)

# Serializes ChronosPipeline.from_pretrained — the lazy-init path below was a
# check-then-act race: after a boot-time preload failure, the first concurrent
# request wave could load the SAME repo twice (double weights in RAM) and the
# later writer would clobber the dict entry.
_pipeline_init_lock = threading.Lock()

_all_models: dict[str, None] = {**STATISTICAL_MODELS}
for vid in CHRONOS_VARIANTS:
    _all_models[vid] = None  # chronos handled separately

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
    """Run prediction with the specified model.

    Returns dict with values, lower_bound, upper_bound.
    """
    if model_id not in _all_models:
        raise ValueError(f"Unknown model: {model_id}. Available: {MODEL_IDS}")

    start = time.time()

    if model_id in CHRONOS_VARIANTS:
        # Fail fast if this variant's weights aren't cached — never hang on HF.
        if not CHRONOS_USABLE_VARIANTS.get(model_id):
            raise RuntimeError(
                f"{model_id} is not available: {CHRONOS_BLOCKED_VARIANTS.get(model_id, 'unknown')}"
            )
        result = _predict_chronos(CHRONOS_VARIANTS[model_id], values, horizon, confidence_level)
    elif model_id == "sarimax":
        # SARIMAX is the only statistical model that consumes exogenous variables.
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
    repo_id: str,
    values: list[float],
    horizon: int,
    confidence_level: float,
) -> dict:
    if not CHRONOS_AVAILABLE:
        raise RuntimeError("chronos-forecasting not installed")

    import torch

    pipeline = _get_chronos_pipeline(repo_id)
    # chronos-forecasting 2.3.1 API: predict_quantiles takes a LIST of tensors
    # (batched) and returns (quantiles[batch, horizon, n_q], mean[batch, horizon]).
    lower_q = round(1 - confidence_level, 4)
    quantile_levels = sorted({lower_q, 0.5, confidence_level})
    # inference_mode disables gradient tracking — the prediction is read-only,
    # no backprop is needed. Without this, PyTorch retains the autograd graph
    # for every intermediate tensor across predict_quantiles calls, causing RSS
    # to climb ~200MB/prediction until PM2's max_memory_restart (2G) recycles
    # the process every ~30min (119 restarts observed). inference_mode is the
    # standard remedy for inference-only workloads and is strictly cheaper than
    # no_grad (it also disables version counting + dispatch).
    with _chronos_semaphore, torch.inference_mode():
        ctx = torch.tensor(values, dtype=torch.float32)
        quantiles, mean = pipeline.predict_quantiles(
            inputs=[ctx],
            prediction_length=horizon,
            quantile_levels=quantile_levels,
        )
        # quantiles shape: [1, horizon, n_q]; index 0 = lowest q, -1 = highest q.
        result = {
            "values": mean[0].tolist(),
            "lower_bound": quantiles[0, :, 0].tolist(),
            "upper_bound": quantiles[0, :, -1].tolist(),
        }
        # Explicitly release tensors before exiting the context — the .tolist()
        # calls above have already copied values to plain Python lists, so the
        # tensors can be freed immediately rather than waiting for GC.
        del ctx, quantiles, mean
    return result


# ─── Pipeline cache (load each variant's weights ONCE, not per-request) ──────
# from_pretrained is expensive (~3-30s on CPU depending on variant). Reloading
# on every /predict call made even warmed requests time out. Cache the loaded
# ChronosPipeline by repo_id for the process lifetime.
_chronos_pipelines: dict[str, object] = {}

# Record of chronos variants whose boot-time preload failed. A variant here
# is technically usable (weights cached) but its pipeline failed to construct
# — /predict will raise RuntimeError on first use. /ready exposes this so a
# deployment can tell "all primary models failed to load" from "healthy".
_preload_failures: dict[str, str] = {}


def record_preload_failure(repo_id: str, error: str) -> None:
    """Called by main.startup when a chronos pipeline fails to preload."""
    _preload_failures[repo_id] = error


def readiness_state() -> dict:
    """Snapshot of chronos readiness for the /ready probe.

    `ready` is True iff at least one primary (chronos) variant has both
    cached weights AND a successfully preloaded pipeline. Baseline
    statistical models are always available (no weights), so they don't
    factor into readiness — only the primary ensemble does.
    """
    usable = {vid: ok for vid, ok in CHRONOS_USABLE_VARIANTS.items()}
    loaded = {repo: True for repo in _chronos_pipelines}
    failures = dict(_preload_failures)
    # A variant is ready if weights are cached and it's in the pipeline cache
    # and not in the failure log.
    ready_variants = [
        vid
        for vid, repo in CHRONOS_VARIANTS.items()
        if usable.get(vid) and repo in loaded and repo not in failures
    ]
    ready = len(ready_variants) > 0
    return {
        "ready": ready,
        "chronos_usable_variants": usable,
        "chronos_pipelines_loaded": sorted(loaded),
        "preload_failures": failures,
        "ready_variants": ready_variants,
    }


def chronos_concurrency_limit() -> int:
    """Configured max concurrent chronos forwards (observability/tests)."""
    return _CHRONOS_MAX_CONCURRENCY


def _get_chronos_pipeline(repo_id: str):
    """Return a cached ChronosPipeline for repo_id, loading it on first use.

    Double-checked under _pipeline_init_lock so concurrent first-requests
    load each repo exactly once.
    """
    cached = _chronos_pipelines.get(repo_id)
    if cached is not None:
        return cached
    with _pipeline_init_lock:
        if repo_id in _chronos_pipelines:
            return _chronos_pipelines[repo_id]

        import torch
        from chronos import ChronosPipeline

        logger.info("Loading Chronos pipeline for %s (one-time cost)...", repo_id)
        t0 = time.time()
        pipeline = ChronosPipeline.from_pretrained(
            repo_id, device_map="cpu", dtype=torch.float32
        )
        logger.info("Loaded %s in %.1fs", repo_id, time.time() - t0)
        # Clear any stale boot-time preload failure for this repo. A transient
        # startup failure (OOM, HF cache lock) is permanently recorded in
        # _preload_failures, but if the on-demand load here succeeds the repo
        # IS ready — readiness_state() must not exclude it forever.
        _preload_failures.pop(repo_id, None)
        _chronos_pipelines[repo_id] = pipeline
        return pipeline


def list_models() -> list[dict]:
    """Return metadata for all models.

    Statistical models are tagged role='baseline' (kept for /ai comparison);
    chronos variants are role='foundation' (the primary consensus ensemble).
    Each chronos variant reports its own availability — /models must not imply
    a variant whose /predict would fail-fast.
    """
    models = [
        {
            "id": "arima", "name": "ARIMA", "type": "statistical", "role": "baseline",
            "description": "AutoRegressive Integrated Moving Average", "available": True,
        },
        {
            "id": "sarimax", "name": "SARIMAX", "type": "statistical", "role": "baseline",
            "description": "ARIMA with exogenous variables (multivariate)", "available": True,
        },
        {
            "id": "holtwinters", "name": "Holt-Winters", "type": "statistical", "role": "baseline",
            "description": "Triple exponential smoothing with trend and seasonality",
            "available": True,
        },
        {
            "id": "exponential_smoothing", "name": "Exponential Smoothing",
            "type": "statistical", "role": "baseline",
            "description": "Simple exponential smoothing", "available": True,
        },
        {
            "id": "naive_forecaster", "name": "Naive Forecaster",
            "type": "statistical", "role": "baseline",
            "description": "Last-value baseline forecaster (dumb baseline)", "available": True,
        },
        {
            "id": "stl_forecaster", "name": "STL Forecaster",
            "type": "statistical", "role": "baseline",
            "description": "STL decomposition with damped-trend extrapolation", "available": True,
        },
    ]
    # Chronos variants — the primary ensemble.
    variant_meta = {
        "chronos_tiny": ("Chronos-T5-Tiny", "Smallest Chronos T5 variant (fastest)"),
        "chronos_mini": ("Chronos-T5-Mini", "Mid-size Chronos T5 variant"),
        "chronos_base": ("Chronos-T5-Base", "Largest Chronos T5 variant (most accurate)"),
    }
    for vid, repo in CHRONOS_VARIANTS.items():
        name, desc = variant_meta[vid]
        entry = {
            "id": vid, "name": name, "type": "foundation", "role": "primary",
            "description": (
                f"{desc} — Amazon Chronos zero-shot pretrained "
                f"time-series foundation model ({repo})"
            ),
            "available": CHRONOS_USABLE_VARIANTS.get(vid, False),
        }
        blocked = CHRONOS_BLOCKED_VARIANTS.get(vid)
        if blocked:
            entry["blocked_reason"] = blocked
        models.append(entry)
    return models
