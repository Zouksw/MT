import logging

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
    # Preload Chronos pipelines so the first /predict isn't a 30s cold load.
    # Without this, the consensus pipeline fires 3 variants in parallel on
    # first request, each cold-loading ~30s on CPU, and the backend client
    # times out before any completes. Preloading serializes the loads at boot.
    preload_chronos_pipelines()


def preload_chronos_pipelines():
    """Load all usable Chronos variant pipelines at startup (one-time cost)."""
    import os

    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
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
