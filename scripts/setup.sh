#!/usr/bin/env bash
# MT — First-run environment setup
# Checks and installs all dependencies, configures the project for development.
#
# Usage:
#   ./scripts/setup.sh           # Full setup
#   ./scripts/setup.sh --check   # Only verify, don't install
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
	CHECK_ONLY=true
fi

ok() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
step() { echo ""; echo -e "${YELLOW}==>${NC} $1"; }

ERRORS=0

# --- Node.js ---
step "Checking Node.js"
if command -v node &>/dev/null; then
	VERSION=$(node -v)
	if [[ "$VERSION" == v18.* ]] || [[ "$VERSION" == v20.* ]] || [[ "$VERSION" == v22.* ]]; then
		ok "Node.js $VERSION"
	else
		fail "Node.js $VERSION (need v18+)"
		((ERRORS++))
	fi
else
	fail "Node.js not found"
	((ERRORS++))
fi

# --- pnpm ---
step "Checking pnpm"
if command -v pnpm &>/dev/null; then
	ok "pnpm $(pnpm -v)"
else
	fail "pnpm not found"
	((ERRORS++))
fi

# --- PostgreSQL ---
step "Checking PostgreSQL"
if command -v psql &>/dev/null; then
	PG_VERSION=$(psql --version | head -1)
	ok "$PG_VERSION"
else
	fail "psql not found (need PostgreSQL 14+)"
	((ERRORS++))
fi

# --- Redis ---
step "Checking Redis"
if command -v redis-cli &>/dev/null; then
	if redis-cli ping &>/dev/null; then
		ok "Redis $(redis-cli --version | grep -oP 'v[\d.]+')"
	else
		warn "Redis installed but not running (start with: redis-server)"
	fi
else
	warn "Redis not found (optional for dev, required for production)"
fi

# --- Python (inference service) ---
step "Checking Python"
if command -v python3 &>/dev/null; then
	PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
	if python3 -c "import sys; exit(0 if sys.version_info >= (3, 10) else 1)"; then
		ok "Python $PY_VERSION"
	else
		fail "Python $PY_VERSION (need 3.10+)"
		((ERRORS++))
	fi
else
	fail "Python3 not found (need 3.10+ for inference service)"
	((ERRORS++))
fi

# --- Inference service ---
step "Checking inference service"
INFERENCE_VENV="/root/inference-service/venv"
if [ -f "$INFERENCE_VENV/bin/uvicorn" ]; then
	ok "Inference service venv ready at $INFERENCE_VENV"
else
	warn "Inference service venv not found at $INFERENCE_VENV"
	if [ "$CHECK_ONLY" = false ] && [ -d "/root/inference-service" ]; then
		python3 -m venv "$INFERENCE_VENV"
		"$INFERENCE_VENV/bin/pip" install -r /root/inference-service/requirements.txt
		ok "Inference service venv created and dependencies installed"
	fi
fi

# --- Environment files ---
step "Checking environment configuration"
if [ -f "$PROJECT_DIR/backend/.env" ]; then
	ok "backend/.env exists"
else
	fail "backend/.env missing"
	if [ -f "$PROJECT_DIR/backend/.env.example" ]; then
		if [ "$CHECK_ONLY" = false ]; then
			cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
			ok "Created backend/.env from .env.example"
		else
			warn "Run without --check to copy .env.example → .env"
		fi
	else
		warn "No .env.example found — create backend/.env manually"
	fi
	((ERRORS++))
fi

# --- Dependencies ---
step "Installing dependencies"
if [ "$CHECK_ONLY" = false ]; then
	cd "$PROJECT_DIR"
	pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	ok "Root dependencies"
	cd "$PROJECT_DIR/backend"
	pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	ok "Backend dependencies"
	cd "$PROJECT_DIR/frontend"
	pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	ok "Frontend dependencies"
else
	[ -d "$PROJECT_DIR/node_modules" ] && ok "Root node_modules" || warn "Root node_modules missing"
	[ -d "$PROJECT_DIR/backend/node_modules" ] && ok "Backend node_modules" || warn "Backend node_modules missing"
	[ -d "$PROJECT_DIR/frontend/node_modules" ] && ok "Frontend node_modules" || warn "Frontend node_modules missing"
fi

# --- Prisma ---
step "Setting up Prisma"
cd "$PROJECT_DIR/backend"
if [ -d "node_modules/.prisma" ]; then
	ok "Prisma client generated"
else
	if [ "$CHECK_ONLY" = false ]; then
		npx prisma generate
		ok "Prisma client generated"
	else
		warn "Prisma client not generated (run: cd backend && npx prisma generate)"
	fi
fi

if [ "$CHECK_ONLY" = false ]; then
	echo ""
	read -p "Run database migrations? [y/N] " -n 1 -r
	echo ""
	if [[ $REPLY =~ ^[Yy]$ ]]; then
		npx prisma migrate deploy
		ok "Migrations applied"
	fi

	echo ""
	read -p "Seed the database with sample data? [y/N] " -n 1 -r
	echo ""
	if [[ $REPLY =~ ^[Yy]$ ]]; then
		npx prisma db seed
		ok "Database seeded"
	fi
fi

# --- Summary ---
echo ""
echo "=========================================="
if [ "$ERRORS" -gt 0 ]; then
	echo -e "${RED}Setup incomplete: $ERRORS issue(s) found${NC}"
	echo "Fix the issues above, then re-run: ./scripts/setup.sh"
	exit 1
else
	echo -e "${GREEN}Setup complete!${NC}"
	echo ""
	echo "Start dev servers:"
	echo "  pnpm restart"
	echo ""
	echo "Create admin user:"
	echo "  ./scripts/user-management.sh create-admin admin@example.com"
fi
