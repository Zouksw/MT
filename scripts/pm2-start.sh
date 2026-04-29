#!/usr/bin/env bash
set -euo pipefail
# MT — Start services via PM2 in production mode

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Stop any running dev processes
echo "[pm2-start] Stopping existing processes..."
cd "$ROOT_DIR" && pnpm stop 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sleep 2

# Start PM2
echo "[pm2-start] Starting production services..."
pm2 start "$ROOT_DIR/ecosystem.config.cjs" --env production

# Save process list for auto-restart
pm2 save

echo ""
pm2 status
echo ""
echo "[pm2-start] Done. Use 'pm2 logs' to view logs, 'pm2 monit' for monitoring."
