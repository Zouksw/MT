#!/usr/bin/env bash
# MT — Health check + auto-restart (runs every 5 min via cron)
set -euo pipefail

NOW=$(date '+%Y-%m-%d %H:%M:%S')
RESTARTED=""

# Check backend (port 8000)
if ! curl -sf -o /dev/null -m 5 http://localhost:8000/health 2>/dev/null; then
    echo "[$NOW] Backend unhealthy, restarting..."
    pm2 restart mt-backend 2>/dev/null || pm2 start /root/ecosystem.config.cjs --only mt-backend --env production 2>/dev/null
    RESTARTED="backend"
fi

# Check frontend (port 3000)
if ! curl -sf -o /dev/null -m 5 http://localhost:3000 2>/dev/null; then
    echo "[$NOW] Frontend unhealthy, restarting..."
    pm2 restart mt-frontend 2>/dev/null || pm2 start /root/ecosystem.config.cjs --only mt-frontend --env production 2>/dev/null
    RESTARTED="${RESTARTED:+$RESTARTED }frontend"
fi

# Check inference service (port 10810) — the AI prediction engine.
# /health is a liveness probe (process up). We DON'T probe /ready here:
# chronos weights loading takes ~90s on cold start, and a 503 from /ready
# during that window is expected, not a fault. Liveness is the right signal
# for the auto-restart decision — if the process isn't responding at all,
# PM2's max_restarts may not have caught it (e.g. process hung, not crashed).
if ! curl -sf -o /dev/null -m 5 http://localhost:10810/health 2>/dev/null; then
    echo "[$NOW] Inference service unhealthy, restarting..."
    pm2 restart mt-inference 2>/dev/null || pm2 start /root/ecosystem.config.cjs --only mt-inference --env production 2>/dev/null
    RESTARTED="${RESTARTED:+$RESTARTED }inference"
fi

# If PM2 daemon itself is down, resurrect
if ! pm2 ping 2>/dev/null; then
    echo "[$NOW] PM2 daemon down, resurrecting..."
    pm2 resurrect 2>/dev/null || pm2 start /root/ecosystem.config.cjs --env production 2>/dev/null
    RESTARTED="pm2-daemon"
fi

if [ -z "$RESTARTED" ]; then
    echo "[$NOW] All services healthy (backend, frontend, inference)"
fi

# Data-layer freshness probe (round-48). /health/ready now reports a dataLayer
# snapshot alongside infra checks. A service can be "up" while the DATA layer is
# silently failing (all scrapers dormant, no fresh prices). This surfaces that
# state in the healthcheck log every 5 min so an operator notices — it does NOT
# restart anything (a restart can't fix a missing API key or a Cloudflare block;
# those need human action). Parses the JSON with python3 (available on the box).
# shellcheck disable=SC2155
DATA_LAYER=$(curl -sf -m 6 http://localhost:8000/health/ready 2>/dev/null | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin).get("data", {}).get("checks", {}).get("dataLayer")
    if d is None:
        print("UNKNOWN")
    else:
        print("{flowing}|{fresh}|{registered}|ratio={ratio:.4f}|debt={debt}".format(
            flowing=d.get("anyDataFlowing"),
            fresh=d.get("freshSourceCount"),
            registered=d.get("registeredSourceCount"),
            ratio=d.get("verificationRatio", 0),
            debt=d.get("hasVerificationDebt")))
except Exception:
    print("PARSE_ERROR")
' 2>/dev/null || echo "PROBE_FAILED")

case "$DATA_LAYER" in
    PROBE_FAILED|PARSE_ERROR|UNKNOWN)
        echo "[$NOW] DATA-LAYER: could not read data health ($DATA_LAYER)"
        ;;
    False*)
        echo "[$NOW] DATA-STALE: no sources writing fresh data ($DATA_LAYER) — scrapers dormant?"
        ;;
    *)
        # Flowing=true. Warn only when verification debt is severe.
        case "$DATA_LAYER" in
            *debt=True*) echo "[$NOW] DATA-OK but verification debt high ($DATA_LAYER)" ;;
        esac
        ;;
esac

# Dependency-file integrity guard. Catches the recurring pnpm-store/venv
# corruption pattern (Round 5 js-yaml, Round 7 venv, Round 10
# is-core-module/core.json) before a silent failure surfaces as a confusing
# build/test/runtime error.
for f in \
    "/root/frontend/node_modules/.pnpm/is-core-module@*/node_modules/is-core-module/core.json" \
    "/root/frontend/node_modules/js-yaml/package.json" \
    "/root/inference-service/venv/bin/python"
do
    # shellcheck disable=SC2086
    if ! ls $f >/dev/null 2>&1; then
        echo "[$NOW] INTEGRITY ALERT: missing $f — possible store corruption"
    fi
done

# mihomo proxy guard (round-103). The cme_futures Yahoo fetcher is the only
# scraper that routes through 127.0.0.1:7890 (SCRAPER_PROXY_URL) — if mihomo
# dies, cme silently writes 0 rows every 6h cycle (per-source catch, no crash,
# no restart). systemd already auto-restarts the unit (Restart=on-failure),
# so this is an observability probe, not a recovery action: alert when the
# unit is not active OR the proxy port stops accepting connections (hung
# process with active unit). Every other scraper fetches direct and is
# unaffected — that asymmetry is why the backend as a whole stays "healthy".
MIHOMO_STATE=$(systemctl is-active mihomo 2>/dev/null || echo "unknown")
if [ "$MIHOMO_STATE" != "active" ] || ! timeout 2 bash -c 'exec 3<>/dev/tcp/127.0.0.1/7890' 2>/dev/null; then
    echo "[$NOW] PROXY-DOWN: mihomo state=$MIHOMO_STATE port 7890 unreachable — cme_futures (Yahoo) will write 0 rows until restored"
fi

# Beef-series staleness + AI-loop beef coverage (round-129 batch 9).
# Both numbers were invisible until round-128's hand-written SQL showed the
# cut board frozen 115+ days and background predictions covering ZERO beef
# series while 17 FX/CME commodities cycled. They now ride /health/ready.
# Logged only on STATE TRANSITION against the previous run's status (state
# file below) plus ONE heartbeat line per day — the freeze is a known steady
# state, and firing every 5 minutes would bury real transitions in noise.
# No restart action: data gaps need human/API-key action, not a process
# bounce. Runbook: docs/guides/WEEKLY-DATA-IMPORT.md; prediction-coverage
# semantics: docs/adr/ADR-0001.
STATE_DIR="/root/.mt-healthcheck"
mkdir -p "$STATE_DIR"
BEEF_STATUS=$(curl -sf -m 6 http://localhost:8000/health/ready 2>/dev/null | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)["data"]["checks"]["dataLayer"]
    parts = ["{0}:latest={1}:stale={2}".format(
                 s.get("key"), s.get("daysSince"), s.get("stale"))
             for s in (d.get("beefSeries") or [])]
    latest = d.get("predictionBeefLatestAt")
    parts.append("predictionBeefCoverage90d={0}".format(d.get("predictionBeefCoverage90d")))
    parts.append("predictionBeefLatestAt={0}".format(latest[:19] if latest else "never"))
    print("|".join(parts) if parts else "EMPTY")
except Exception:
    print("PROBE_FAILED")
' 2>/dev/null || echo "PROBE_FAILED")

if [ "$BEEF_STATUS" != "PROBE_FAILED" ]; then
    PREV=$(cat "$STATE_DIR/beef-state" 2>/dev/null || echo "none")
    if [ "$BEEF_STATUS" != "$PREV" ]; then
        echo "[$NOW] BEEF-DATA state change: $BEEF_STATUS (was: $PREV)"
        echo "$BEEF_STATUS" > "$STATE_DIR/beef-state"
        date +%Y-%m-%d > "$STATE_DIR/beef-heartbeat-day"
    fi
    # Daily heartbeat even when unchanged — proves the probe itself is alive
    # (daysSince bumps naturally make staleness lines daily; coverage lines
    # need this heartbeat or a stable freeze stays silent forever).
    TODAY=$(date +%Y-%m-%d)
    if [ "$(cat "$STATE_DIR/beef-heartbeat-day" 2>/dev/null)" != "$TODAY" ]; then
        echo "[$NOW] BEEF-DATA daily heartbeat: $BEEF_STATUS"
        echo "$TODAY" > "$STATE_DIR/beef-heartbeat-day"
    fi
fi
