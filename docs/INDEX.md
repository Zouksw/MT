# MT — Documentation

**Version**: 2.2.0 | **Last Updated**: 2026-07-12

---

## 产品定位 (单一事实来源)

> **为中国牛肉产业链上下游提供进口/国产牛肉价格数据采集、行情展示、多维分析,并以 AI 模型预测未来价格走势的专业平台。**

- **对标**: 类[牧集网](https://web.mooket.com/)的牛肉贸易数据/展示/分析 + 类 IoTDB AINode 的预训练模型预测
- **差异化**: 牧集无 AI 预测;AINode 无行业数据。本项目 = 牧集的数据深度 × AINode 的预测智能
- **最终形态 spec**: [PRODUCT-SPEC.md](PRODUCT-SPEC.md)
- **前端提升计划**: [FRONTEND-IMPROVEMENT-PLAN.md](FRONTEND-IMPROVEMENT-PLAN.md)

---

## Quick Navigation

### Getting Started
- [API Reference](API.md) — REST API documentation
- [Deployment Guide](deployment/DEPLOYMENT-CHECKLIST.md) — Production deployment
- [Design System](DESIGN.md) — UI/UX design spec

### Core Documentation
- [Product Spec](PRODUCT-SPEC.md) — **Single source of truth** for product direction
- [Roadmap](ROADMAP.md) — ⚠️ **DEPRECATED 2026-07-19** (pre-repositioning, numbers stale). See PRODUCT-SPEC instead.
- [Security](SECURITY.md) — Security policies and best practices
- [CHANGELOG](CHANGELOG.md) — Version history

### Developer Resources
- [Contributing](guides/CONTRIBUTING.md) — Contribution guidelines
- [Secrets Management](guides/SECRETS-MANAGEMENT.md) — Credentials handling
- [CLAUDE.md](../CLAUDE.md) — AI assistant instructions (project root)

### Reviews & Audits (`reviews/`)

> Pre-2026-07-12 reviews (rounds 1–24, sarimax experiment, overengineering audit, etc.) archived under `docs/archive/`.

**Current milestone work (M1 → M3):**
- [**M3-A 资讯模块**](reviews/2026-07-13-m3a-market-news.md) — market news feed full stack (model + service + route + 3 frontend pages)
- [**M2 AI 预测融入主流程**](reviews/2026-07-12-m2-ai-in-market.md) — lib/format + 颜色语义 + dashboard KPI hero + MarketForecastBoard
- [**M1 应用 Shell + 信任修复**](reviews/2026-07-12-m1-shell-and-trust.md) — AppShell + WebSocket 假声明删除 + beef-only 统一

**Recent rounds (25–29):**
- [Round 29](reviews/2026-07-12-round-29.md) — watchlistService extraction (312→100 lines)
- [Round 28](reviews/2026-07-12-round-28.md) — data quality (upsertFactor, scraperManager error reporting)
- [Round 27 exploration](reviews/2026-07-12-round-27-exploration.md) — multi-skill探查 + R27-32 计划
- [Round 26](reviews/2026-07-12-round-26.md) — inference slug/UUID fix (双向回归)
- [Round 25](reviews/2026-07-12-round-25.md) — Storybook/phosphor/envelope 清理

**Frontend design:**
- [设计审查](reviews/2026-07-12-frontend-design-review.md) — CRITICAL/HIGH/AI-slop 分级
- [设计修复](reviews/2026-07-12-frontend-design-fixes.md) — gold 统一 + Button cva + emoji→lucide
- [提升计划 review](reviews/2026-07-12-frontend-plan-review.md) — 4 阶段计划审查
- [深度行动项](reviews/2026-07-12-deep-dive-actionable-items.md) — actionable 整理

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
| [ROADMAP.md](ROADMAP.md) | Development roadmap + 实测指标 | All |
| [CHANGELOG.md](CHANGELOG.md) | Version history | All |
| [reviews/](reviews/) | 轮次审查与深度审计档案 | Maintainers |

---

## Common Tasks

**Start Development**:
```bash
pnpm restart          # Start backend (8000) + frontend (3000)
pnpm stop             # Stop all services
```

**Run Tests**:
```bash
cd backend && npx vitest run    # ~431 backend tests
cd frontend && npx jest         # 307 frontend tests
```

**Health Check**:
```bash
cd backend && npx tsc --noEmit && npx @biomejs/biome lint src/ && npx vitest run
cd frontend && npx tsc --noEmit -p tsconfig.json && npx next build  # build = the real gate
```

---

**Maintainer**: MT Team
**Last Review**: 2026-07-13
