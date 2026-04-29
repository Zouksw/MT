#!/usr/bin/env bash
# MT — Disk cleanup (runs daily at 3AM via cron)
set -euo pipefail

NOW=$(date '+%Y-%m-%d %H:%M:%S')

# 1. Clean npm cache
npm cache clean --force 2>/dev/null
echo "[$NOW] npm cache cleaned"

# 2. Clean pnpm store (prune unreferenced packages)
pnpm store prune 2>/dev/null
echo "[$NOW] pnpm store pruned"

# 3. Remove temp files older than 7 days
find /tmp -maxdepth 1 -type f -mtime +7 -delete 2>/dev/null || true
echo "[$NOW] /tmp cleaned (files >7d)"

# 4. Remove old core dumps
find /root -name "core.*" -type f -mtime +1 -delete 2>/dev/null || true

# 5. Remove old playwright traces
rm -rf /root/.cache/ms-playwright/ 2>/dev/null || true

# 6. Disk usage check
USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -gt 85 ]; then
    echo "[$NOW] WARNING: Disk usage at ${USAGE}%!"
    # Aggressive cleanup: npx cache
    rm -rf /root/.npm/_npx/ 2>/dev/null || true
    echo "[$NOW] Emergency cleanup: removed npx cache"
else
    echo "[$NOW] Disk usage: ${USAGE}%"
fi
