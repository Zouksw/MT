#!/usr/bin/env bash
# MT — Database maintenance (runs weekly Sunday 4AM via cron)
set -euo pipefail

NOW=$(date '+%Y-%m-%d %H:%M:%S')
DB_URL="postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced"

echo "[$NOW] Starting database maintenance..."

# 1. Vacuum analyze all tables
echo "[$NOW] Running VACUUM ANALYZE..."
psql "$DB_URL" -c "VACUUM ANALYZE;" 2>&1
echo "[$NOW] VACUUM ANALYZE complete"

# 2. Clean expired refresh tokens (older than 30 days)
psql "$DB_URL" -c "DELETE FROM refresh_token WHERE expires_at < NOW() - INTERVAL '30 days';" 2>&1
echo "[$NOW] Expired tokens cleaned"

# 3. Clean old password reset tokens
psql "$DB_URL" -c "DELETE FROM password_reset WHERE expires_at < NOW();" 2>&1
echo "[$NOW] Expired password resets cleaned"

# 4. Report database size
SIZE=$(psql "$DB_URL" -t -c "SELECT pg_size_pretty(pg_database_size('iotdb_enhanced'));" 2>&1 | tr -d ' ')
echo "[$NOW] Database size: $SIZE"

# 5. Report table row counts
echo "[$NOW] Table statistics:"
psql "$DB_URL" -c "
SELECT relname AS table, n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 10;
" 2>&1

echo "[$NOW] Maintenance complete"
