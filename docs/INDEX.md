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
- [Roadmap](ROADMAP.md) — Development roadmap (含 Round 17-19 完成状态 + 实测指标表)
- [Security](SECURITY.md) — Security policies and best practices
- [CHANGELOG](CHANGELOG.md) — Version history

### Developer Resources
- [Contributing](guides/CONTRIBUTING.md) — Contribution guidelines
- [Secrets Management](guides/SECRETS-MANAGEMENT.md) — Credentials handling
- [CLAUDE.md](../CLAUDE.md) — AI assistant instructions (project root)

### Reviews & Audits (`reviews/`)
- [**2026-07-12 前端提升计划 + 审查**](reviews/2026-07-12-frontend-plan-review.md) — web 研究(Stripe/Linear/Bloomberg)+ 3 agent(IA/数据可视化/品牌);3 CRITICAL(死导航/假WebSocket/数字矛盾);4 阶段计划经 review 审查
- [**2026-07-12 前端提升计划正文**](../FRONTEND-IMPROVEMENT-PLAN.md) — 信任→可用→品质→品牌 4 阶段,17 任务,度量目标
- [**2026-07-12 前端设计审查**](reviews/2026-07-12-frontend-design-review.md) — design-review + 3 Explore agent + Playwright 截图;3 套颜色体系/Button 默认 primary/金色对比度/组件手搓绕过
- [**2026-07-12 Round 27 多技能探查 + 后续开发计划**](reviews/2026-07-12-round-27-exploration.md) — 4 路 Explore agent + review + ops-check;覆盖 36.4%,瓶颈是数据源;R27-32 计划
- [2026-07-12 Round 25-26](reviews/2026-07-12-round-25.md) — Storybook/phosphor/envelope 清理 + inference slug/UUID 修复(双向回归)
- [**2026-07-06 多技能深度审计**](reviews/2026-07-06-multi-skill-audit.md) — 6 技能交叉验证的运行态/架构债/优化项总报告（已 review 二次验证）
- [**2026-07-06 Round 17-19 执行收尾**](reviews/2026-07-06-round-17-19.md) — 前端 build 修复 + 静默吞错修复 + 数据停摆根因 + 索引
- [2026-07-05 核心价值链审计](reviews/2026-07-05-core-value-chain-audit.md) — AI 预测/数据/分析链断裂点定位（上一轮基线）
- [2026-07-05 Round 7-12](reviews/) — AI 恢复 / 重构 / 链路打通的逐轮记录
- [2026-06-14 全量审查集](reviews/2026-06-14-full-review.md) — bugfix / design / devex / performance

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
cd backend && npx vitest run    # ~465 backend tests (464 pass, 1 live-DB data-dependent)
cd frontend && npx jest --forceExit  # 272 frontend tests
```

**Health Check**:
```bash
cd backend && npx tsc --noEmit && npx @biomejs/biome lint src/ && npx vitest run
cd frontend && npx tsc --noEmit -p tsconfig.json && npx next build  # build = the real gate
```

---

**Maintainer**: MT Team
**Last Review**: 2026-07-06
