import logging
import os

# HF_ENDPOINT must be set BEFORE importing the engine — huggingface_hub bakes
# ENDPOINT into a module constant at import time, so a setdefault that runs
# after the import chain is dead code (bare `uvicorn main:app` would still
# hit the walled huggingface.co and hang ~30s per request).
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

import uvicorn
from fastapi import FastAPI

from config import settings
from routers import health, models, predict
from services.inference_engine import MODEL_IDS

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

app = FastAPI(title="MT Inference Service", version="1.0.0")

app.include_router(predict.router, tags=["predict"])
app.include_router(models.router, tags=["models"])
app.include_router(health.router, tags=["health"])


@app.on_event("startup")
def startup():
    logger.info(f"Inference service starting on {settings.host}:{settings.port}")
    logger.info(f"Available models: {', '.join(MODEL_IDS)}")
    _apply_torch_thread_budget()
    # Preload Chronos pipelines so the first /predict isn't a 30s cold load.
    # Without this, the consensus pipeline fires 3 variants in parallel on
    # first request, each cold-loading ~30s on CPU, and the backend client
    # times out before any completes. Preloading serializes the loads at boot.
    preload_chronos_pipelines()


def _apply_torch_thread_budget() -> None:
    """Cap torch intra-op threads (default: all cores per forward).

    With up to N concurrent chronos forwards now allowed by the engine's
    semaphore, all-core OpenMP per forward would oversubscribe the CPU
    (audit C9). A fixed budget keeps aggregate CPU sane; single-request
    latency on an 8-core box barely moves at 4 threads. Override with
    TORCH_NUM_THREADS.
    """
    try:
        import torch

        n = max(1, int(os.environ.get("TORCH_NUM_THREADS", "4")))
        torch.set_num_threads(n)
        logger.info(f"torch intra-op threads set to {n}")
    except ImportError:
        logger.info("torch not installed — skipping thread budget")
    except Exception as e:  # never block startup on a thread knob
        logger.warning(f"torch.set_num_threads failed: {e}")


def preload_chronos_pipelines():
    """Load all usable Chronos variant pipelines at startup (one-time cost)."""
    try:
        from services.inference_engine import (
            CHRONOS_USABLE_VARIANTS,
            CHRONOS_VARIANTS,
            _get_chronos_pipeline,
            record_preload_failure,
        )

        for vid, repo in CHRONOS_VARIANTS.items():
            if CHRONOS_USABLE_VARIANTS.get(vid):
                try:
                    _get_chronos_pipeline(repo)
                except Exception as e:
                    # Record the failure so /ready can report it — a variant
                    # whose weights are cached but whose pipeline failed to
                    # construct must not be advertised as ready.
                    record_preload_failure(repo, str(e))
                    logger.warning(f"Preload failed for {vid} ({repo}): {e}")
            else:
                logger.info(f"Skipping preload for {vid} — weights not cached")
    except Exception as e:
        logger.warning(f"Chronos preload skipped: {e}")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
