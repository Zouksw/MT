"""Shared pytest fixtures for the inference service.

This establishes the test convention for the Python service (the first tests
written here). Conventions:

  - Test files live next to the module they test: ``routers/test_predict.py``
    covers ``routers/predict.py``.
  - ``client`` is a FastAPI ``TestClient`` built from the real app, so routing,
    pydantic validation, and response models are exercised end to end.
  - Heavy ML deps (torch / chronos / statsmodels) are NEVER loaded in tests.
    Tests that need a prediction result stub ``services.inference_engine.predict``
    via ``monkeypatch`` (see ``routers/test_predict.py``).
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# The service imports modules as top-level (e.g. `from routers import predict`),
# so tests must run with the service root on sys.path. __file__ is at the root.
sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture
def client():
    """A FastAPI TestClient against the real app wiring (no network)."""
    from main import app

    return TestClient(app)
