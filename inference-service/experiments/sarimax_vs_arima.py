"""
SARIMAX vs ARIMA — multivariate backtest experiment.

Goal: empirically test whether adding an exogenous (external) variable to the
ARIMA model improves forecast accuracy on real commodity data. This is the
decision gate for the "multivariate forecasting" direction (see prediction
strategy review 2026-07-06).

Design:
  - Target series (y):     crude_oil_cme daily close (40 years, 10193 pts)
  - Exogenous driver (x):  natural_gas_cme daily close (same energy complex)
  - Method: rolling-origin backtest. Walk a cutoff date forward; at each step
    fit on the trailing window, forecast H=10 days, score against actuals.
  - Comparison: same data, same windows, same horizon — only the model differs.
  - Metric: MAPE per forecast, then aggregated to mean / median / win-rate.

Run:
    cd inference-service && source venv/bin/activate
    python experiments/sarimax_vs_arima.py

Reads DATABASE_URL from backend/.env. Does not call the HTTP service — imports
the model functions directly so the result is about model quality, not latency.
"""

import os
import sys
import statistics
from datetime import datetime

import numpy as np
import psycopg2

# Direct import of the project's own model functions (not via HTTP) so the test
# exercises exactly the code path users will hit.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.statistical_models import predict_arima, predict_sarimax  # noqa: E402


# ============================================================================
# Config
# ============================================================================
TARGET_SLUG = "crude_oil_cme"        # y — the series we forecast
EXOG_SLUG = "natural_gas_cme"        # x — the exogenous driver
HORIZON = 10                          # forecast 10 trading days ahead
WINDOW = 500                          # trailing days used to fit each model
N_ROLLOUTS = 60                       # number of rolling-origin forecasts
STEP_BETWEEN = 20                     # days between successive origins
CONFIDENCE_LEVEL = 0.95


def load_env_db_url() -> str:
    """Load DATABASE_URL from backend/.env (strip Prisma's ?schema= query)."""
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend", ".env"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        url = line.strip().split("=", 1)[1].strip('"').strip("'")
                        return url.split("?schema=")[0]
    raise RuntimeError("Could not find DATABASE_URL in backend/.env")


def load_aligned_series(db_url: str, target_slug: str, exog_slug: str):
    """Load two daily series, inner-joined on date so they are perfectly aligned."""
    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT o.date, o.close, g.close
            FROM commodity_prices o
            JOIN commodity_prices g
              ON g.date = o.date
             AND g.interval = 'daily'
            JOIN commodities oc ON oc.id = o.commodity_id AND oc.slug = %s
            JOIN commodities gc ON gc.id = g.commodity_id AND gc.slug = %s
            WHERE o.interval = 'daily'
            ORDER BY o.date ASC
            """,
            (target_slug, exog_slug),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    dates = [r[0] for r in rows]
    y = np.array([float(r[1]) for r in rows], dtype=float)
    x = np.array([float(r[2]) for r in rows], dtype=float)
    return dates, y, x


def mape(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Mean Absolute Percentage Error in percent. Skips zero actuals."""
    actual = np.asarray(actual, dtype=float)
    forecast = np.asarray(forecast, dtype=float)
    mask = actual != 0
    if not mask.any():
        return float("inf")
    return float(np.mean(np.abs((actual[mask] - forecast[mask]) / actual[mask])) * 100)


def run_backtest(dates, y: np.ndarray, x: np.ndarray) -> dict:
    """Rolling-origin backtest comparing ARIMA (univariate) vs SARIMAX (exog)."""
    n = len(y)
    # Start origins after the first full window, stepping forward.
    origins = list(range(WINDOW, n - HORIZON, STEP_BETWEEN))
    if len(origins) > N_ROLLOUTS:
        origins = origins[:N_ROLLOUTS]

    arima_mapes = []
    sarimax_mapes = []
    arima_times = []
    sarimax_times = []
    failures = {"arima": 0, "sarimax": 0}

    for i, origin in enumerate(origins):
        train_y = y[origin - WINDOW : origin].tolist()
        train_x = x[origin - WINDOW : origin].reshape(-1, 1).tolist()
        actual = y[origin : origin + HORIZON]

        if len(actual) < HORIZON:
            break  # ran off the end

        # --- ARIMA (univariate baseline) ---
        t0 = datetime.now()
        try:
            res = predict_arima(train_y, HORIZON, CONFIDENCE_LEVEL)
            arima_mapes.append(mape(actual, res["values"]))
        except Exception as e:
            failures["arima"] += 1
            print(f"  [origin {i}] ARIMA failed: {e}")
        arima_times.append((datetime.now() - t0).total_seconds())

        # --- SARIMAX (with natural_gas as exogenous driver) ---
        t0 = datetime.now()
        try:
            res = predict_sarimax(
                train_y,
                HORIZON,
                CONFIDENCE_LEVEL,
                exog=train_x,
                # Forward-fill last observed exog row for the horizon (slow driver).
                future_exog=None,
            )
            sarimax_mapes.append(mape(actual, res["values"]))
        except Exception as e:
            failures["sarimax"] += 1
            print(f"  [origin {i}] SARIMAX failed: {e}")
        sarimax_times.append((datetime.now() - t0).total_seconds())

    return {
        "arima_mapes": arima_mapes,
        "sarimax_mapes": sarimax_mapes,
        "arima_times": arima_times,
        "sarimax_times": sarimax_times,
        "failures": failures,
        "n_origins": len(origins),
    }


def fmt_stats(name: str, values: list[float]) -> str:
    if not values:
        return f"  {name}: (no successful forecasts)"
    vals = sorted(values)
    median = statistics.median(vals)
    mean = statistics.mean(vals)
    p25 = vals[len(vals) // 4]
    p75 = vals[3 * len(vals) // 4]
    return (
        f"  {name:8s}: n={len(values):3d}  "
        f"mean={mean:6.2f}%  median={median:6.2f}%  "
        f"p25={p25:6.2f}%  p75={p75:6.2f}%  "
        f"min={min(vals):6.2f}%  max={max(vals):6.2f}%"
    )


def main():
    print("=" * 78)
    print("SARIMAX vs ARIMA — Multivariate Backtest Experiment")
    print("=" * 78)
    print(f"Target (y)   : {TARGET_SLUG}")
    print(f"Exogenous(x) : {EXOG_SLUG}")
    print(f"Horizon      : {HORIZON} days")
    print(f"Window       : {WINDOW} days | Rollouts: {N_ROLLOUTS} | Step: {STEP_BETWEEN}")
    print()

    db_url = load_env_db_url()
    dates, y, x = load_aligned_series(db_url, TARGET_SLUG, EXOG_SLUG)
    print(f"Loaded {len(y)} aligned daily observations")
    print(f"  span : {dates[0].date()} → {dates[-1].date()}")
    print(f"  y    : {y.min():.2f} – {y.max():.2f} (last={y[-1]:.2f})")
    print(f"  x    : {x.min():.2f} – {x.max():.2f} (last={x[-1]:.2f})")

    # Sanity: correlation between target and the candidate exogenous driver.
    corr = float(np.corrcoef(y, x)[0, 1])
    print(f"  corr(y, x) = {corr:+.3f}")
    print()

    print("Running rolling-origin backtest...")
    result = run_backtest(dates, y, x)
    print()

    print("-" * 78)
    print("RESULTS — MAPE per forecast (lower is better)")
    print("-" * 78)
    print(fmt_stats("ARIMA", result["arima_mapes"]))
    print(fmt_stats("SARIMAX", result["sarimax_mapes"]))
    print()

    a = result["arima_mapes"]
    s = result["sarimax_mapes"]
    n_pairs = min(len(a), len(s))
    if n_pairs > 0:
        pairs = list(zip(a[:n_pairs], s[:n_pairs]))
        sarimax_wins = sum(1 for ai, si in pairs if si < ai)
        arima_wins = sum(1 for ai, si in pairs if ai < si)
        ties = n_pairs - sarimax_wins - arima_wins
        mean_improvement = statistics.mean(
            [(ai - si) for ai, si in pairs]  # positive = SARIMAX better
        )
        print("-" * 78)
        print("HEAD-TO-HEAD (paired, same forecast origin)")
        print("-" * 78)
        print(f"  Pairs compared       : {n_pairs}")
        print(f"  SARIMAX wins         : {sarimax_wins} ({100*sarimax_wins/n_pairs:.1f}%)")
        print(f"  ARIMA wins           : {arima_wins} ({100*arima_wins/n_pairs:.1f}%)")
        print(f"  Ties                 : {ties}")
        print(f"  Mean MAPE improvement: {mean_improvement:+.2f} percentage points "
              f"(positive = SARIMAX better)")
        print()

        mean_a = statistics.mean(a)
        mean_s = statistics.mean(s)
        rel = (mean_a - mean_s) / mean_a * 100 if mean_a else 0
        print(f"  ARIMA mean MAPE   : {mean_a:.2f}%")
        print(f"  SARIMAX mean MAPE : {mean_s:.2f}%")
        print(f"  Relative change   : {rel:+.1f}%")
    else:
        print("Not enough paired forecasts to compare.")

    print()
    print(f"  Failures: {result['failures']}")
    if result["arima_times"]:
        print(f"  Mean fit time — ARIMA  : {statistics.mean(result['arima_times']):.2f}s")
        print(f"  Mean fit time — SARIMAX: {statistics.mean(result['sarimax_times']):.2f}s")

    print()
    print("=" * 78)
    n_pairs = min(len(a), len(s))
    if n_pairs > 0 and statistics.mean(a) > statistics.mean(s):
        print("CONCLUSION: SARIMAX (multivariate) improves accuracy on this pair.")
        print("→ Recommendation: proceed with multivariate forecasting direction.")
    elif n_pairs > 0:
        print("CONCLUSION: SARIMAX did NOT improve accuracy on this pair.")
        print("→ Consider a different exogenous driver before abandoning direction.")
    print("=" * 78)


if __name__ == "__main__":
    main()
