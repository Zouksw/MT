#!/bin/bash
# ============================================================================
# MT - Production Deployment Script
#
# Usage:
#   ./scripts/deploy.sh              # Normal deploy
#   ./scripts/deploy.sh --rollback   # Rollback to previous version
#
# Prerequisites:
#   - pnpm installed globally
#   - pm2 installed globally
#   - git repository initialized
#   - Backend .env configured at backend/.env
#   - Frontend .env.local configured at frontend/.env.local
#
# Features:
#   - Pre-deploy health check of current services
#   - Automatic backup tag before deploying
#   - Rollback on failure
#   - Color-coded output with timestamps
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT="/root"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
LOG_DIR="${PROJECT_ROOT}/logs"
ECOSYSTEM_FILE="${PROJECT_ROOT}/ecosystem.config.cjs"
HEALTH_URL="http://127.0.0.1:8000/health"
HEALTH_TIMEOUT=30
BACKUP_TAG_PREFIX="deploy-backup"

# ---------------------------------------------------------------------------
# Color Codes
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

log_info() {
    echo -e "${GREEN}[INFO]${NC}  $(timestamp)  $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC}  $(timestamp)  $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(timestamp)  $*"
}

log_step() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

log_cmd() {
    echo -e "${CYAN}[CMD]${NC}   $(timestamp)  $*"
}

# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
check_health() {
    local url="${1:-$HEALTH_URL}"
    local timeout="${2:-$HEALTH_TIMEOUT}"
    local elapsed=0

    log_info "Waiting for services to respond at ${url} (timeout: ${timeout}s)..."

    while [ $elapsed -lt $timeout ]; do
        if curl -sf --max-time 3 "$url" > /dev/null 2>&1; then
            log_info "Health check passed after ${elapsed}s"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    log_error "Health check failed after ${timeout}s"
    return 1
}

# ---------------------------------------------------------------------------
# Pre-Deploy
# ---------------------------------------------------------------------------
pre_deploy() {
    log_step "PRE-DEPLOY: Health Check & Backup"

    # Check if we are in a git repository
    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        log_error "Not a git repository at ${PROJECT_ROOT}"
        exit 1
    fi

    # Record current commit for rollback
    CURRENT_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)
    log_info "Current commit: ${CURRENT_COMMIT}"

    # Check current services health (non-fatal)
    if curl -sf --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; then
        log_info "Current services are healthy"
    else
        log_warn "Current services are not responding (may be first deploy)"
    fi

    # Check for uncommitted changes
    if ! git -C "$PROJECT_ROOT" diff --quiet 2>/dev/null; then
        log_warn "There are uncommitted changes. Stashing..."
        git -C "$PROJECT_ROOT" stash push -m "auto-stash before deploy $(timestamp)"
    fi

    # Create backup tag
    BACKUP_TAG="${BACKUP_TAG_PREFIX}-$(date +%Y%m%d-%H%M%S)"
    log_info "Creating backup tag: ${BACKUP_TAG}"
    git -C "$PROJECT_ROOT" tag -f "$BACKUP_TAG" HEAD

    # Keep only the last 5 backup tags
    TAG_COUNT=$(git -C "$PROJECT_ROOT" tag -l "${BACKUP_TAG_PREFIX}-*" | wc -l)
    if [ "$TAG_COUNT" -gt 5 ]; then
        log_info "Cleaning up old backup tags (keeping last 5)..."
        git -C "$PROJECT_ROOT" tag -l "${BACKUP_TAG_PREFIX}-*" | sort | head -n -5 | while read -r old_tag; do
            git -C "$PROJECT_ROOT" tag -d "$old_tag" 2>/dev/null || true
        done
    fi

    log_info "Pre-deploy checks complete"
}

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------
deploy() {
    log_step "DEPLOY: Pull, Install, Build"

    # Pull latest code
    log_info "Pulling latest code..."
    log_cmd "git pull origin main"
    git -C "$PROJECT_ROOT" pull origin main

    # Install backend dependencies
    log_info "Installing backend dependencies..."
    log_cmd "cd ${BACKEND_DIR} && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
    cd "$BACKEND_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    cd "$PROJECT_ROOT"

    # Install frontend dependencies
    log_info "Installing frontend dependencies..."
    log_cmd "cd ${FRONTEND_DIR} && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
    cd "$FRONTEND_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    cd "$PROJECT_ROOT"

    # Build backend
    log_info "Building backend..."
    log_cmd "cd ${BACKEND_DIR} && pnpm run build"
    cd "$BACKEND_DIR"
    pnpm run build
    cd "$PROJECT_ROOT"

    # Build frontend
    log_info "Building frontend..."
    log_cmd "cd ${FRONTEND_DIR} && pnpm run build"
    cd "$FRONTEND_DIR"
    pnpm run build
    cd "$PROJECT_ROOT"

    log_info "Build complete"
}

# ---------------------------------------------------------------------------
# Post-Deploy
# ---------------------------------------------------------------------------
post_deploy() {
    log_step "POST-DEPLOY: Reload Services & Verify"

    # Ensure log directory exists
    mkdir -p "$LOG_DIR"

    # Reload PM2 services
    log_info "Reloading PM2 services..."
    if pm2 list 2>/dev/null | grep -q "online"; then
        log_cmd "pm2 reload ${ECOSYSTEM_FILE} --env production"
        pm2 reload "$ECOSYSTEM_FILE" --env production
    else
        log_info "No running PM2 processes found. Starting fresh..."
        log_cmd "pm2 start ${ECOSYSTEM_FILE} --env production"
        pm2 start "$ECOSYSTEM_FILE" --env production
    fi

    # Save PM2 process list
    pm2 save

    # Wait for health check
    if check_health "$HEALTH_URL" "$HEALTH_TIMEOUT"; then
        log_info "Services are healthy after deploy"
    else
        log_error "Services failed health check after deploy!"
        log_error "Initiating automatic rollback..."
        rollback
        return 1
    fi

    # Show status
    echo ""
    pm2 list

    log_info "Deployment complete!"
    log_info "New commit: $(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
}

# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------
rollback() {
    log_step "ROLLBACK: Reverting to Previous Version"

    # Find the most recent backup tag
    ROLLBACK_TAG=$(git -C "$PROJECT_ROOT" tag -l "${BACKUP_TAG_PREFIX}-*" | sort | tail -1)

    if [ -z "$ROLLBACK_TAG" ]; then
        log_error "No backup tag found. Cannot rollback automatically."
        log_error "Manual rollback required."
        exit 1
    fi

    log_info "Rolling back to tag: ${ROLLBACK_TAG}"
    log_cmd "git reset --hard ${ROLLBACK_TAG}"

    # Stash any changes before reset
    git -C "$PROJECT_ROOT" stash 2>/dev/null || true
    git -C "$PROJECT_ROOT" reset --hard "$ROLLBACK_TAG"

    # Rebuild
    log_info "Rebuilding backend..."
    cd "$BACKEND_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    pnpm run build
    cd "$PROJECT_ROOT"

    log_info "Rebuilding frontend..."
    cd "$FRONTEND_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    pnpm run build
    cd "$PROJECT_ROOT"

    # Reload services
    log_info "Reloading PM2 services with previous version..."
    pm2 reload "$ECOSYSTEM_FILE" --env production 2>/dev/null || pm2 start "$ECOSYSTEM_FILE" --env production
    pm2 save

    # Verify rollback
    sleep 5
    if curl -sf --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; then
        log_info "Rollback successful. Services are healthy."
    else
        log_error "Rollback health check failed. Manual intervention required!"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Explicit Rollback Mode (--rollback flag)
# ---------------------------------------------------------------------------
explicit_rollback() {
    log_step "ROLLBACK: User-Requested Rollback"

    # List available backup tags
    TAGS=$(git -C "$PROJECT_ROOT" tag -l "${BACKUP_TAG_PREFIX}-*" | sort)
    if [ -z "$TAGS" ]; then
        log_error "No backup tags found. Nothing to rollback to."
        exit 1
    fi

    echo -e "${CYAN}Available backup tags:${NC}"
    echo "$TAGS"
    echo ""

    rollback
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    echo -e "${CYAN}"
    echo "============================================"
    echo "  MT - Production Deployment"
    echo "============================================"
    echo -e "${NC}"

    # Parse arguments
    case "${1:-}" in
        --rollback)
            explicit_rollback
            ;;
        --help|-h)
            echo "Usage: $0 [--rollback|--help]"
            echo ""
            echo "  (no args)    Deploy latest code from main branch"
            echo "  --rollback   Rollback to the previous backup tag"
            echo "  --help       Show this help message"
            exit 0
            ;;
        "")
            pre_deploy
            deploy
            post_deploy
            ;;
        *)
            log_error "Unknown argument: $1"
            echo "Usage: $0 [--rollback|--help]"
            exit 1
            ;;
    esac
}

main "$@"
