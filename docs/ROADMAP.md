# MT Platform — Roadmap

**Last Updated**: 2026-06-06 | **Status**: Active

---

## Current State (2026-06-06)

- **Health Score**: 9.0/10
- **Tests**: 785 passing (30 backend + 24 frontend suites)
- **Data Coverage**: 31/108 commodities (28.7%)
- **AI Models**: 8 operational (5 statistical + 3 deep learning)
- **Code Quality**: -4,271 lines removed across 4 sessions

---

## Priority 1: Data Coverage Sprint (Existential)

**Goal**: Move from 29% → 60%+ commodity coverage

| Task | Impact | Effort | Status |
|------|--------|--------|--------|
| Fix CME/Stooq one-line bug → unlock 14 futures | Critical | 1 line | ✅ Done |
| Fill FRED_API_KEY (free) → macro factors | High | Config | Pending |
| Fill OPENWEATHER_API_KEY (free) → weather data | High | Config | Pending |
| Fill USDA_MARS_API_KEY → beef/livestock data | High | Config | Pending |
| Fix World Bank source (API 404 → HTML scrape) | High | Medium | Pending |
| Add data freshness monitoring | Medium | Small | Pending |

## Priority 2: Product Repositioning

**Goal**: Align all features with "information platform, not trading platform"

| Task | Description | Status |
|------|-------------|--------|
| Trading Sim → Backtest Tool | Replace BUY/SELL mock with prediction-vs-actual charting | Pending |
| Portfolio → Analysis Groups | Commodity watchlists with correlated overlay | Pending |
| Billing → AI Feature Tiers | Free tier limits signals/models, pro unlocks all | Pending |
| Clean up alert system | Wire dead exports or remove unused functions | Pending |

## Priority 3: Technical Hardening

**Goal**: Deployment readiness

| Task | Description | Status |
|------|-------------|--------|
| Update Next.js (cache poisoning vuln) | 27 dependency vulns total, 11 high | Pending |
| Update qs (prototype pollution) | Critical severity in Express chain | Pending |
| Eliminate remaining `as unknown as` casts | ~25 instances across codebase | In Progress |
| Add ingestion integration tests | Verify each source produces correct records | Pending |

---

## Completed (2026-05 to 2026-06)

| What | Details |
|------|---------|
| AI slop cleanup | Removed auditLogger, over-commenting, deprecated functions |
| Design system compliance | 82 violations fixed (gold palette, typography, spacing) |
| Dead code removal | Deleted 11 dead files (~2,800 lines), inlined 2 types |
| Helper migration | dceFutures, usdaAms → shared helpers |
| Type safety | 6 Prisma casts → json() helper, removed unused Prisma imports |
| Error logging | Fixed 9 empty catch blocks across auth, routes, data sources |
| Documentation | Rewrote DESIGN.md, updated CLAUDE.md, fixed memory files |

---

## NOT Planned

These were in the old roadmap but are **not priorities** for a commodity analytics platform:

- ~~GraphQL support~~ — REST is sufficient
- ~~Kubernetes deployment~~ — systemd is appropriate for current scale
- ~~ClickHouse data warehouse~~ — PostgreSQL handles current data volume
- ~~IoTDB integration~~ — platform has pivoted away from IoTDB
- ~~Multi-region deployment~~ — single-region is appropriate
- ~~SDK generation~~ — premature for current user base

---

## Links

- **GitHub**: https://github.com/Zouksw/MT
- **CHANGELOG**: [CHANGELOG.md](CHANGELOG.md)
- **Design System**: [DESIGN.md](DESIGN.md)
