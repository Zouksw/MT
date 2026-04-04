#!/bin/bash
#
# IoTDB Enhanced - Automated Backup Script
#
# Backs up PostgreSQL database, configurations, and IoTDB data
# Run via cron: 0 2 * * * /path/to/scripts/auto-backup.sh
#
# Usage:
#   ./auto-backup.sh [options]
#
# Options:
#   --dry-run       Show what would be backed up without actually doing it
#   --quiet         Suppress output except errors
#   --no-verify     Skip backup verification
#   --full          Full backup (includes IoTDB data)
#
# Environment variables (optional):
#   BACKUP_DIR          - Backup directory (default: /var/backups/iotdb-enhanced)
#   BACKUP_RETENTION   - Retention in days (default: 7)
#   S3_BUCKET           - S3 bucket for remote backup (optional)
#   TELEGRAM_BOT_TOKEN  - For backup notifications (optional)
#   TELEGRAM_CHAT_ID    - For backup notifications (optional)
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/var/log/iotdb-enhanced"
BACKUP_ROOT="${BACKUP_DIR:-/var/backups/iotdb-enhanced}"
RETENTION_DAYS="${BACKUP_RETENTION:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
TIMESTAMP=$(date +%s)

# Parse command line arguments
DRY_RUN=false
QUIET=false
VERIFY=true
FULL_BACKUP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --quiet)
      QUIET=true
      shift
      ;;
    --no-verify)
      VERIFY=false
      shift
      ;;
    --full)
      FULL_BACKUP=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ============================================================================
# Logging Functions
# ============================================================================

log() {
  if [ "$QUIET" != "true" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  fi
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

log_success() {
  if [ "$QUIET" != "true" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1"
  fi
}

# ============================================================================
# Notification Functions
# ============================================================================

send_notification() {
  local message="$1"
  local priority="${2:-info}"

  # Telegram notification
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}&text=${message}&parse_mode=HTML" >/dev/null 2>&1 || true
  fi
}

notify_backup_success() {
  local backup_type="$1"
  local backup_file="$2"
  local size="$3"

  local message="✅ <b>Backup Successful</b>
<strong>Type:</strong> ${backup_type}
<strong>File:</strong> $(basename "$backup_file")
<strong>Size:</strong> ${size}
<strong>Time:</strong> $(date '+%Y-%m-%d %H:%M:%S')"

  send_notification "$message"
}

notify_backup_error() {
  local backup_type="$1"
  local error_message="$2"

  local message="❌ <b>Backup Failed</b>
<strong>Type:</strong> ${backup_type}
<strong>Error:</strong> ${error_message}
<strong>Time:</strong> $(date '+%Y-%m-%d %H:%M:%S')"

  send_notification "$message" "error"
}

# ============================================================================
# Utility Functions
# ============================================================================

get_file_size() {
  local file="$1"
  if [ -f "$file" ]; then
    du -h "$file" | cut -f1
  else
    echo "0"
  fi
}

verify_backup() {
  local backup_file="$1"
  local backup_type="$2"

  log "Verifying $backup_type backup..."

  # Check if backup file exists and is not empty
  if [ ! -s "$backup_file" ]; then
    log_error "Backup file is empty or doesn't exist: $backup_file"
    return 1
  fi

  # For PostgreSQL backups, verify SQL format
  if [[ "$backup_file" == *.sql.gz ]]; then
    if ! zcat "$backup_file" | head -1 | grep -q "PostgreSQL database dump"; then
      log_error "Invalid PostgreSQL backup format"
      return 1
    fi
  fi

  local size=$(stat -f%s "$backup_file" 2>/dev/null || echo 0)
  if [ "$size" -lt 1000 ]; then
    log_error "Backup file suspiciously small: ${size} bytes"
    return 1
  fi

  log_success "Backup verified: $(get_file_size "$backup_file")"
  return 0
}

# ============================================================================
# PostgreSQL Backup
# ============================================================================

backup_postgresql() {
  log "Starting PostgreSQL backup..."

  # Get database connection from environment or use defaults
  local db_host="${POSTGRES_HOST:-localhost}"
  local db_port="${POSTGRES_PORT:-5432}"
  local db_name="${POSTGRES_DB:-iotdb_enhanced}"
  local db_user="${POSTGRES_USER:-postgres}"

  # Create backup directory
  local backup_dir="$BACKUP_ROOT/postgresql"
  mkdir -p "$backup_dir"

  local backup_file="$backup_dir/db_${DATE}.sql.gz"

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would backup PostgreSQL database to: $backup_file"
    return 0
  fi

  # Perform backup
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" 2>/dev/null | gzip > "$backup_file"; then
    local size=$(get_file_size "$backup_file")
    log_success "PostgreSQL backup completed: $size"

    if [ "$VERIFY" = true ]; then
      if verify_backup "$backup_file" "PostgreSQL"; then
        notify_backup_success "PostgreSQL" "$backup_file" "$size"
      else
        notify_backup_error "PostgreSQL" "Verification failed"
        return 1
      fi
    fi
  else
    log_error "PostgreSQL backup failed"
    notify_backup_error "PostgreSQL" "pg_dump command failed"
    return 1
  fi
}

# ============================================================================
# Configuration Backup
# ============================================================================

backup_configurations() {
  log "Backing up configuration files..."

  local backup_dir="$BACKUP_ROOT/config"
  mkdir -p "$backup_dir"

  local config_backup="$backup_dir/config_${DATE}.tar.gz"

  # List of files/directories to backup
  local backup_items=(
    ".env.production"
    "backend/.env"
    "frontend/.env.local"
    "ecosystem.config.cjs"
    "nginx/nginx.conf"
  )

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would backup configurations to: $config_backup"
    return 0
  fi

  # Create tar archive
  cd "$PROJECT_DIR"
  tar czf "$config_backup" ${backup_items[@]} 2>/dev/null || true

  if [ -f "$config_backup" ]; then
    local size=$(get_file_size "$config_backup")
    log_success "Configuration backup completed: $size"
  else
    log_error "Configuration backup failed"
    notify_backup_error "Configuration" "tar command failed"
    return 1
  fi
}

# ============================================================================
# IoTDB Backup (optional)
# ============================================================================

backup_iotdb() {
  log "Backing up IoTDB data..."

  local backup_dir="$BACKUP_ROOT/iotdb"
  mkdir -p "$backup_dir"

  # Backup IoTDB metadata (if IoTDB is accessible)
  local iotdb_backup="$backup_dir/iotdb_metadata_${DATE}.sql"

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would backup IoTDB metadata to: $iotdb_backup"
    return 0
  fi

  # Use IoTDB CLI to export metadata (if available)
  if command -v iotdb &>/dev/null; then
    iotdb -e "SHOW TIMESERIES" > "$iotdb_backup" 2>/dev/null || {
      log "IoTDB backup skipped (IoTDB not running or not accessible)"
    }

    if [ -f "$iotdb_backup" ] && [ -s "$iotdb_backup" ]; then
      gzip "$iotdb_backup"
      local size=$(get_file_size "${iotdb_backup}.gz")
      log_success "IoTDB metadata backup completed: $size"
    fi
  else
    log "IoTDB CLI not found, skipping..."
  fi
}

# ============================================================================
# S3 Upload (optional)
# ============================================================================

upload_to_s3() {
  local s3_bucket="${S3_BUCKET:-}"
  local s3_prefix="${S3_PREFIX:-iotdb-enhanced/backups}"

  if [ -z "$s3_bucket" ]; then
    log "S3 bucket not configured, skipping remote upload"
    return 0
  fi

  log "Uploading backups to S3..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would upload to S3: s3://$s3_bucket/$s3_prefix/"
    return 0
  fi

  # Upload to S3
  for backup_file in "$BACKUP_ROOT"/postgresql/*.sql.gz "$BACKUP_ROOT"/config/*.tar.gz; do
    if [ -f "$backup_file" ]; then
      aws s3 cp "$backup_file" "s3://$s3_bucket/$s3_prefix/$(basename "$backup_file")" \
        --storage-class STANDARD \
        --metadata "backup-date=$(date +%Y-%m-%d)" \
        >/dev/null 2>&1 || log "Failed to upload $(basename "$backup_file") to S3"
    fi
  done

  log_success "S3 upload completed"
}

# ============================================================================
# Cleanup Old Backups
# ============================================================================

cleanup_old_backups() {
  log "Cleaning up old backups (older than $RETENTION_DAYS days)..."

  local backup_dirs=(
    "$BACKUP_ROOT/postgresql"
    "$BACKUP_ROOT/config"
  )

  for dir in "${backup_dirs[@]}"; do
    if [ -d "$dir" ]; then
      find "$dir" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
      log "Cleaned old backups in: $dir"
    fi
  done

  # Also cleanup old uploads
  if [ -d "$BACKUP_ROOT/uploads" ]; then
    find "$BACKUP_ROOT/uploads" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
  fi
}

# ============================================================================
# Backup Report
# ============================================================================

generate_backup_report() {
  local report_file="$BACKUP_ROOT/backup_report_${DATE}.txt"

  log "Generating backup report..."

  cat > "$report_file" <<EOF
========================================================================
IoTDB Enhanced Backup Report
========================================================================
Backup Date: $(date)
Server: $(hostname)
Retention: ${RETENTION_DAYS} days

Backups Created:
------------------------------------------------------------------------
EOF

  # List all backup files created today
  find "$BACKUP_ROOT" -type f -newermt "-1 day" -exec ls -lh {} \; >> "$report_file"

  echo "" >> "$report_file"
  echo "Disk Usage:" >> "$report_file"
  df -h >> "$report_file"

  echo "" >> "$report_file"
  echo "========================================================================" >> "$report_file"

  log "Backup report saved to: $report_file"
}

# ============================================================================
# Main Backup Routine
# ============================================================================

main() {
  log "=========================================="
  log "  IoTDB Enhanced Backup Started"
  log "=========================================="
  log "Backup Root: $BACKUP_ROOT"
  log "Retention: $RETENTION_DAYS days"
  log "Timestamp: $TIMESTAMP"

  # Create backup directory
  mkdir -p "$BACKUP_ROOT"/{postgresql,config,iotdb,uploads}

  local start_time=$(date +%s)
  local exit_code=0

  # Execute backups
  backup_postgresql || exit_code=$?
  backup_configurations || exit_code=$?

  if [ "$FULL_BACKUP" = true ]; then
    backup_iotdb || true  # Don't fail on IoTDB backup
  fi

  # Cleanup old backups
  cleanup_old_backups

  # Upload to S3 (if configured)
  upload_to_s3

  # Generate backup report
  generate_backup_report

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  log "=========================================="
  log "  Backup Completed"
  log "=========================================="
  log "Duration: ${duration}s"
  log "Exit Code: $exit_code"

  if [ $exit_code -eq 0 ]; then
    log_success "All backups completed successfully!"
  else
    log_error "Some backups failed. Check logs for details."
  fi

  exit $exit_code
}

# ============================================================================
# Script Entry Point
# ============================================================================

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Run main function
main "$@"
