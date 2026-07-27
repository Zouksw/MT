from fastapi import APIRouter

from services.inference_engine import readiness_state

router = APIRouter()


@router.get("/health")
def health():
    """Liveness probe — always returns ok if the process is up.

    This does NOT reflect whether chronos models are usable. Use /ready for
    that. Keeping /health as a pure liveness check lets orchestrators
    distinguish 'restart the process' (liveness fail) from 'don't route
    traffic yet' (readiness fail).
    """
    return {"status": "ok", "service": "inference-service"}


@router.get("/ready")
def ready():
    """Readiness probe — reflects whether the primary (chronos) ensemble can
    actually serve predictions.

    A deployment where all chronos weights are missing or preloading failed
    will report ready:false here, so a load balancer can stop routing
    prediction traffic until it recovers — instead of reporting 'healthy'
    and 500-ing every /predict (the old behavior with a static /health).
    """
    state = readiness_state()
    status_code = 200 if state["ready"] else 503
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=status_code, content=state)
