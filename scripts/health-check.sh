#!/bin/bash
#
# IoTDB Enhanced - Health Check Script
#
# Verifies health of all services after deployment.
# Can be run standalone or as part of deployment.
#
# Usage:
#   ./health-check.sh [options]
#
# Options:
#   --verbose       Show detailed output
#   --timeout N     Timeout in seconds (default: 60)
#   --no-color      Disable colored output
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Health check endpoints
BACKEND_URL="${BACKEND_URL:-http://localhost:3001/api/health}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
API_BASE="${API_BASE:-http://localhost:3001/api}"

# Timeout configuration
TIMEOUT=60
INTERVAL=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse command line arguments
VERBOSE=false
NO_COLOR=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose)
      VERBOSE=true
      shift
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --no-color)
      NO_COLOR=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Disable colors if requested
if [ "$NO_COLOR" = true ]; then
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# ============================================================================
# Status Tracking
# ============================================================================

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0

# ============================================================================
# Utility Functions
# ============================================================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((CHECKS_PASSED++)) || true
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((CHECKS_FAILED++)) || true
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

verbose_log() {
  if [ "$VERBOSE" = true ]; then
    echo "$1"
  fi
}

# Increment total checks
increment_total() {
  ((CHECKS_TOTAL++)) || true
}

# ============================================================================
# Check Functions
# ============================================================================

check_backend_health() {
  increment_total
  local check_name="Backend Health Endpoint"

  log_info "Checking $check_name..."

  local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BACKEND_URL" 2>/dev/null || echo "000")

  if [ "$response" = "200" ]; then
    log_success "$check_name: HTTP $response"

    if [ "$VERBOSE" = true ]; then
      local health_data=$(curl -s "$BACKEND_URL" 2>/dev/null || echo '{}')
      verbose_log "Response: $health_data"
    fi

    return 0
  else
    log_error "$check_name: HTTP $response"
    return 1
  fi
}

check_frontend() {
  increment_total
  local check_name="Frontend Accessibility"

  log_info "Checking $check_name..."

  local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "000")

  if [ "$response" = "200" ]; then
    log_success "$check_name: HTTP $response"
    return 0
  else
    log_error "$check_name: HTTP $response"
    return 1
  fi
}

check_database() {
  increment_total
  local check_name="Database Connection"

  log_info "Checking $check_name..."

  # Check via backend health endpoint (includes DB status)
  local health_data=$(curl -s "$BACKEND_URL" 2>/dev/null || echo '{}')

  if echo "$health_data" | grep -q '"database":"ok"' || echo "$health_data" | grep -q '"database":true'; then
    log_success "$check_name: Connected"
    return 0
  else
    log_error "$check_name: Failed"
    return 1
  fi
}

check_redis() {
  increment_total
  local check_name="Redis Connection"

  log_info "Checking $check_name..."

  local health_data=$(curl -s "$BACKEND_URL" 2>/dev/null || echo '{}')

  if echo "$health_data" | grep -q '"redis":"ok"' || echo "$health_data" | grep -q '"redis":true'; then
    log_success "$check_name: Connected"
    return 0
  else
    log_error "$check_name: Failed"
    return 1
  fi
}

check_iotdb() {
  increment_total
  local check_name="IoTDB Connection"

  log_info "Checking $check_name..."

  local health_data=$(curl -s "$BACKEND_URL" 2>/dev/null || echo '{}')

  if echo "$health_data" | grep -q '"iotdb":"ok"' || echo "$health_data" | grep -q '"iotdb":true'; then
    log_success "$check_name: Connected"
    return 0
  else
    log_error "$check_name: Failed"
    return 1
  fi
}

check_pm2_services() {
  increment_total
  local check_name="PM2 Services Running"

  log_info "Checking $check_name..."

  if ! command -v pm2 &>/dev/null; then
    log_error "$check_name: pm2 not installed"
    return 1
  fi

  local online_services=$(pm2 jlist 2>/dev/null | grep -c '"status":"online"' || echo "0")

  if [ "$online_services" -ge 2 ]; then
    log_success "$check_name: $online_services services online"

    if [ "$VERBOSE" = true ]; then
      pm2 list
    fi

    return 0
  else
    log_error "$check_name: Only $online_services services online"
    return 1
  fi
}

check_disk_space() {
  increment_total
  local check_name="Disk Space"

  log_info "Checking $check_name..."

  local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

  if [ "$disk_usage" -lt 80 ]; then
    log_success "$check_name: ${disk_usage}% used"
    return 0
  elif [ "$disk_usage" -lt 90 ]; then
    log_warn "$check_name: ${disk_usage}% used (warning)"
    return 0
  else
    log_error "$check_name: ${disk_usage}% used (critical)"
    return 1
  fi
}

check_memory() {
  increment_total
  local check_name="Memory Usage"

  log_info "Checking $check_name..."

  local mem_usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2*100}')

  if [ "$mem_usage" -lt 80 ]; then
    log_success "$check_name: ${mem_usage}% used"
    return 0
  elif [ "$mem_usage" -lt 90 ]; then
    log_warn "$check_name: ${mem_usage}% used (warning)"
    return 0
  else
    log_error "$check_name: ${mem_usage}% used (critical)"
    return 1
  fi
}

check_cpu() {
  increment_total
  local check_name="CPU Load"

  log_info "Checking $check_name..."

  local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
  local cpus=$(nproc)
  local load_percentage=$(echo "$load $cpus" | awk '{printf "%.0f", $1/$2*100}')

  if [ "$load_percentage" -lt 80 ]; then
    log_success "$check_name: ${load} (${load_percentage}% of ${cpus} cores)"
    return 0
  elif [ "$load_percentage" -lt 100 ]; then
    log_warn "$check_name: ${load} (${load_percentage}% of ${cpus} cores)"
    return 0
  else
    log_error "$check_name: ${load} (${load_percentage}% of ${cpus} cores)"
    return 1
  fi
}

# ============================================================================
# Main Health Check Routine
# ============================================================================

main() {
  echo "=========================================="
  echo "  IoTDB Enhanced Health Check"
  echo "=========================================="
  echo "Started at: $(date)"
  echo "Timeout: ${TIMEOUT}s"
  echo ""

  local start_time=$(date +%s)
  local elapsed=0

  # Wait for services to be ready with timeout
  while [ $elapsed -lt $TIMEOUT ]; do
    CHECKS_PASSED=0
    CHECKS_FAILED=0
    CHECKS_TOTAL=0

    # Run all checks
    check_backend_health || true
    check_frontend || true
    check_database || true
    check_redis || true
    check_iotdb || true
    check_pm2_services || true

    # System resource checks
    check_disk_space || true
    check_memory || true
    check_cpu || true

    # Check if all core checks passed
    if [ $CHECKS_FAILED -eq 0 ]; then
      break
    fi

    log_info "Retrying in ${INTERVAL}s... (${elapsed}/${TIMEOUT}s elapsed)"
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  echo ""
  echo "=========================================="
  echo "  Health Check Results"
  echo "=========================================="
  echo "Duration: ${duration}s"
  echo "Total Checks: $CHECKS_TOTAL"
  echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
  echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
  echo "Completed at: $(date)"

  if [ $CHECKS_FAILED -eq 0 ]; then
    echo ""
    log_success "All health checks passed!"
    exit 0
  else
    echo ""
    log_error "Some health checks failed!"
    exit 1
  fi
}

main "$@"
