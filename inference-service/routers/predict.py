import gc
import math
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from services.inference_engine import MODEL_IDS, predict

router = APIRouter()

# Guards against pathological inputs that would otherwise crash deep inside
# statsmodels / torch and surface as an opaque 500.
MAX_VALUES_LENGTH = 10_000  # a 10k-point series is already large; bigger risks OOM
MAX_BATCH_SIZE = 50  # cap to bound latency and memory per request

# Batch worker budget (round-105): chronos forwards are already capped at 3
# concurrent by the engine semaphore, and statistical fits are GIL-bound, so
# a pool of 4 captures the available parallelism (was: a serial for-loop —
# a 9-model ensemble batch paid the sum of every model's latency) without
# multiplying memory pressure (R4: concurrent chronos RSS spikes).
BATCH_MAX_WORKERS = 4


class PredictRequest(BaseModel):
    values: list[float] = Field(
        ..., min_length=2, max_length=MAX_VALUES_LENGTH, description="Historical time series values"
    )
    # Same length cap as values — an unbounded timestamps array bypassed the
    # OOM guard while pydantic still parsed it (audit round-104).
    timestamps: list[int] = Field(
        ..., max_length=MAX_VALUES_LENGTH, description="Timestamps in ms"
    )
    model_id: str = Field(default="arima", description=f"One of: {MODEL_IDS}")
    horizon: int = Field(default=10, ge=1, le=100, description="Number of steps to forecast")
    confidence_level: float = Field(default=0.95, ge=0.8, le=0.99)
    # Exogenous (external) variables for SARIMAX. Optional — only the "sarimax"
    # model consumes them; other models ignore them. Shape: (n_obs, n_factors).
    exog: list[list[float]] | None = Field(
        default=None, description="Historical exogenous variables (SARIMAX only)"
    )
    future_exog: list[list[float]] | None = Field(
        default=None, description="Forecast-window exogenous variables (SARIMAX only)"
    )

    @field_validator("values")
    @classmethod
    def _reject_non_finite(cls, v: list[float]) -> list[float]:
        """NaN / inf pass pydantic's float type but crash np.array / torch.tensor
        deep in the model code, surfacing as an opaque 500. Reject them at the
        edge with a clear 422 instead."""
        for i, x in enumerate(v):
            if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
                raise ValueError(f"values[{i}] is {x}; NaN/inf are not valid time-series points")
        return v

    @field_validator("exog", "future_exog")
    @classmethod
    def _reject_non_finite_exog(cls, v: list[list[float]] | None) -> list[list[float]] | None:
        """Same NaN/inf guard as values — pydantic-core accepts NaN literals in
        nested float lists, and NaN exog can flow through SARIMAX as NaN
        forecasts instead of raising (audit round-104)."""
        if v is None:
            return v
        for i, row in enumerate(v):
            for j, x in enumerate(row):
                if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
                    raise ValueError(f"exog[{i}][{j}] is {x}; NaN/inf are not valid inputs")
        return v

    @model_validator(mode="after")
    def _timestamps_align_with_values(self) -> "PredictRequest":
        """The step inference below reads timestamps[-1] - timestamps[-2] to
        build the future axis; a timestamps array shorter than values silently
        produces a mis-scaled or empty time axis."""
        if len(self.timestamps) > 0 and len(self.timestamps) != len(self.values):
            raise ValueError(
                f"timestamps length ({len(self.timestamps)}) must match values "
                f"length ({len(self.values)}) or be empty"
            )
        return self


class PredictResponse(BaseModel):
    timestamps: list[int]
    values: list[float]
    lower_bound: list[float] | None = None
    upper_bound: list[float] | None = None
    model_id: str


@router.post("/predict", response_model=PredictResponse)
def predict_handler(req: PredictRequest):
    if req.model_id not in MODEL_IDS:
        raise HTTPException(400, f"Unknown model_id: {req.model_id}. Available: {MODEL_IDS}")

    if len(req.timestamps) > 0:
        last_ts = req.timestamps[-1]
        step = max(
            (req.timestamps[-1] - req.timestamps[-2])
            if len(req.timestamps) > 1
            else 86_400_000,
            1,
        )
    else:
        last_ts = 0
        step = 86400000

    try:
        result = predict(
            model_id=req.model_id,
            values=req.values,
            timestamps=req.timestamps,
            horizon=req.horizon,
            confidence_level=req.confidence_level,
            exog=req.exog,
            future_exog=req.future_exog,
        )
    except ValueError as e:
        # ValueError from the engine signals a bad-input condition (e.g.
        # SARIMAX exog-length mismatch, unknown model) — a client error, not
        # a server fault. Surface as 422 so callers can distinguish.
        raise HTTPException(422, f"Invalid input: {e}") from e
    except RuntimeError as e:
        # RuntimeError signals an environment/availability issue (e.g. chronos
        # weights not cached) — a service-degraded condition, 503.
        raise HTTPException(503, f"Model unavailable: {e}") from e
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}") from e

    future_ts = [last_ts + (i + 1) * step for i in range(req.horizon)]

    # torch/statsmodels wrappers create reference cycles that refcounting
    # alone doesn't reclaim; under the 30-min × multi-commodity prediction
    # burst the residue accumulates and RSS climbs until PM2's
    # max-memory-restart kills the process (observed 2026-08-15: crossed
    # the 3.5G cap at a burst peak). An explicit collect per request keeps
    # steady-state RSS flat. Cheap (~ms) when there is little to collect.
    gc.collect()

    return PredictResponse(
        timestamps=future_ts,
        values=result["values"],
        lower_bound=result.get("lower_bound"),
        upper_bound=result.get("upper_bound"),
        model_id=req.model_id,
    )


def _run_batch_item(req: PredictRequest):
    """Run one batch entry, converting failures to per-item error objects.

    Extracted so the serial and parallel paths share identical semantics:
    an HTTPException (already mapped 422/503/500 by predict_handler) becomes
    {"error", "model_id"} without aborting the batch; anything else escapes
    and fails the request, same as the old serial loop.
    """
    try:
        return predict_handler(req)
    except HTTPException as e:
        return {"error": e.detail, "model_id": req.model_id}


@router.post("/predict/batch")
def predict_batch(requests: list[PredictRequest]):
    if len(requests) > MAX_BATCH_SIZE:
        raise HTTPException(
            422,
            f"Batch too large: {len(requests)} requests (max {MAX_BATCH_SIZE}).",
        )
    if len(requests) <= 1:
        return [_run_batch_item(req) for req in requests]
    # executor.map preserves input order and defers raised exceptions to
    # iteration, so the response contract is byte-identical to the serial
    # loop while the items run concurrently (bounded by BATCH_MAX_WORKERS).
    with ThreadPoolExecutor(max_workers=min(len(requests), BATCH_MAX_WORKERS)) as pool:
        return list(pool.map(_run_batch_item, requests))
