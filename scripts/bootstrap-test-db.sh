#!/usr/bin/env bash
# Recreate, migrate, and seed the local backend test database (mt_test).
#
# The backend suite (backend/src/test-setup.ts) defaults to mt_test and
# refuses to run against mt_db (production). If mt_test is missing, stale, or
# drifted (schema behind migrations / seed fixtures gone), reset it with:
#
#   scripts/bootstrap-test-db.sh          # idempotent: reuse if healthy
#   scripts/bootstrap-test-db.sh --force  # drop + recreate first
#
# CI performs the same migrate+seed steps in .github/workflows/ci.yml.
set -euo pipefail

DB_NAME="mt_test"
DB_URL="postgresql://mt_user:mt_password@localhost:5432/${DB_NAME}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${1:-}" == "--force" ]]; then
	echo "[bootstrap-test-db] dropping ${DB_NAME}..."
	sudo -u postgres psql -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid<>pg_backend_pid();" >/dev/null
	sudo -u postgres psql -q -c "DROP DATABASE IF EXISTS ${DB_NAME};"
	sudo -u postgres psql -q -c "CREATE DATABASE ${DB_NAME} OWNER mt_user;"
fi

# Ensure the database exists (first run on a new machine).
if ! PGPASSWORD=mt_password psql -h localhost -U mt_user -d "$DB_NAME" -tc "SELECT 1" >/dev/null 2>&1; then
	echo "[bootstrap-test-db] creating ${DB_NAME}..."
	sudo -u postgres psql -q -c "CREATE DATABASE ${DB_NAME} OWNER mt_user;"
fi

echo "[bootstrap-test-db] applying migrations..."
cd "$ROOT/backend"
DATABASE_URL="$DB_URL" npx prisma migrate deploy

echo "[bootstrap-test-db] seeding (no-op if fixtures already present)..."
DATABASE_URL="$DB_URL" npx prisma db seed

echo "[bootstrap-test-db] ${DB_NAME} ready."
