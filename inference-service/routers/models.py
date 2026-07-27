from fastapi import APIRouter

from services.inference_engine import MODEL_IDS, list_models

router = APIRouter()


@router.get("/models")
def get_models():
    return {"models": list_models(), "model_ids": MODEL_IDS}
