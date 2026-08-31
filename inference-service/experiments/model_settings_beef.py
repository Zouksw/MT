"""Beef monthly forecasting — model-settings experiment (round-153).

Goal (user): "根据调研报告，尝试不同的模型设置，寻找最适合牛肉价格预测的方案".
Research input: docs/RESEARCH-LLM-NUMERIC-FORECASTING.md (R2 combination
forecast as a tracked line; M4 equal-weight evidence; context-length /
season-period / ARIMA-order as the "settings" knobs worth testing).

Protocol: IDENTICAL to round-136's backtest-monthly-series.ts (expanding
window rolling origin, MAPE = mean over overlapping steps, direction = sign
of last step vs the training anchor) so numbers are directly comparable.
Two additions: MASE (scaled by each origin's in-sample one-step naive MAE)
and skill vs naive_last (relative median-MAPE improvement).

Model families:
  local (statsmodels/sktime/sklearn, deterministic):
    naive, snaive12, arima_{211,110,011,111}, hw_{p7(prod),p12,none},
    ets_damped, ses(prod), theta12, rf_lag12 (EXPERIMENT-ONLY — fitting a
    forest is over the "只用预训练模型" red line for production; kept as
    evidence of what the family is worth, never as a recommendation)
  remote (via the RUNNING inference service :10810, payload-seeded →
    deterministic on replay): chronos_{tiny,mini,base} at ctx ∈
    {full,96,64} — the service takes whatever values[] it is handed, so
    context length is a pure caller-side setting.
  combos (per-origin mean/median over member point forecasts): prod7,
    stat4, chronos3, wide (12 local stat variants), kitchen (wide + rf).

Usage: venv/bin/python experiments/model_settings_beef.py \
         [--data-dir=/tmp/beef_exp] [--out-md=...] [--out-json=...]
Read-only: queries the inference service over HTTP, writes report files.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sktime.forecasting.theta import ThetaForecaster
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

INFERENCE_URL = "http://127.0.0.1:10810/predict"

SERIES = {  # slug -> (origins, include chronos ctx variants)
    "beef_carcass_us": (36, True),
    "beef_retail_us": (24, False),
    "pork_world": (24, False),
    "poultry_world": (24, False),
}
HORIZONS = [1, 3]

PROD7 = ["chronos_tiny", "chronos_mini", "chronos_base", "naive", "arima_211", "hw_p7", "ses"]
# The production pool AFTER the round-153 holtwinters fix (monthly cadence →
# no seasonal term, i.e. hw_none semantics on monthly series).
PROD7FIX = ["chronos_tiny", "chronos_mini", "chronos_base", "naive", "arima_211", "hw_none", "ses"]
STAT4 = ["naive", "arima_211", "hw_p7", "ses"]
CHRONOS3 = ["chronos_tiny", "chronos_mini", "chronos_base"]
WIDE = [
    "naive", "snaive12", "arima_211", "arima_110", "arima_011", "arima_111",
    "hw_p7", "hw_p12", "hw_none", "ets_damped", "ses", "theta12",
]
KITCHEN = WIDE + ["rf_lag12"]
COMBOS = {
    "comb_prod7_mean": PROD7, "comb_prod7_median": PROD7,
    "comb_prod7fix_mean": PROD7FIX, "comb_prod7fix_median": PROD7FIX,
    "comb_stat4_mean": STAT4, "comb_stat4_median": STAT4,
    "comb_chronos3_mean": CHRONOS3, "comb_chronos3_median": CHRONOS3,
    "comb_wide_mean": WIDE, "comb_wide_median": WIDE,
    "comb_kitchen_mean": KITCHEN, "comb_kitchen_median": KITCHEN,
}


# ─── local forecasters ────────────────────────────────────────────────────────

def f_naive(v: list[float], h: int) -> list[float]:
    return [v[-1]] * h


def f_snaive12(v: list[float], h: int) -> list[float]:
    if len(v) < 12:
        return f_naive(v, h)
    return [v[-12 + (i % 12)] for i in range(h)]  # noqa: RUF005 — deliberate


def f_arima(order: tuple[int, int, int]):
    def f(v: list[float], h: int) -> list[float]:
        if len(v) < 4:
            return f_naive(v, h)
        fit = ARIMA(np.asarray(v, dtype=float), order=order).fit()
        return fit.get_forecast(h).predicted_mean.tolist()
    return f


def f_ets(**kw):
    periods = kw.get("seasonal_periods")
    def f(v: list[float], h: int) -> list[float]:
        min_pts = 14 if periods else 2
        if len(v) < min_pts:
            return f_naive(v, h)
        m = ExponentialSmoothing(np.asarray(v, dtype=float), **kw)
        return m.fit().forecast(h).tolist()
    return f


def f_theta(v: list[float], h: int) -> list[float]:
    fc = ThetaForecaster(sp=12)
    fc.fit(pd.Series(np.asarray(v, dtype=float)))
    pred = fc.predict(np.arange(1, h + 1))
    return np.asarray(pred, dtype=float).flatten().tolist()


def f_rf(v: list[float], h: int) -> list[float]:
    LAG = 12
    if len(v) < LAG + 4:
        return f_naive(v, h)
    a = np.asarray(v, dtype=float)
    X = np.lib.stride_tricks.sliding_window_view(a, LAG)[:-1]
    y = a[LAG:]
    m = RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=1)
    m.fit(X, y)
    out, cur = [], list(a[-LAG:])
    for _ in range(h):
        nxt = float(m.predict(np.array([cur]))[0])
        out.append(nxt)
        cur = cur[1:] + [nxt]
    return out


LOCAL = {
    "naive": f_naive, "snaive12": f_snaive12,
    "arima_211": f_arima((2, 1, 1)), "arima_110": f_arima((1, 1, 0)),
    "arima_011": f_arima((0, 1, 1)), "arima_111": f_arima((1, 1, 1)),
    "hw_p7": f_ets(trend="add", seasonal="add", seasonal_periods=7),
    "hw_p12": f_ets(trend="add", seasonal="add", seasonal_periods=12),
    "hw_none": f_ets(trend="add"),
    "ets_damped": f_ets(trend="add", damped_trend=True),
    "ses": f_ets(),
    "theta12": f_theta, "rf_lag12": f_rf,
}


# ─── remote (inference service) ───────────────────────────────────────────────

def remote(client: httpx.Client, model_id: str, v: list[float], h: int, ctx: int | None):
    vals = v if ctx is None else v[-ctx:]
    r = client.post(INFERENCE_URL, json={
        "values": vals, "timestamps": [], "model_id": model_id,
        "horizon": h, "confidence_level": 0.9,
    }, timeout=120.0)
    r.raise_for_status()
    return r.json()["values"]


# ─── metrics ──────────────────────────────────────────────────────────────────

def mape(pred: list[float], act: list[float]) -> float | None:
    s, n = 0.0, 0
    for p, a in zip(pred, act):
        if a != 0 and np.isfinite(a) and np.isfinite(p):
            s += abs((a - p) / a)
            n += 1
    return s / n * 100 if n else None


def mase(pred: list[float], act: list[float], train: list[float]) -> float | None:
    tr = np.abs(np.diff(np.asarray(train, dtype=float))).mean()
    if not np.isfinite(tr) or tr < 1e-12:
        return None
    e = [abs(a - p) for p, a in zip(pred, act) if np.isfinite(p) and np.isfinite(a)]
    return (sum(e) / len(e) / tr) if e else None


def direction(pred: list[float], act: list[float], anchor: float) -> bool | None:
    ps, as_ = np.sign(pred[-1] - anchor), np.sign(act[-1] - anchor)
    return None if ps == 0 or as_ == 0 else bool(ps == as_)


def med(xs: list[float]) -> float | None:
    return statistics.median(xs) if xs else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="/tmp/beef_exp")
    ap.add_argument("--out-md", default="/tmp/beef_exp/report.md")
    ap.add_argument("--out-json", default="/tmp/beef_exp/results.json")
    args = ap.parse_args()

    results: list[dict] = []  # {slug, config, horizon, origin, mape, mase, dir}
    with httpx.Client() as client:
        for slug, (n_origins, with_ctx) in SERIES.items():
            data = json.load(open(Path(args.data_dir) / f"{slug}.json"))
            v = [row["close"] for row in data]
            n = len(v)
            print(f"\n== {slug}: {n} pts {data[0]['d']}..{data[-1]['d']} origins={n_origins} ==")
            t0 = time.time()

            remote_cfgs: dict[str, callable] = {}
            for m in CHRONOS3:
                remote_cfgs[f"{m}@full"] = (m, None)
                if with_ctx:
                    remote_cfgs[f"{m}@96"] = (m, 96)
                    remote_cfgs[f"{m}@64"] = (m, 64)

            for o in range(n - n_origins, n):
                train, anchor = v[:o], v[o - 1]
                origin = data[o]["d"][:7]
                # per-H loop (forecasts are H-dependent)
                for H in HORIZONS:
                    if o + H > n:
                        continue
                    act = v[o:o + H]
                    point: dict[str, list[float]] = {}
                    for name, fn in LOCAL.items():
                        try:
                            point[name] = fn(train, H)
                        except Exception as e:  # noqa: BLE001 — record, don't die
                            results.append(dict(slug=slug, config=name, horizon=H,
                                                origin=origin, mape=None, mase=None,
                                                dir=None, error=repr(e)[:120]))
                    for cname, (mid, ctx) in remote_cfgs.items():
                        try:
                            point[cname] = remote(client, mid, train, H, ctx)
                        except Exception as e:  # noqa: BLE001
                            results.append(dict(slug=slug, config=cname, horizon=H,
                                                origin=origin, mape=None, mase=None,
                                                dir=None, error=repr(e)[:120]))
                    for cname, members in COMBOS.items():
                        ms = [point[m] for m in members if m in point]
                        if not ms:
                            continue
                        arr = np.array(ms, dtype=float)
                        point[cname] = (arr.mean(0) if "mean" in cname
                                        else np.median(arr, axis=0)).tolist()
                    for cname, p in point.items():
                        if any(not np.isfinite(x) for x in p):
                            continue
                        results.append(dict(
                            slug=slug, config=cname, horizon=H, origin=origin,
                            mape=mape(p, act), mase=mase(p, act, train),
                            dir=direction(p, act, anchor),
                        ))
                print(f"  origin {origin} done ({time.time()-t0:.0f}s)", flush=True)

    Path(args.out_json).write_text(json.dumps(results, indent=1))

    # ─── aggregate + report ───────────────────────────────────────────────────
    def agg(slug: str, H: int) -> list[dict]:
        rows = [r for r in results
                if r["slug"] == slug and r["horizon"] == H and r["mape"] is not None]
        out = []
        for cfg in {r["config"] for r in rows}:
            rs = [r for r in rows if r["config"] == cfg]
            mapes = [r["mape"] for r in rs]
            mases = [r["mase"] for r in rs if r["mase"] is not None]
            dirs = [r["dir"] for r in rs if r["dir"] is not None]
            hits = sum(1 for d in dirs if d)
            errs = sum(1 for r in results
                       if r["slug"] == slug and r["horizon"] == H
                       and r["config"] == cfg and r.get("error"))
            out.append(dict(config=cfg, n=len(mapes),
                            mean=sum(mapes) / len(mapes), med=med(mapes),
                            mase=med(mases),
                            dir=(hits / len(dirs) * 100) if dirs else None,
                            hits=hits, ndir=len(dirs), errs=errs))
        base = next((r for r in out if r["config"] == "naive"), None)
        for r in out:
            r["skill"] = (1 - r["med"] / base["med"]) * 100 if base and base["med"] else None
        return sorted(out, key=lambda r: (r["med"] if r["med"] is not None else 9e9))

    L: list[str] = ["# 牛肉月度预测 — 模型设置实验（round-153）", ""]
    for slug in SERIES:
        L.append(f"## {slug}")
        for H in HORIZONS:
            L += [f"### H = {H}", "",
                  "| 配置 | MAPE中位 | MAPE均值 | MASE中位 | 技能vs naive | 方向命中 | n | err |",
                  "|---|---:|---:|---:|---:|---:|---:|---:|"]
            for r in agg(slug, H):
                dir_cell = (
                    "{:.1f}% ({}/{})".format(r["dir"], r["hits"], r["ndir"])
                    if r["dir"] is not None else "—"
                )
                L.append(
                    f"| {r['config']} | {r['med']:.2f}% | {r['mean']:.2f}% | "
                    f"{r['mase']:.3f} | {r['skill']:+.1f}% | {dir_cell} | "
                    f"{r['n']} | {r['errs']} |")
            L.append("")
    Path(args.out_md).write_text("\n".join(L) + "\n")
    print(f"\nreport → {args.out_md}\nraw → {args.out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
