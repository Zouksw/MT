"""
Chronos-2 covariate gate (IMPROVEMENT-PLAN v3.1.0 批3, arm B).

Zero-shot multivariate test of the SAME leading-indicator hypothesis arm A
tested statistically: does giving Chronos-2 (120M encoder, native past/future
covariates — same-family upgrade per D6's exception clause) the lagged FX
covariate improve its beef-monthly forecasts vs its own univariate runs?
Same 36 rolling origins x H in {1,3}, same lag L=5 (arm A's best usable), same
"增量不显著就不上" gate. Family-internal pairing isolates the covariate
increment; the arima champion (1.46% / 2.64% from docs/backtests/
beef-monthly-2026-08.md) is the reference bar for context.

Run:
    cd inference-service && source venv/bin/activate
    HF_ENDPOINT=https://hf-mirror.com python experiments/chronos2_covariate_gate.py
Reads DATABASE_URL from backend/.env. Read-only; no HTTP service involved.
"""

import os
import statistics
import sys

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import psycopg2  # noqa: E402
from chronos import Chronos2Pipeline  # noqa: E402
from lagged_exog_gate import (  # noqa: E402
    GATE_REL_THRESHOLD,
    GATE_WINRATE_THRESHOLD,
    N_ORIGINS,
    db_url,
    load_series,
    mape_single,
    month_shift,
)

LAG = 5  # arm A's best usable lag for both brl and aud
SEED = 20260830
MODEL_ID = "amazon/chronos-2"


def median_forecast(pipe, payload, horizon: int) -> float:
    # Chronos-2 returns ALL model quantiles (1, n_quantiles, H); pick the
    # level nearest 0.5 as the point forecast. Seeded per call — the 批1
    # determinism contract (sequential callers reproduce bit-identically).
    torch.manual_seed(SEED)
    out = pipe.predict([payload], prediction_length=horizon)
    q = [float(x) for x in pipe.quantiles]
    idx = min(range(len(q)), key=lambda i: abs(q[i] - 0.5))
    return float(out[0][0, idx, -1].item())


def run_family(pipe, y: dict, x: dict, label: str, horizon: int) -> dict:
    months = sorted(y)
    uni_mapes, cov_mapes = [], []
    for t in range(len(months) - horizon - N_ORIGINS, len(months) - horizon):
        target = np.array([y[m] for m in months[: t + 1]], dtype=np.float32)
        actual = [y[months[t + h]] for h in range(1, horizon + 1)]

        uni = median_forecast(pipe, {"target": target}, horizon)

        # lagged covariate: exog value for month s is x[s - L], index-aligned
        # to the target months; future values are all PUBLISHED at the origin
        past_x = []
        for m in months[: t + 1]:
            xm = month_shift(m, -LAG)
            if xm not in x:
                past_x = None
                break
            past_x.append(x[xm])
        future_x = []
        for h in range(1, horizon + 1):
            xm = month_shift(months[t + h], -LAG)
            if xm not in x:
                future_x = None
                break
            future_x.append(x[xm])
        if past_x is None or future_x is None:
            continue

        cov = median_forecast(
            pipe,
            {
                "target": target,
                "past_covariates": {"fx": np.array(past_x, dtype=np.float32)},
                "future_covariates": {"fx": np.array(future_x, dtype=np.float32)},
            },
            horizon,
        )

        uni_mapes.append(mape_single(uni, actual[-1]))
        cov_mapes.append(mape_single(cov, actual[-1]))

    n = len(uni_mapes)
    if n == 0:
        return {"label": label, "horizon": horizon, "n": 0}
    wins = sum(1 for u, c in zip(uni_mapes, cov_mapes) if c < u)
    med_u, med_c = statistics.median(uni_mapes), statistics.median(cov_mapes)
    passed = (
        n >= 20
        and med_c <= GATE_REL_THRESHOLD * med_u
        and wins / n > GATE_WINRATE_THRESHOLD
    )
    print(
        f"gate — chronos-2 + {label} cov (L={LAG}) H={horizon}: n={n} | "
        f"univariate median MAPE {med_u:.2f}% vs covariate {med_c:.2f}% "
        f"(rel {med_c / med_u:.3f}) | win-rate {wins}/{n} = {wins / n:.1%} | "
        f"{'PASS' if passed else 'FAIL'}"
    )
    return {
        "label": label,
        "horizon": horizon,
        "n": n,
        "univariate_median": med_u,
        "covariate_median": med_c,
        "win_rate": wins / n,
        "passed": passed,
    }


def main() -> None:
    conn = psycopg2.connect(db_url())
    cur = conn.cursor()
    beef = load_series(cur, "beef_carcass_us", "monthly", None)
    brl = load_series(cur, "brl_usd", None, "fred")
    aud = load_series(cur, "aud_usd", None, "fred")
    conn.close()

    print(f"loading {MODEL_ID} (HF_ENDPOINT={os.environ.get('HF_ENDPOINT', 'default')}) ...")
    pipe = Chronos2Pipeline.from_pretrained(MODEL_ID)  # loads on CPU by default

    results = []
    for label, x in [("brl_usd", brl), ("aud_usd", aud)]:
        for h in (1, 3):
            results.append(run_family(pipe, beef, x, label, h))

    passed = [r for r in results if r.get("passed")]
    print("\n==== ARM B VERDICT ====")
    print("PASS — chronos-2 covariates justify candidate-model onboarding" if passed else
          "FAIL — no significant covariate increment; chronos-2 stays unwired"
        " (D6: tested, not adopted)")


if __name__ == "__main__":
    main()
