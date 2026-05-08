from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.inference_engine import predict, MODEL_IDS

router = APIRouter()


class PredictRequest(BaseModel):
    values: list[float] = Field(..., min_length=2, description="Historical time series values")
    timestamps: list[int] = Field(..., description="Timestamps in ms")
    model_id: str = Field(default="arima", description=f"One of: {MODEL_IDS}")
    horizon: int = Field(default=10, ge=1, le=100, description="Number of steps to forecast")
    confidence_level: float = Field(default=0.95, ge=0.8, le=0.99)


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
        step = max((req.timestamps[-1] - req.timestamps[-2]) if len(req.timestamps) > 1 else 86400000, 1)
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
        )
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}") from e

    future_ts = [last_ts + (i + 1) * step for i in range(req.horizon)]

    return PredictResponse(
        timestamps=future_ts,
        values=result["values"],
        lower_bound=result.get("lower_bound"),
        upper_bound=result.get("upper_bound"),
        model_id=req.model_id,
    )


@router.post("/predict/batch")
def predict_batch(requests: list[PredictRequest]):
    results = []
    for req in requests:
        try:
            results.append(predict_handler(req))
        except HTTPException as e:
            results.append({"error": e.detail, "model_id": req.model_id})
    return results
