#!/usr/bin/env bash
# MT — Disk cleanup (runs daily at 3AM via cron)
# Storage policy reference: docs/AUTOMATION-STATUS.md §存储管理策略 (2026-08-15)
#
# HISTORY: this script previously ran `pnpm store prune` nightly, which caused
# RECURRING FILE CORRUPTION across three incidents (Round 5 js-yaml lib files,
# Round 7 inference venv .py files, Round 10 is-core-module/core.json). pnpm
# 8.x's prune can mis-classify in-use package files as unreferenced and delete
# them — including non-.js data files like core.json. The pruning saved
# negligible space (store auto-manages) while randomly bricking the build,
# the test suite, and the inference service. DO NOT re-add `pnpm store prune`.
#
# RED LINES (never clean these): pnpm store (~/.local/share/pnpm), project
# node_modules, inference-service/venv, HF weights cache (~/.cache/huggingface),
# ~/.vscode-server/extensions, /root/backups (bounded by backup-db.sh KEEP_COUNT).
set -euo pipefail

NOW=$(date '+%Y-%m-%d %H:%M:%S')

# 1. (REMOVED) pnpm store prune — see header. Causes more harm than it saves.

# 2. Remove temp files older than 7 days (scoped to /tmp top-level files only)
find /tmp -maxdepth 1 -type f -mtime +7 -delete 2>/dev/null || true
echo "[$NOW] /tmp cleaned (files >7d)"

# 3. Remove old core dumps (scoped: only files literally named core.* under /root,
#    never a recursive scan that could follow symlinks into node_modules/venv)
find /root -maxdepth 2 -name "core.*" -type f -mtime +1 -delete 2>/dev/null || true

# 4. Remove playwright browsers (re-downloadable on demand)
rm -rf /root/.cache/ms-playwright/ 2>/dev/null || true

# 5. App log retention (30d). Two patterns: active *.log files, AND dated
#    rotations (*-YYYYMMDD and *-YYYYMMDD.gz) — the dated files don't end in
#    .log, so the original single pattern let them accumulate forever.
find /root/.logs -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true
find /root/.logs -name "*-20*" -type f -mtime +30 -delete 2>/dev/null || true
echo "[$NOW] .logs retention applied (30d)"

# 6. journald: enforce the 200M cap actively (the drop-in
#    /etc/systemd/journald.conf.d/mt-storage.conf caps growth between runs)
journalctl --vacuum-size=200M >/dev/null 2>&1 || true

# 7. VS Code remote server builds: keep only the newest (~400M each; a
#    reconnecting client whose version is missing re-downloads it
#    automatically). Extensions and data dirs are NOT touched.
if [ -d /root/.vscode-server/cli/servers ]; then
    ls -1t /root/.vscode-server/cli/servers 2>/dev/null | grep '^Stable-' | tail -n +2 | \
        while read -r old; do rm -rf "/root/.vscode-server/cli/servers/$old"; done
fi

# 8. Disk usage — staged response
USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -ge 90 ]; then
    echo "[$NOW] WARNING: Disk usage at ${USAGE}%!"
    # Emergency: npm caches + apt cache are safely re-downloadable.
    # NEVER touch pnpm store / node_modules / venv.
    rm -rf /root/.npm/_cacache/ /root/.npm/_npx/ 2>/dev/null || true
    apt-get clean -qq 2>/dev/null || true
    echo "[$NOW] Emergency cleanup: cleared npm + apt caches (NOT pnpm store)"
elif [ "$USAGE" -ge 80 ]; then
    echo "[$NOW] NOTICE: Disk usage at ${USAGE}% — soft cleanup"
    rm -rf /root/.npm/_npx/ 2>/dev/null || true
    apt-get clean -qq 2>/dev/null || true
else
    echo "[$NOW] Disk usage: ${USAGE}%"
fi
