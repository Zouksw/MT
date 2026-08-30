"""
Lagged-exog leading-indicator gate (IMPROVEMENT-PLAN v3.1.0 批3, arm A).

Hypothesis (plan): a MONTHLY FX series (BRL or AUD vs USD, both major
beef-export currencies with 25-55y of fred history) LEADS the IMF PBEEFUSDM
beef benchmark. Contemporaneous exog already failed the gate once
(PRED-STRATEGY §3.2: ARIMA 8.10% vs SARIMAX 8.34% on daily) precisely because
a same-period variable carries no forecast-time information — this experiment
tests TRUE lags, where the exog value needed for the forecast month is
already PUBLISHED at forecast time (lag >= 2 months honors the fred
publication delay with margin).

Primary hypothesis note (live_cattle futures lead): INFEASIBLE today —
live_cattle_cme has only ~10 months of history (2025-11..) vs the 36 monthly
rolling origins the gate needs. Registered in the batch report; re-evaluate
when overlap >= ~40 months (2028-11+).

Design (mirrors the 批1 rolling backtest):
  - y: beef_carcass_us monthly closes (interval='monthly', 2010-05..).
  - x: last fred daily close per calendar month for brl_usd / aud_usd.
  - Screening: Pearson corr of monthly log-diffs corr(dy[s], dx[s-L]),
    L = 0..6 — reported for transparency.
  - Gate run: 36 rolling origins x H=1 (H=3 only if best usable lag >= 4:
    the future_exog for step s needs x[s-L] published at origin, i.e. L>=H+1
    with publication margin). exog[s] = x[month(s) - L]. No forward-fill —
    every future exog value is a real, already-published number.
  - Baseline: predict_arima (same engine, same windows, paired).
  - PASS iff sarimax median MAPE <= 0.90 x arima median AND paired win-rate
    > 50%. "增量不显著就不上" (PRED-STRATEGY §五).

Run:
    cd inference-service && source venv/bin/activate
    python experiments/lagged_exog_gate.py
Reads DATABASE_URL from backend/.env. Read-only; no HTTP service involved.
"""

import math
import os
import statistics
import sys

import numpy as np
import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.statistical_models import predict_arima, predict_sarimax  # noqa: E402

N_ORIGINS = 36
MIN_USABLE_LAG = 2  # fred monthly FX publishes mid/late following month; >=2 is safe
GATE_REL_THRESHOLD = 0.90  # sarimax median must be <= 90% of arima's
GATE_WINRATE_THRESHOLD = 0.50


def db_url() -> str:
    with open(os.path.join(os.path.dirname(__file__), "../../backend/.env"), encoding="utf-8") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.strip().split("=", 1)[1].split("?")[0]
    raise RuntimeError("DATABASE_URL not found in backend/.env")


def month_key(d) -> tuple:
    return (d.year, d.month)


def load_series(cur, slug: str, interval: str | None, source: str | None) -> dict:
    sql = (
        "SELECT cp.date, cp.close FROM commodity_prices cp "
        "JOIN commodities c ON c.id = cp.commodity_id WHERE c.slug = %s"
    )
    params: list = [slug]
    if interval:
        sql += " AND cp.interval = %s"
        params.append(interval)
    if source:
        sql += " AND cp.source = %s"
        params.append(source)
    cur.execute(sql + " ORDER BY cp.date", params)
    return {month_key(r[0]): float(r[1]) for r in cur.fetchall()}


def month_shift(key: tuple, delta: int) -> tuple:
    y, m = key
    total = y * 12 + (m - 1) + delta
    return (total // 12, total % 12 + 1)


def pearson(a, b) -> float:
    if len(a) < 3:
        return float("nan")
    a, b = np.asarray(a, float), np.asarray(b, float)
    a -= a.mean()
    b -= b.mean()
    denom = math.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / denom) if denom > 0 else float("nan")


def mape_single(pred: float, actual: float) -> float:
    return abs(pred - actual) / actual * 100


def screen_lags(y: dict, x: dict, label: str) -> list:
    months = sorted(y)
    dy = {(months[i]): math.log(y[months[i]] / y[months[i - 1]]) for i in range(1, len(months))}
    print(f"\nlead-lag screening — {label} (corr of monthly log-diffs, corr(dy[s], dx[s-L]))")
    rows = []
    for lag in range(0, 7):
        pairs = [
            (dy[s], math.log(x[xk] / x[month_shift(xk, -1)]))
            for s in months[1:]
            if (xk := month_shift(s, -lag)) in x and month_shift(xk, -1) in x
        ]
        r = pearson([p[0] for p in pairs], [p[1] for p in pairs])
        n = len(pairs)
        rows.append((lag, r, n))
        print(f"  L={lag}: r={r:+.3f}  (n={n})")
    return rows


def run_gate(y: dict, x: dict, label: str, lag: int, horizon: int) -> dict:
    months = sorted(y)
    arima_mapes, sarimax_mapes = [], []
    for t in range(len(months) - horizon - N_ORIGINS, len(months) - horizon):
        train = [y[m] for m in months[: t + 1]]
        actual = [y[months[t + h]] for h in range(1, horizon + 1)]

        base = predict_arima(train, horizon, 0.9)

        exog_hist, ok = [], True
        for m in months[: t + 1]:
            xm = month_shift(m, -lag)
            if xm not in x:
                ok = False
                break
            exog_hist.append([x[xm]])
        future_exog = []
        for h in range(1, horizon + 1):
            xm = month_shift(months[t + h], -lag)
            if xm not in x:  # not published at origin → this lag/H combo unusable
                ok = False
                break
            future_exog.append([x[xm]])
        if not ok:
            continue

        sx = predict_sarimax(train, horizon, 0.9, exog=exog_hist, future_exog=future_exog)

        arima_mapes.append(mape_single(base["values"][-1], actual[-1]))
        sarimax_mapes.append(mape_single(sx["values"][-1], actual[-1]))

    n = len(arima_mapes)
    if n == 0:
        return {"label": label, "lag": lag, "horizon": horizon, "n": 0}
    wins = sum(1 for a, s in zip(arima_mapes, sarimax_mapes) if s < a)
    med_a, med_s = statistics.median(arima_mapes), statistics.median(sarimax_mapes)
    passed = n >= 20 and med_s <= GATE_REL_THRESHOLD * med_a and wins / n > GATE_WINRATE_THRESHOLD
    print(
        f"\ngate — {label} lag={lag} H={horizon}: n={n} | "
        f"arima median MAPE {med_a:.2f}% vs sarimax {med_s:.2f}% "
        f"(rel {med_s / med_a:.3f}) | win-rate {wins}/{n} = {wins / n:.1%} | "
        f"{'PASS' if passed else 'FAIL'}"
    )
    return {
        "label": label,
        "lag": lag,
        "horizon": horizon,
        "n": n,
        "arima_median": med_a,
        "sarimax_median": med_s,
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
    print(f"beef monthly points: {len(beef)} ({min(beef)}..{max(beef)})")
    print(f"brl_usd(fred) months: {len(brl)} | aud_usd(fred) months: {len(aud)}")

    results = []
    for label, x in [("brl_usd", brl), ("aud_usd", aud)]:
        rows = screen_lags(beef, x, label)
        usable = [r for r in rows if r[0] >= MIN_USABLE_LAG and not math.isnan(r[1])]
        best = max(usable, key=lambda r: abs(r[1]))
        print(f"  -> best usable lag (>= {MIN_USABLE_LAG}): L={best[0]} (r={best[1]:+.3f})")
        results.append(run_gate(beef, x, label, best[0], 1))
        # H=3 needs every forecast-month exog published at origin: L >= 3+1
        if best[0] >= 4:
            results.append(run_gate(beef, x, label, best[0], 3))
        else:
            print(f"  -> H=3 skipped for {label}: lag {best[0]} < 4 (exog unpublished at origin)")

    passed = [r for r in results if r.get("passed")]
    print("\n==== ARM A VERDICT ====")
    print("PASS — sarimax exog wiring is justified" if passed else
          "FAIL — increment not significant; sarimax stays unwired (consistent with the §3.2 gate)")


if __name__ == "__main__":
    main()
