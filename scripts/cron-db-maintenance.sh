#!/usr/bin/env bash
# MT — Database maintenance (runs weekly Sunday 4AM via cron)
set -uo pipefail

NOW=$(date '+%Y-%m-%d %H:%M:%S')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Read DATABASE_URL from backend .env (consistent with backup-db.sh and restore-db.sh)
if [ -f "$PROJECT_DIR/backend/.env" ]; then
	DATABASE_URL=$(grep "^DATABASE_URL=" "$PROJECT_DIR/backend/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
else
	echo "[$NOW] ERROR: backend/.env not found"
	exit 1
fi

if [ -z "$DATABASE_URL" ]; then
	echo "[$NOW] ERROR: DATABASE_URL is empty"
	exit 1
fi

echo "[$NOW] Starting database maintenance..."

# 1. Vacuum analyze all tables
echo "[$NOW] Running VACUUM ANALYZE..."
if psql "$DATABASE_URL" -c "VACUUM ANALYZE;" 2>&1; then
	echo "[$NOW] VACUUM ANALYZE complete"
else
	echo "[$NOW] WARNING: VACUUM ANALYZE failed (continuing)"
fi

# 2. Clean expired sessions (older than 30 days)
echo "[$NOW] Cleaning expired sessions..."
DELETED=$(psql "$DATABASE_URL" -t -c "DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '30 days';" 2>&1) || { echo "[$NOW] WARNING: Failed to clean expired sessions"; DELETED=""; }
echo "[$NOW] Expired sessions cleaned: $(echo "$DELETED" | tr -d ' ') rows"

# 3. Clean inactive sessions
echo "[$NOW] Cleaning inactive sessions..."
DELETED2=$(psql "$DATABASE_URL" -t -c "DELETE FROM sessions WHERE is_active = false AND last_activity_at < NOW() - INTERVAL '7 days';" 2>&1) || { echo "[$NOW] WARNING: Failed to clean inactive sessions"; DELETED2=""; }
echo "[$NOW] Inactive sessions cleaned: $(echo "$DELETED2" | tr -d ' ') rows"

# 4. Report database size
SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>&1 | tr -d ' ')
echo "[$NOW] Database size: $SIZE"

# 5. Report table row counts
echo "[$NOW] Table statistics:"
psql "$DATABASE_URL" -c "
SELECT relname AS table, n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 10;
" 2>&1

echo "[$NOW] Maintenance complete"
