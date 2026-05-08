import logging

import uvicorn
from fastapi import FastAPI

from config import settings
from routers import health, models, predict

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

app = FastAPI(title="MT Inference Service", version="1.0.0")

app.include_router(predict.router, tags=["predict"])
app.include_router(models.router, tags=["models"])
app.include_router(health.router, tags=["health"])


@app.on_event("startup")
def startup():
    logger.info(f"Inference service starting on {settings.host}:{settings.port}")
    logger.info(f"Available models: arima, holtwinters, exponential_smoothing, naive_forecaster, stl_forecaster, timer_xl, sundial, chronos")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
