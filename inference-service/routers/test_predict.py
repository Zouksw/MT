"""Tests for routers/predict.py — the /predict endpoint.

Two layers:

  1. **Validation layer** (no model loaded) — pydantic Field constraints and the
     unknown-model guard. These hit the router without ever touching the
     inference engine, so they stay fast and torch-free.
  2. **Handler layer** — ``monkeypatch`` replaces ``inference_engine.predict``
     with a canned result so we verify the response shape (timestamps stepped
     forward from the last input, bounds echoed) without running a real model.

Run:  cd inference-service && source venv/bin/activate && pytest -q
"""

from typing import Any

# A minimal valid payload reused across tests. Two values + two timestamps is
# the smallest input the schema accepts (min_length=2 on `values`).
BASE_PAYLOAD: dict[str, Any] = {
    "values": [10.0, 11.0, 12.0, 13.0],
    "timestamps": [1_700_000_000_000, 1_700_086_400_000, 1_700_172_800_000, 1_700_259_200_000],
    "model_id": "arima",
    "horizon": 5,
}


def test_predict_rejects_unknown_model(client):
    """An unknown model_id must be a 400, not a 500 or silent default."""
    payload = {**BASE_PAYLOAD, "model_id": "does-not-exist"}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 400


def test_predict_rejects_too_few_values(client):
    """values has min_length=2; a single point cannot seed a forecast."""
    payload = {
        **BASE_PAYLOAD,
        "values": [10.0],
        "timestamps": [1_700_000_000_000],
    }
    # Pydantic validation failure surfaces as 422 in FastAPI.
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 422


def test_predict_rejects_horizon_out_of_range(client):
    """horizon must be 1..100. 0 and 101 are both rejected (422)."""
    for bad in (0, 101):
        resp = client.post("/predict", json={**BASE_PAYLOAD, "horizon": bad})
        assert resp.status_code == 422, f"horizon={bad} should be rejected"


def test_predict_rejects_confidence_out_of_range(client):
    """confidence_level constrained to [0.8, 0.99]."""
    for bad in (0.5, 1.5):
        resp = client.post("/predict", json={**BASE_PAYLOAD, "confidence_level": bad})
        assert resp.status_code == 422


def test_predict_rejects_missing_values(client):
    """values is a required field — omitting it is a 422."""
    resp = client.post("/predict", json={"timestamps": [1, 2], "model_id": "arima"})
    assert resp.status_code == 422


def test_predict_returns_forecast_and_steps_timestamps(client, monkeypatch):
    """With a stubbed engine, /predict returns the forecast shape and steps
    the future timestamps forward from the last input by the detected step."""

    def fake_predict(**kwargs):
        # Return exactly `horizon` points so the length contract is checkable.
        horizon = kwargs["horizon"]
        return {
            "values": [100.0 + i for i in range(horizon)],
            "lower_bound": [99.0 - i for i in range(horizon)],
            "upper_bound": [101.0 + i for i in range(horizon)],
        }

    # Patch where the router imports it from, not the definition site.
    # routers/predict.py does `from services.inference_engine import predict`,
    # which binds `predict` in the router's namespace — so patch THAT binding,
    # not services.inference_engine.predict (the name was already copied).
    monkeypatch.setattr("routers.predict.predict", fake_predict)

    resp = client.post("/predict", json=BASE_PAYLOAD)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    horizon = BASE_PAYLOAD["horizon"]
    assert body["model_id"] == "arima"
    assert len(body["values"]) == horizon
    assert len(body["timestamps"]) == horizon
    # Every bound list must match the horizon length.
    assert len(body["lower_bound"]) == horizon
    assert len(body["upper_bound"]) == horizon

    # Timestamps must be strictly increasing and all greater than the last input.
    last_input_ts = BASE_PAYLOAD["timestamps"][-1]
    assert all(t > last_input_ts for t in body["timestamps"])
    assert body["timestamps"] == sorted(body["timestamps"])


def test_predict_step_inference_from_irregular_timestamps(client, monkeypatch):
    """When timestamps are irregular, the step is ts[-1] - ts[-2]. The future
    series must respect that delta, not assume daily."""

    def fake_predict(**kwargs):
        return {"values": [1.0] * kwargs["horizon"]}

    monkeypatch.setattr("routers.predict.predict", fake_predict)

    # Last gap is 1000ms; future timestamps must be spaced by 1000.
    payload = {
        "values": [5.0, 6.0],
        "timestamps": [10_000, 11_000],
        "model_id": "naive_forecaster",
        "horizon": 3,
    }
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200
    ts = resp.json()["timestamps"]
    assert ts == [12_000, 13_000, 14_000]


def test_predict_batch_returns_one_result_per_request(client, monkeypatch):
    """/predict/batch preserves order and never aborts the whole batch on one
    failure — errors come back inline as {error, model_id}."""

    call_count = {"n": 0}

    def fake_predict(**kwargs):
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise RuntimeError("simulated model failure")
        return {"values": [1.0] * kwargs["horizon"]}

    monkeypatch.setattr("routers.predict.predict", fake_predict)

    requests = [
        {**BASE_PAYLOAD, "model_id": "arima"},
        {**BASE_PAYLOAD, "model_id": "holtwinters"},  # will raise → inline error
        {**BASE_PAYLOAD, "model_id": "naive_forecaster"},
    ]
    resp = client.post("/predict/batch", json=requests)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    # First and third succeed; second is an inline error object.
    assert "values" in body[0]
    assert "error" in body[1] and body[1]["model_id"] == "holtwinters"
    assert "values" in body[2]


def test_predict_batch_rejects_non_list_body(client):
    """/predict/batch expects a JSON array; a single object is a 422."""
    resp = client.post("/predict/batch", json=BASE_PAYLOAD)
    assert resp.status_code == 422


# ─── Input robustness (round-19): bad inputs must 422, not 500 ───────────────


def test_predict_rejects_non_finite_in_values(client):
    """null / NaN / inf in values crash np.array / torch.tensor deep in the
    model code. The field_validator must reject them at the edge (422).

    JSON cannot carry a literal NaN, so we send null — pydantic rejects None
    in list[float] as a type error (also 422). Either way the bad input is
    caught at the schema boundary, not deep in statsmodels.
    """
    payload = {**BASE_PAYLOAD, "values": [10.0, None, 12.0]}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 422


def test_predict_rejects_oversized_values(client):
    """A 10k+ point series risks OOM; capped at MAX_VALUES_LENGTH (422)."""
    payload = {**BASE_PAYLOAD, "values": [1.0] * 10_001}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 422


def test_predict_batch_rejects_oversized_batch(client):
    """/predict/batch is sequential; capped at MAX_BATCH_SIZE (50). 51 → 422."""
    requests = [{**BASE_PAYLOAD} for _ in range(51)]
    resp = client.post("/predict/batch", json=requests)
    assert resp.status_code == 422


def test_predict_maps_engine_value_error_to_422(client, monkeypatch):
    """A ValueError from the engine (e.g. SARIMAX exog mismatch) is a client
    error and must surface as 422, not a generic 500."""

    def fake_predict(**kwargs):
        raise ValueError("exog must have same length as values")

    monkeypatch.setattr("routers.predict.predict", fake_predict)
    resp = client.post("/predict", json=BASE_PAYLOAD)
    assert resp.status_code == 422


def test_predict_maps_runtime_error_to_503(client, monkeypatch):
    """A RuntimeError from the engine (e.g. chronos weights missing) is a
    service-degraded condition and must surface as 503, not 500."""

    def fake_predict(**kwargs):
        raise RuntimeError("chronos_tiny weights not cached")

    monkeypatch.setattr("routers.predict.predict", fake_predict)
    resp = client.post("/predict", json=BASE_PAYLOAD)
    assert resp.status_code == 503


# ─── round-104 / audit C9+C5-adjacent: input hardening ───────────────────────


def test_predict_rejects_timestamps_length_over_cap(client):
    """timestamps had no max_length — an oversized array bypassed the values
    OOM guard while pydantic still allocated the parsed list."""
    payload = {**BASE_PAYLOAD, "timestamps": [1] * 20_001}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 422


def test_predict_rejects_timestamps_values_length_mismatch(client):
    """Shorter timestamps than values used to pass validation and silently
    produce a mis-scaled future time axis in the step inference."""
    payload = {**BASE_PAYLOAD, "timestamps": BASE_PAYLOAD["timestamps"][:2]}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 422


def test_predict_rejects_null_in_exog(client):
    """NaN/inf in exog can flow through SARIMAX as NaN forecasts; reject at
    the edge like values. JSON carries null (pydantic rejects None for float)."""
    payload = {
        **BASE_PAYLOAD,
        "model_id": "sarimax",
        "exog": [[1.0], [2.0], [None], [4.0]],
        "future_exog": [[1.0]] * 5,
    }
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 422
