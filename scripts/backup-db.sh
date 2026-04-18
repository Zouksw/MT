#!/bin/bash
#
# TradeMind AI - Database Backup Script
#
# Creates a timestamped PostgreSQL backup using pg_dump.
# Supports optional gzip compression and automatic rotation.
#
# Usage:
#   ./scripts/backup-db.sh [options]
#
# Options:
#   --compress       Compress backup with gzip
#   --output DIR     Override backup output directory
#   --keep N         Keep last N backups (default: 7)
#   --no-color       Disable colored output
#   --help           Show this help message
#
# Environment:
#   DATABASE_URL is read from /root/backend/.env
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="${PROJECT_DIR}/backend"
ENV_FILE="${BACKEND_DIR}/.env"

# Default settings
COMPRESS=false
KEEP_COUNT=7
OUTPUT_DIR="${PROJECT_DIR}/backups"
NO_COLOR=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# Parse Arguments
# ============================================================================

show_help() {
  head -15 "$0" | grep '^#' | sed 's/^# \?//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --compress)
      COMPRESS=true
      shift
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --keep)
      KEEP_COUNT="$2"
      shift 2
      ;;
    --no-color)
      NO_COLOR=true
      shift
      ;;
    --help|-h)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information."
      exit 1
      ;;
  esac
done

# Disable colors if requested or if not a terminal
if [ "$NO_COLOR" = true ] || [ ! -t 1 ]; then
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  CYAN=''
  NC=''
fi

# ============================================================================
# Utility Functions
# ============================================================================

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $1"; }

# ============================================================================
# Load Database Configuration
# ============================================================================

if [ ! -f "$ENV_FILE" ]; then
  log_error "Backend .env file not found at: $ENV_FILE"
  log_error "Ensure the backend is configured before running backups."
  exit 1
fi

# Parse DATABASE_URL from .env
# Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ]; then
  log_error "DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

# Extract components from DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/([^?]*).*|\2|')

log_info "Database: ${DB_NAME} at ${DB_HOST}:${DB_PORT}"

# ============================================================================
# Validate Prerequisites
# ============================================================================

if ! command -v pg_dump &>/dev/null; then
  log_error "pg_dump not found. Install PostgreSQL client tools:"
  log_error "  sudo apt-get install postgresql-client"
  exit 1
fi

# ============================================================================
# Create Backup
# ============================================================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$OUTPUT_DIR"

if [ "$COMPRESS" = true ]; then
  BACKUP_FILE="${OUTPUT_DIR}/backup_${TIMESTAMP}.sql.gz"
else
  BACKUP_FILE="${OUTPUT_DIR}/backup_${TIMESTAMP}.sql"
fi

log_info "Starting backup..."
log_info "Output: $BACKUP_FILE"

START_TIME=$(date +%s)

# Run pg_dump
if [ "$COMPRESS" = true ]; then
  if PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    --format=plain \
    2>/dev/null | gzip > "$BACKUP_FILE"; then
    :
  else
    log_error "pg_dump failed. Check database connection and credentials."
    rm -f "$BACKUP_FILE"
    exit 1
  fi
else
  if ! PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    --format=plain \
    -f "$BACKUP_FILE" 2>/dev/null; then
    log_error "pg_dump failed. Check database connection and credentials."
    rm -f "$BACKUP_FILE"
    exit 1
  fi
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Verify backup
if [ ! -s "$BACKUP_FILE" ]; then
  log_error "Backup file is empty. Something went wrong."
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

log_success "Backup completed in ${DURATION}s"
log_success "File: $BACKUP_FILE ($BACKUP_SIZE)"

# ============================================================================
# Rotate Old Backups
# ============================================================================

if [ "$COMPRESS" = true ]; then
  PATTERN="backup_*.sql.gz"
else
  PATTERN="backup_*.sql"
fi

EXISTING_BACKUPS=$(ls -1t "${OUTPUT_DIR}"/${PATTERN} 2>/dev/null || true)
BACKUP_COUNT=$(echo "$EXISTING_BACKUPS" | grep -c . || true)

if [ "$BACKUP_COUNT" -gt "$KEEP_COUNT" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - KEEP_COUNT))
  log_info "Rotating old backups (keeping last $KEEP_COUNT, removing $DELETE_COUNT)..."

  echo "$EXISTING_BACKUPS" | tail -n "$DELETE_COUNT" | while read -r old_file; do
    if [ -n "$old_file" ] && [ -f "$old_file" ]; then
      rm -f "$old_file"
      log_info "  Removed: $(basename "$old_file")"
    fi
  done
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
echo -e "  ${GREEN}Backup Summary${NC}"
echo "=========================================="
echo "  Database:     ${DB_NAME}"
echo "  Host:         ${DB_HOST}:${DB_PORT}"
echo "  File:         $(basename "$BACKUP_FILE")"
echo "  Size:         ${BACKUP_SIZE}"
echo "  Compressed:   ${COMPRESS}"
echo "  Duration:     ${DURATION}s"
echo "  Kept:         $(ls -1 "${OUTPUT_DIR}"/${PATTERN} 2>/dev/null | wc -l) backups"
echo "=========================================="
echo ""
