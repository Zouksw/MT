"""Tests for services/inference_engine.py — the prediction dispatch + the
chronos quantile-slicing logic.

The quantile slicing (quantiles[0, :, 0] for lower, quantiles[0, :, -1] for
upper) is load-bearing — get an index wrong and the confidence band inverts.
This is the first test to exercise it directly, using a stubbed
ChronosPipeline that returns a known tensor so we can assert the exact
slicing without loading torch/chronos.
"""

import pytest

from services import inference_engine


def test_predict_unknown_model_raises_value_error():
    """An unknown model_id must raise ValueError (→ 422 in the router)."""
    with pytest.raises(ValueError, match="Unknown model"):
        inference_engine.predict(
            model_id="does-not-exist",
            values=[1.0, 2.0, 3.0],
            timestamps=[1, 2, 3],
            horizon=5,
        )


def test_predict_chronos_blocked_raises_runtime_error(monkeypatch):
    """A chronos variant whose weights aren't cached must raise RuntimeError
    (→ 503 in the router), not hang on an HF fetch."""

    # Force the variant to report as blocked.
    monkeypatch.setattr(inference_engine, "CHRONOS_USABLE_VARIANTS", {"chronos_tiny": False})
    monkeypatch.setattr(
        inference_engine,
        "CHRONOS_BLOCKED_VARIANTS",
        {"chronos_tiny": "weights not cached"},
    )

    with pytest.raises(RuntimeError, match="not available"):
        inference_engine.predict(
            model_id="chronos_tiny",
            values=[1.0, 2.0, 3.0],
            timestamps=[1, 2, 3],
            horizon=5,
        )


def test_predict_chronos_quantile_slicing(monkeypatch):
    """The core untested path: _predict_chronos must map the predict_quantiles
    return shape correctly — lower = quantiles[0,:,0], upper = quantiles[0,:,-1],
    mean = mean[0].

    We stub ChronosPipeline with a fake whose predict_quantiles returns a
    known 3x3x3 quantile tensor, then assert the slicing extracts index 0
    (lowest) for lower and index -1 (highest) for upper.
    """

    # We need torch for the tensor construction inside _predict_chronos, but
    # we don't want to depend on it being installed in the test env. Instead,
    # build the test around a fake tensor-like object that supports the same
    # indexing ([0, :, 0] and [0, :, -1]) and .tolist().
    class FakeColumn:
        """Mimics a 1D tensor column (result of quantiles[0, :, k]) with .tolist()."""

        def __init__(self, values):
            self._values = values  # plain list

        def tolist(self):
            return self._values

    class FakeQuantiles:
        """Mimics the quantiles tensor.

        The engine indexes it as quantiles[0, :, 0] and quantiles[0, :, -1],
        which Python passes to __getitem__ as the tuple
        (0, slice(None, None, None), col). We resolve that directly to the
        requested column (skipping the batch dim 0).
        """

        def __init__(self, data):
            self._data = data  # [horizon][n_q]

        def __getitem__(self, key):
            if isinstance(key, tuple) and len(key) == 3:
                _batch, _full_slice, col = key
                return FakeColumn([row[col] for row in self._data])
            raise TypeError(f"unexpected key: {key}")

    class FakeMean:
        """Mimics mean[0] → object with .tolist()."""

        def __init__(self, data):
            self._data = data  # [horizon]

        def __getitem__(self, key):
            if key == 0:
                return FakeColumn(self._data)
            raise TypeError

    class FakePipeline:
        def predict_quantiles(self, inputs, prediction_length, quantile_levels):
            horizon = prediction_length
            n_q = len(quantile_levels)
            # Build a known tensor: row i, col j → 100 + i*10 + j
            quantile_data = [
                [100.0 + i * 10 + j for j in range(n_q)] for i in range(horizon)
            ]
            mean_data = [200.0 + i for i in range(horizon)]
            return FakeQuantiles(quantile_data), FakeMean(mean_data)

    # Wire the fake pipeline into the cache so _get_chronos_pipeline returns it.
    monkeypatch.setattr(
        inference_engine,
        "_chronos_pipelines",
        {"amazon/chronos-t5-tiny": FakePipeline()},
    )
    # Mark the variant as usable so predict() doesn't reject it.
    monkeypatch.setattr(inference_engine, "CHRONOS_USABLE_VARIANTS", {"chronos_tiny": True})
    monkeypatch.setattr(inference_engine, "CHRONOS_BLOCKED_VARIANTS", {})
    # Stub CHRONOS_AVAILABLE so the import-guard branch passes.
    monkeypatch.setattr(inference_engine, "CHRONOS_AVAILABLE", True)

    result = inference_engine._predict_chronos(
        "amazon/chronos-t5-tiny",
        values=[1.0, 2.0, 3.0],
        horizon=3,
        confidence_level=0.9,
    )

    # With n_q=3 quantiles at [0.1, 0.5, 0.9]:
    #   row 0: [100, 101, 102] → lower=100, upper=102
    #   row 1: [110, 111, 112] → lower=110, upper=112
    #   row 2: [120, 121, 122] → lower=120, upper=122
    #   mean: [200, 201, 202]
    assert result["lower_bound"] == [100.0, 110.0, 120.0]
    assert result["upper_bound"] == [102.0, 112.0, 122.0]
    assert result["values"] == [200.0, 201.0, 202.0]
