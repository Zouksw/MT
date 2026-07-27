"""Tests for routers/health.py — the /health (liveness) and /ready (readiness)
probes.

/health is a pure liveness check (process up → ok). /ready reflects whether
the primary chronos ensemble can actually serve predictions, so a deployment
with missing weights or failed preload reports not-ready and stops receiving
prediction traffic instead of 500-ing every request.
"""

from services import inference_engine


def test_health_always_ok(client):
    """Liveness must be 200 ok as long as the process responds."""
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


def test_ready_ok_when_at_least_one_variant_loaded(client, monkeypatch):
    """When a chronos variant has cached weights + a loaded pipeline, /ready
    reports ready:true with 200."""

    # Simulate one usable variant and one loaded pipeline.
    monkeypatch.setattr(inference_engine, "CHRONOS_USABLE_VARIANTS", {"chronos_tiny": True})
    monkeypatch.setattr(
        inference_engine,
        "CHRONOS_VARIANTS",
        {"chronos_tiny": "amazon/chronos-t5-tiny"},
    )
    monkeypatch.setattr(
        inference_engine,
        "_chronos_pipelines",
        {"amazon/chronos-t5-tiny": object()},
    )
    monkeypatch.setattr(inference_engine, "_preload_failures", {})

    resp = client.get("/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ready"] is True
    assert "chronos_tiny" in body["ready_variants"]


def test_ready_not_ok_when_no_variants_usable(client, monkeypatch):
    """When no chronos variant has cached weights, /ready reports ready:false
    with 503 — the service is alive but cannot serve predictions."""

    monkeypatch.setattr(
        inference_engine,
        "CHRONOS_USABLE_VARIANTS",
        {"chronos_tiny": False, "chronos_mini": False, "chronos_base": False},
    )
    monkeypatch.setattr(inference_engine, "CHRONOS_VARIANTS", {})
    monkeypatch.setattr(inference_engine, "_chronos_pipelines", {})
    monkeypatch.setattr(inference_engine, "_preload_failures", {})

    resp = client.get("/ready")
    assert resp.status_code == 503
    assert resp.json()["ready"] is False


def test_ready_not_ok_when_preload_failed(client, monkeypatch):
    """Even if weights are cached, a failed preload means the pipeline isn't
    usable — /ready must report ready:false."""

    monkeypatch.setattr(inference_engine, "CHRONOS_USABLE_VARIANTS", {"chronos_tiny": True})
    monkeypatch.setattr(
        inference_engine,
        "CHRONOS_VARIANTS",
        {"chronos_tiny": "amazon/chronos-t5-tiny"},
    )
    # Pipeline dict empty (preload failed) + failure recorded.
    monkeypatch.setattr(inference_engine, "_chronos_pipelines", {})
    monkeypatch.setattr(
        inference_engine,
        "_preload_failures",
        {"amazon/chronos-t5-tiny": "CUDA error"},
    )

    resp = client.get("/ready")
    assert resp.status_code == 503
    body = resp.json()
    assert body["ready"] is False
    assert body["preload_failures"]["amazon/chronos-t5-tiny"] == "CUDA error"
