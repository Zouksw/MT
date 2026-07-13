# Round M3-A — 资讯模块 (Market News Feed)

**Date:** 2026-07-13
**Milestone:** M3-A (资讯模块) from `docs/PRODUCT-SPEC.md` §5.4
**Status:** ✅ Complete — backend 13/13, frontend 307/307, builds exit 0, live verified

## Goal

Add the 牧集网-style market dynamics feed (资讯) — the "完整资讯+分析平台" pillar
of PRODUCT-SPEC. Manual-entry content source (per user decision); RSS/news-API
ingestion deferred. This makes the platform a data + analysis + **news** + AI
prediction surface, matching the mooket.com reference.

## What changed

### Backend — model + service + route

**Prisma model `MarketNews`** (`schema.prisma`): uuid id, nullable updatedAt,
camelCase fields with `@map` snake_case, `@@map("market_news")`. Indexes for the
feed (`[status, publishedAt(desc)]`, `[category, publishedAt(desc)]`), commodity
lookup, and author. `NewsCategory` enum (PRICE_MOVE / SUPPLY / TRADE_POLICY /
MARKET_INSIGHT / COMPANY). FK to User (author) with onDelete Cascade + back-relation.

- Applied via `prisma db push` (the shadow DB has a pre-existing migration-history
  conflict from `20260712040000_drop_unused_schema`, so `migrate dev` couldn't run
  cleanly — `db push` syncs the live schema without a shadow DB).
- Seeded 5 beef-trade articles (Reuters/MLA/USDA/Bloomberg/GlobalMeatNews) via an
  idempotent inline script; the full `prisma/seed.ts` had a pre-existing crash at
  the cleanup step (references dropped models `saved_queries`/`organization_members`),
  so the news seed was added to seed.ts for documentation but not run via the full
  seed.

**`services/marketNewsService.ts`** — pure functions, `import { prisma } from "@/lib"`:
`listNews` (filters + pagination + total), `getNewsById`, `incrementView`,
`getNewsStats`, `createNews` (slug from title, dup-guard), `updateNews` /
`deleteNews` (author-or-ADMIN ownership via `getManagedNews` — not-owned =
NotFoundError to avoid existence leak).

**`routes/marketNews.ts`** — thin route layer (watchlist pattern): authenticate
per-route, asyncHandler, Zod `.parse`, `success()`/paginated JSON. Permission
model: READ for any authenticated user; WRITE (create/update/delete) for
EDITOR/ADMIN only (VIEWER → 403). **Fixed the pageSize/limit mismatch** the
datasets route has — frontend `useList` sends `pageSize`, so the route reads
`pageSize || limit` explicitly instead of silently defaulting to 20.

Mounted at `app.use("/api/news", marketNewsRouter)` in `app.ts`.

### Frontend — 3 pages + nav

- **`/market-news`** (list): PageHeader + 4 StatCards (Total/Published/Drafts/
  This Week, info/primary variants only) + category filter + search + Table
  (title/category Tag/source/published/views/actions) + server-side pagination +
  Modal delete confirm.
- **`/market-news/show/[id]`** (detail): uses `useOne`, renders article body,
  related-cut link, tags, source link, view count, delete Modal.
- **`/market-news/create`** (form): title/summary/body/category/source/sourceUrl/
  commoditySlug(Select from beef commodities)/tags/status. Manual `validate()`,
  body sanitized via `sanitizer.sanitizeString`, `createRecord("news", payload)`.
- **AppShell nav**: added 「资讯」section (`{ 市场动态 → /market-news, Newspaper icon }`)
  between 行情 and 分析 — matching the PRODUCT-SPEC 6-section IA.

### Tests
- Backend: `routes/__tests__/marketNews.test.ts` — 13 tests (list/filter/pagination,
  stats, create + dup-guard, detail + 404, update, delete + bidirectional
  gone-check, permission). All bidirectional.
- Frontend: `app/market-news/__tests__/page.test.tsx` — 3 tests (header+stats,
  article rows render, New Article button).

## Verification

- `prisma validate` ✅; `db push` synced; client regenerated; `marketNews` accessible
- Backend: `tsc` clean, `vitest` **13/13 passed**
- Frontend: `tsc` clean, `next build` exit 0 (3 new routes registered:
  `/market-news`, `/market-news/create`, `/market-news/show/[id]`), `jest` **307/307**
- Live: `GET /api/news?pageSize=3` returns 5 seeded articles newest-first;
  `GET /api/news/stats` → `{total:5, published:5, drafts:0, thisWeek:4}`

## Next

**M3-B — 品牌打磨** (deferred from this round, per scope decision):
- Remove about-page fabricated Leadership Team (3 picsum photos + invented bios)
- Unify the 6/7/8 AI-model count across Hero/Features/FAQ/GettingStarted/auth/pricing
- Extract a shared `BrandMark`/`Logo` component (glyph is `T` vs `MT` vs `<Zap>`)
- Remove "108 commodities" fake claim (auth index + GettingStarted + test)
- Strip fabricated trade-flow volumes from Features TradeVisual
