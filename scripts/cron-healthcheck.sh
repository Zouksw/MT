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

# If PM2 daemon itself is down, resurrect
if ! pm2 ping 2>/dev/null; then
    echo "[$NOW] PM2 daemon down, resurrecting..."
    pm2 resurrect 2>/dev/null || pm2 start /root/ecosystem.config.cjs --env production 2>/dev/null
    RESTARTED="pm2-daemon"
fi

if [ -z "$RESTARTED" ]; then
    echo "[$NOW] All services healthy"
fi

# Dependency-file integrity guard. Catches the recurring pnpm-store/venv
# corruption pattern early (Round 5 js-yaml, Round 7 venv, Round 10
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
