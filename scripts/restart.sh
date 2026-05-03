#!/usr/bin/env bash
set -euo pipefail

# MT — Development Server Restart
# Usage: ./scripts/restart.sh [--backend|--frontend|--iotdb|--all|--quick]
# Default: --all
# --quick: skip IoTDB, shorter waits (backend 10s, frontend 20s)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_PORT=8000
FRONTEND_PORT=3000
DEVTOOLS_PORT=5001

IOTDB_HOME="/opt/iotdb/apache-iotdb-2.0.8-all-bin"
IOTDB_CN_PORT=10710
IOTDB_DN_PORT=6667
IOTDB_REST_PORT=18080
IOTDB_AI_PORT=10810

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[restart]${NC} $1"; }
ok()    { echo -e "${GREEN}[ok]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
err()   { echo -e "${RED}[error]${NC} $1"; }

# ── Parse args ──────────────────────────────────────────
MODE="${1:---all}"
QUICK=false
case "$MODE" in
  --quick) MODE="--all"; QUICK=true ;;
  --backend|--frontend|--iotdb|--all) ;;
  *) err "Unknown option: $MODE"; echo "Usage: $0 [--backend|--frontend|--iotdb|--all|--quick]"; exit 1 ;;
esac

# ── Kill and verify ─────────────────────────────────────
# Kill by command pattern, then wait for ALL related processes to vanish,
# then verify ports are free. Retry up to 3 rounds.

kill_and_wait() {
  local label=$1
  shift
  local patterns=("$@")
  local round=0

  while [ $round -lt 3 ]; do
    local found=0

    # Kill by pattern
    for pat in "${patterns[@]}"; do
      local pids
      pids=$(pgrep -f "$pat" 2>/dev/null || true)
      if [ -n "$pids" ]; then
        log "Killing $label processes matching '$pat'"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        found=1
      fi
    done

    # Also kill anything on our ports
    for port in $BACKEND_PORT $FRONTEND_PORT $DEVTOOLS_PORT $IOTDB_CN_PORT $IOTDB_DN_PORT $IOTDB_REST_PORT $IOTDB_AI_PORT; do
      local port_pids
      port_pids=$(timeout 3 lsof -ti:"$port" 2>/dev/null || true)
      if [ -n "$port_pids" ]; then
        log "Killing process on port $port"
        echo "$port_pids" | xargs kill -9 2>/dev/null || true
        found=1
      fi
    done

    if [ "$found" -eq 0 ]; then
      break
    fi

    round=$((round + 1))
    log "Waiting for processes to exit (round $round)..."
    sleep 2
  done
}

log "Scanning for zombie processes..."

case "$MODE" in
  --backend|--all)
    kill_and_wait "backend" "tsx watch src/server" "server-with-docs"
    ok "Backend processes killed"
    ;;
esac

case "$MODE" in
  --frontend|--all)
    kill_and_wait "frontend" "next-server" "next dev" "refine dev" "postcss\\.js"
    ok "Frontend processes killed"
    ;;
esac

case "$MODE" in
  --iotdb|--all)
    kill_and_wait "iotdb" "iotdb.*ConfigNode" "iotdb.*DataNode" "ainode.*MainProcess"
    ok "IoTDB processes killed"
    ;;
esac

# Final port verification with aggressive cleanup
for port in $BACKEND_PORT $FRONTEND_PORT $DEVTOOLS_PORT; do
  attempt=0
  while timeout 3 lsof -ti:"$port" 2>/dev/null | head -1 | grep -q .; do
    attempt=$((attempt + 1))
    if [ $attempt -gt 5 ]; then
      err "Port $port still occupied after 5 kill attempts"
      timeout 3 lsof -i:"$port" 2>/dev/null
      exit 1
    fi
    timeout 3 lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    sleep 1
  done
done

ok "All ports free ($BACKEND_PORT, $FRONTEND_PORT, $DEVTOOLS_PORT, IoTDB)"

# ── Start servers ───────────────────────────────────────
wait_for_http() {
  local port=$1 label=$2 timeout=${3:-20}
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if curl -s --max-time 2 -o /dev/null -w "" http://localhost:"$port" 2>/dev/null; then
      return 0
    fi
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

# Quick mode: shorter timeouts
BACKEND_WAIT=20
FRONTEND_WAIT=40
if [ "$QUICK" = true ]; then
  BACKEND_WAIT=10
  FRONTEND_WAIT=20
fi

mkdir -p "$ROOT_DIR/.logs"
BACKEND_PID=""
FRONTEND_PID=""

# ── Start IoTDB ──────────────────────────────────────────
case "$MODE" in
  --iotdb|--all)
    if [ "$QUICK" = true ]; then
      warn "Quick mode — skipping IoTDB"
    elif [ -d "$IOTDB_HOME/sbin" ]; then
      log "Starting IoTDB ConfigNode on :$IOTDB_CN_PORT..."
      (cd "$IOTDB_HOME" && MEMORY_SIZE=1G exec sbin/start-confignode.sh) > "$ROOT_DIR/.logs/iotdb-cn.log" 2>&1
      if wait_for_http "$IOTDB_CN_PORT" "ConfigNode" 30; then
        ok "ConfigNode running on port $IOTDB_CN_PORT"
      else
        warn "ConfigNode may still be starting. Check .logs/iotdb-cn.log"
      fi

      log "Starting IoTDB DataNode on :$IOTDB_DN_PORT..."
      (cd "$IOTDB_HOME" && MEMORY_SIZE=1G exec sbin/start-datanode.sh) > "$ROOT_DIR/.logs/iotdb-dn.log" 2>&1
      if wait_for_http "$IOTDB_DN_PORT" "DataNode" 40; then
        ok "DataNode running on port $IOTDB_DN_PORT (REST: $IOTDB_REST_PORT)"
      else
        warn "DataNode may still be starting. Check .logs/iotdb-dn.log"
      fi

      log "Verifying AINode Python environment..."
      if [ -f "$IOTDB_HOME/venv/bin/python3" ]; then
        ok "AINode venv ready at $IOTDB_HOME/venv"
      else
        warn "AINode venv not found at $IOTDB_HOME/venv"
      fi
    else
      warn "IoTDB not found at $IOTDB_HOME, skipping"
    fi
    ;;
esac

case "$MODE" in
  --backend|--all)
    log "Starting backend on :$BACKEND_PORT..."
    (cd "$BACKEND_DIR" && exec pnpm dev) > "$ROOT_DIR/.logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    if wait_for_http "$BACKEND_PORT" "Backend" $BACKEND_WAIT; then
      ok "Backend running on http://localhost:$BACKEND_PORT (PID: $BACKEND_PID)"
    else
      warn "Backend may still be starting. Check .logs/backend.log"
    fi
    ;;
esac

case "$MODE" in
  --frontend|--all)
    log "Starting frontend on :$FRONTEND_PORT..."
    (cd "$FRONTEND_DIR" && exec pnpm dev) > "$ROOT_DIR/.logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    if wait_for_http "$FRONTEND_PORT" "Frontend" $FRONTEND_WAIT; then
      ok "Frontend running on http://localhost:$FRONTEND_PORT (PID: $FRONTEND_PID)"
    else
      warn "Frontend may still be compiling. Check .logs/frontend.log"
    fi
    ;;
esac

# ── Summary ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  MT — Dev Server Status${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

[ -n "$BACKEND_PID" ]  && printf "  %-12s %-30s PID %s\n" "Backend"  "http://localhost:$BACKEND_PORT"  "$BACKEND_PID"
[ -n "$FRONTEND_PID" ] && printf "  %-12s %-30s PID %s\n" "Frontend" "http://localhost:$FRONTEND_PORT" "$FRONTEND_PID"

if [ "$MODE" = "--iotdb" ] || [ "$MODE" = "--all" ]; then
  if [ -d "$IOTDB_HOME/sbin" ]; then
    echo ""
    echo "  IoTDB:"
    echo "    ConfigNode  port $IOTDB_CN_PORT"
    echo "    DataNode    port $IOTDB_DN_PORT (REST: $IOTDB_REST_PORT)"
    echo "    AINode      venv $IOTDB_HOME/venv"
  fi
fi

echo ""
echo "  Logs:"
[ -n "$BACKEND_PID" ]  && echo "    tail -f .logs/backend.log"
[ -n "$FRONTEND_PID" ] && echo "    tail -f .logs/frontend.log"
echo "  Or:    pnpm stop"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
