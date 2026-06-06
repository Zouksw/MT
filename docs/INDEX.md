# MT — Documentation

**Version**: 2.0.0 | **Last Updated**: 2026-06-06

---

## Quick Navigation

### Getting Started
- [API Reference](API.md) — REST API documentation
- [Deployment Guide](deployment/DEPLOYMENT-CHECKLIST.md) — Production deployment
- [Design System](DESIGN.md) — UI/UX design spec

### Core Documentation
- [Security](SECURITY.md) — Security policies and best practices
- [Roadmap](ROADMAP.md) — Development roadmap
- [CHANGELOG](CHANGELOG.md) — Version history

### Developer Resources
- [Contributing](guides/CONTRIBUTING.md) — Contribution guidelines
- [Secrets Management](guides/SECRETS-MANAGEMENT.md) — Credentials handling
- [CLAUDE.md](../CLAUDE.md) — AI assistant instructions (project root)

### Domain Reference
- [数据源全链路审计报告](数据源全链路审计报告.md) — Data source audit
- [中国进口牛肉贸易数据源](中国进口牛肉贸易全链路数据源梳理报告.md) — Beef trade data sources

---

## Document Index

| Document | Description | Audience |
|----------|-------------|----------|
| [API.md](API.md) | REST API endpoints and schemas | Developers |
| [SECURITY.md](SECURITY.md) | Security configuration | Operators, Developers |
| [DESIGN.md](DESIGN.md) | UI/UX design system | Designers, Developers |
| [ROADMAP.md](ROADMAP.md) | Future development | All |
| [CHANGELOG.md](CHANGELOG.md) | Version history | All |

---

## Common Tasks

**Start Development**:
```bash
pnpm restart          # Start backend (8000) + frontend (3000)
pnpm stop             # Stop all services
```

**Run Tests**:
```bash
cd backend && npx vitest run    # 480 backend tests
cd frontend && npx jest --forceExit  # 305 frontend tests
```

**Health Check**:
```bash
cd backend && npx tsc --noEmit && npx @biomejs/biome lint src/ && npx vitest run
cd frontend && npx tsc --noEmit --project tsconfig.json && npx @biomejs/biome lint src/ && npx jest --forceExit
```

---

**Maintainer**: MT Team
**Last Review**: 2026-06-06
