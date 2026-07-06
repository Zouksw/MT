#!/usr/bin/env bash
# MT — Disk cleanup (runs daily at 3AM via cron)
#
# HISTORY: this script previously ran `pnpm store prune` nightly, which caused
# RECURRING FILE CORRUPTION across three incidents (Round 5 js-yaml lib files,
# Round 7 inference venv .py files, Round 10 is-core-module/core.json). pnpm
# 8.x's prune can mis-classify in-use package files as unreferenced and delete
# them — including non-.js data files like core.json. The pruning saved
# negligible space (store auto-manages) while randomly bricking the build,
# the test suite, and the inference service. DO NOT re-add `pnpm store prune`.
set -euo pipefail

NOW=$(date '+%Y-%m-%d %H:%M:%S')

# 1. (REMOVED) pnpm store prune — see header. Causes more harm than it saves.

# 2. Remove temp files older than 7 days (scoped to /tmp top-level files only)
find /tmp -maxdepth 1 -type f -mtime +7 -delete 2>/dev/null || true
echo "[$NOW] /tmp cleaned (files >7d)"

# 3. Remove old core dumps (scoped: only files literally named core.* under /root,
#    never a recursive scan that could follow symlinks into node_modules/venv)
find /root -maxdepth 2 -name "core.*" -type f -mtime +1 -delete 2>/dev/null || true

# 4. Remove old playwright traces
rm -rf /root/.cache/ms-playwright/ 2>/dev/null || true

# 5. Remove stale PM2 logs older than 30 days (rotate manually since no logrotate
#    covers .logs/)
find /root/.logs -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true

# 6. Disk usage check
USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -gt 90 ]; then
    echo "[$NOW] WARNING: Disk usage at ${USAGE}%!"
    # Emergency: clear npm/pnpm caches (these are safely re-downloadable,
    # unlike the store itself). NEVER touch node_modules or venv.
    rm -rf /root/.npm/_cacache/ /root/.npm/_npx/ 2>/dev/null || true
    echo "[$NOW] Emergency cleanup: cleared npm caches (NOT pnpm store)"
else
    echo "[$NOW] Disk usage: ${USAGE}%"
fi
