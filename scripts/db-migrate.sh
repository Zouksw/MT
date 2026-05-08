#!/usr/bin/env bash
# MT — Database migration helper
# Wraps Prisma migrations for local dev and production.
#
# Usage:
#   ./scripts/db-migrate.sh deploy   # Apply pending migrations (production-safe)
#   ./scripts/db-migrate.sh create   # Create a new migration interactively
#   ./scripts/db-migrate.sh status   # Show migration status
#   ./scripts/db-migrate.sh reset    # Reset database and reapply all migrations (DESTRUCTIVE)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")/backend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -d "$BACKEND_DIR" ]; then
	echo -e "${RED}Error: backend directory not found at $BACKEND_DIR${NC}"
	exit 1
fi

cd "$BACKEND_DIR"

COMMAND="${1:-status}"

case "$COMMAND" in
	status)
		echo -e "${YELLOW}Migration status:${NC}"
		npx prisma migrate status
		;;
	deploy)
		echo -e "${YELLOW}Applying pending migrations...${NC}"
		npx prisma migrate deploy
		echo -e "${GREEN}Migrations applied.${NC}"
		;;
	create)
		if [ -z "${2:-}" ]; then
			echo "Usage: $0 create <migration_name>"
			echo "Example: $0 create add_user_preferences"
			exit 1
		fi
		echo -e "${YELLOW}Creating migration: $2${NC}"
		npx prisma migrate dev --name "$2"
		echo -e "${GREEN}Migration created and applied.${NC}"
		;;
	reset)
		echo -e "${RED}WARNING: This will delete all data and reapply migrations.${NC}"
		read -p "Type 'yes' to confirm: " -r
		if [ "$REPLY" != "yes" ]; then
			echo "Aborted."
			exit 0
		fi
		npx prisma migrate reset --force
		echo -e "${GREEN}Database reset complete.${NC}"
		;;
	*)
		echo "Usage: $0 {status|deploy|create|reset}"
		echo ""
		echo "Commands:"
		echo "  status   Show migration status (default)"
		echo "  deploy   Apply pending migrations (production-safe)"
		echo "  create   Create a new migration (needs name arg)"
		echo "  reset    Reset database and reapply all (destructive)"
		exit 1
		;;
esac
