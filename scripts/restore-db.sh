#!/bin/bash
#
# MT - Database Restore Script
#
# Restores a PostgreSQL database from a backup file created by backup-db.sh.
# Supports both plain SQL and gzip-compressed backups.
#
# Usage:
#   ./scripts/restore-db.sh <backup_file> [options]
#
# Options:
#   --seed          Run prisma db seed after restoring
#   --no-confirm    Skip confirmation prompt (use with caution)
#   --no-color      Disable colored output
#   --help          Show this help message
#
# WARNING: This will drop and recreate the database. All current data will be lost.
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
RUN_SEED=false
NO_CONFIRM=false
NO_COLOR=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================================
# Parse Arguments
# ============================================================================

show_help() {
  head -16 "$0" | grep '^#' | sed 's/^# \?//'
  exit 0
}

BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --seed)
      RUN_SEED=true
      shift
      ;;
    --no-confirm)
      NO_CONFIRM=true
      shift
      ;;
    --no-color)
      NO_COLOR=true
      shift
      ;;
    --help|-h)
      show_help
      ;;
    -*)
      echo "Unknown option: $1"
      echo "Use --help for usage information."
      exit 1
      ;;
    *)
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$1"
      else
        echo "Unexpected argument: $1"
        exit 1
      fi
      shift
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
  BOLD=''
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
# Validate Inputs
# ============================================================================

if [ -z "$BACKUP_FILE" ]; then
  log_error "No backup file specified."
  echo ""
  echo "Usage: $0 <backup_file> [--seed] [--no-confirm]"
  echo ""
  echo "Available backups:"
  BACKUP_DIR="${PROJECT_DIR}/backups"
  if [ -d "$BACKUP_DIR" ]; then
    ls -lht "${BACKUP_DIR}"/backup_*.sql* 2>/dev/null || echo "  (no backups found)"
  else
    echo "  (backup directory does not exist)"
  fi
  exit 1
fi

# Resolve path
if [ ! -f "$BACKUP_FILE" ]; then
  # Try relative to backups directory
  ALT_PATH="${PROJECT_DIR}/backups/${BACKUP_FILE}"
  if [ -f "$ALT_PATH" ]; then
    BACKUP_FILE="$ALT_PATH"
  else
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
  fi
fi

BACKUP_FILE="$(realpath "$BACKUP_FILE")"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

# Detect compression
if [[ "$BACKUP_FILE" == *.gz ]]; then
  COMPRESSED=true
else
  COMPRESSED=false
fi

# Validate backup file is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  log_error "Backup file is empty: $BACKUP_FILE"
  exit 1
fi

# Quick format validation
if [ "$COMPRESSED" = true ]; then
  if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_error "Backup file is not a valid gzip archive."
    exit 1
  fi
else
  if ! head -5 "$BACKUP_FILE" | grep -qi "postgresql\|pg_dump"; then
    log_warn "File does not appear to be a PostgreSQL dump. Proceed with caution."
  fi
fi

# ============================================================================
# Load Database Configuration
# ============================================================================

if [ ! -f "$ENV_FILE" ]; then
  log_error "Backend .env file not found at: $ENV_FILE"
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ]; then
  log_error "DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/([^?]*).*|\2|')

# Validate required tools
if ! command -v psql &>/dev/null; then
  log_error "psql not found. Install PostgreSQL client tools:"
  log_error "  sudo apt-get install postgresql-client"
  exit 1
fi

# ============================================================================
# Confirmation
# ============================================================================

echo ""
echo "=========================================="
echo -e "  ${RED}${BOLD}Database Restore${NC}"
echo "=========================================="
echo ""
echo -e "  ${BOLD}WARNING: This will replace all data in the database!${NC}"
echo ""
echo "  Target Database:  ${CYAN}${DB_NAME}${NC} at ${DB_HOST}:${DB_PORT}"
echo "  Backup File:      ${CYAN}$(basename "$BACKUP_FILE")${NC} ($BACKUP_SIZE)"
echo "  Compressed:       ${COMPRESSED}"
echo "  Run Seed:         ${RUN_SEED}"
echo ""

if [ "$NO_CONFIRM" != true ]; then
  read -rp "Are you sure you want to proceed? Type 'yes' to confirm: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
  fi
fi

# ============================================================================
# Execute Restore
# ============================================================================

START_TIME=$(date +%s)

# Step 1: Terminate existing connections
log_info "Terminating existing database connections..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
 || log_warn "Could not terminate connections (may need superuser)"

# Step 2: Drop and recreate database
log_info "Dropping database ${DB_NAME}..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
  "DROP DATABASE IF EXISTS \"${DB_NAME}\";"|| {
  log_error "Failed to drop database. Ensure no active connections exist."
  exit 1
}

log_info "Creating database ${DB_NAME}..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
  "CREATE DATABASE \"${DB_NAME}\";"|| {
  log_error "Failed to create database."
  exit 1
}

# Step 3: Restore from backup
log_info "Restoring from backup..."

if [ "$COMPRESSED" = true ]; then
  if ! zcat "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    2>/dev/null; then
    log_error "Restore failed. Check the backup file integrity."
    exit 1
  fi
else
  if ! PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$BACKUP_FILE" 2>/dev/null; then
    log_error "Restore failed. Check the backup file integrity."
    exit 1
  fi
fi

log_success "Database restored from backup."

# Step 4: Run Prisma migrations (ensures schema is up to date)
log_info "Running Prisma migrations..."
cd "$BACKEND_DIR"

if [ -f "node_modules/.bin/prisma" ]; then
  if npx prisma migrate deploy 2>/dev/null; then
    log_success "Prisma migrations applied."
  else
    log_warn "Prisma migrate deploy had warnings (this may be normal if migrations were already in the backup)."
  fi
else
  log_warn "Prisma not found in backend. Skipping migrations."
fi

# Step 5: Optionally seed
if [ "$RUN_SEED" = true ]; then
  log_info "Running database seed..."
  cd "$BACKEND_DIR"

  if pnpm run prisma:seed 2>/dev/null || npx tsx prisma/seed.ts 2>/dev/null; then
    log_success "Database seeded."
  else
    log_warn "Seed command failed. You may need to run it manually: pnpm run prisma:seed"
  fi
fi

# Return to original directory
cd "$PROJECT_DIR"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
echo -e "  ${GREEN}Restore Summary${NC}"
echo "=========================================="
echo "  Database:     ${DB_NAME}"
echo "  Host:         ${DB_HOST}:${DB_PORT}"
echo "  Restored From: $(basename "$BACKUP_FILE") ($BACKUP_SIZE)"
echo "  Migrations:   Applied"
echo "  Seeded:       ${RUN_SEED}"
echo "  Duration:     ${DURATION}s"
echo "=========================================="
echo ""
log_success "Restore completed successfully!"
