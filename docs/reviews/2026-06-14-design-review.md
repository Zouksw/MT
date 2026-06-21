# MT 项目设计系统审查报告 (Round 5 — Design Review)

> **日期**: 2026-06-14
> **方法论**: design-review skill(逐页视觉合规 + 设计文档单一真源)
> **状态**: 两份冲突 DESIGN.md 已合并,色彩/阴影 token 已对齐

---

## 执行摘要

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| DESIGN.md 数量 | 2 份(互相冲突) | 1 份(docs/ 版,tailwind 一致) |
| 真源颜色冲突 | success #10B981 vs #16A34A 等 | ✅ 全部对齐 #16A34A/#DC2626 |
| 营销页硬编码 hex | 51 处 | ✅ 0(全部 token 化) |
| 非图表 stale 颜色 | 16 处 | ✅ 0 |
| 卡片组件用 border | 4 组件(11 处) | ✅ 改用 shadow-card |

---

## 🔴 核心发现:两份 DESIGN.md 互相冲突

项目根目录存在两份 DESIGN.md,**给出不同的颜色规范**:

| Token | /root/DESIGN.md (4月版) | /root/docs/DESIGN.md (5月版) | tailwind.config.ts(真源) |
|-------|------------------------|---------------------------|----------------------|
| success (bullish) | `#22c55e` | `#16A34A` | ✅ `#16A34A` |
| error (bearish) | `#ef4444` | `#DC2626` | ✅ `#DC2626` |
| surface | `#171717` | `#111827` (gray-900) | ✅ `#111827` |
| warning | (未列) | `#D97706` | ✅ `#D97706` |
| primary | `#B8860B` | `#B8860B` | ✅ `#B8860B` |

**根目录版是过期的**,与实际 tailwind 实现不符。

### 修复:合并为单一真源
- 保留 `docs/DESIGN.md`(与 tailwind 一致),补入 root 版独有的有用内容(Shadow levels、Motion、Design Rules)
- 归档 `/root/DESIGN.md` → `archive/DESIGN-stale-2026-04.md`
- 记录决策日志

---

## 🎨 色彩系统对齐(根因修复)

### 源头修复(影响最广)
| 文件 | 修复 |
|------|------|
| `lib/accessibility/colors.ts` | success #10B981→#16A34A, error #EF4444→#DC2626, warning #F59E0B→#D97706, info #D4A030→#B8860B |
| `styles/tokens.css` | `--color-up` #22c55e→#16A34A, `--color-down` #ef4444→#DC2626 |
| `components/ui/StatCard.tsx` | variantColors + trend 颜色 |
| `styles/cards.css` | stat-card gradient 色阶 |

### 消费端修复(16 处非图表 stale 颜色)
- `trading/sim`、`trading/community`、`trading/analytics`、`forecasts/show`、`dashboard/performance`、`ai/anomalies`、`anomalies/show`
- `components/ui/OnlineStatus`、`EmptyState`
- `lib/ai-utils.ts`
- 全部 `#22c55e`→`#16A34A`、`#ef4444`→`#DC2626`、`#10B981`→`#16A34A`

**结果**: 非图表组件 stale 颜色 = **0 残留**(图表配置保留字面 hex,合理)。

---

## 🏗️ 营销页 Token 化(51 处)

营销页大量使用 `text-[#B8860B]`、`bg-[#0a0a0a]` 等硬编码 hex,而设计 token (`text-primary`、`bg-background`) 早已存在。本轮全部 token 化:

| 文件 | hex 数 | 修复 |
|------|--------|------|
| `components/landing/Hero.tsx` | 10 | → text-primary / bg-background |
| `app/(marketing)/about/page.tsx` | 17 | → 同上 |
| `app/(marketing)/pricing/page.tsx` | 8 | → bg-primary / hover:bg-primary-hover |
| `app/landing/page.tsx` | 4 | → dark:bg-background |
| `components/landing/{Features,SocialProof,FAQ,GettingStarted}.tsx` | 12 | → text-primary / bg-primary / ring-primary |

**收益**: 主题色变更现在改一处 tailwind config 即可全局生效,无需逐文件改 hex。

---

## 📐 Border-as-Shadow 合规

DESIGN.md 规则 3: 卡片用 `shadow-card` 而非 CSS `border`。修复 4 个组件:

| 组件 | 原 | 修后 |
|------|-----|------|
| `MobileStatsCard.tsx` (×2) | `rounded border bg-card` | `rounded bg-card shadow-card dark:shadow-card-dark` |
| `Skeleton/index.tsx` (×6) | `bg-card rounded-lg border` | `bg-card rounded-lg shadow-card dark:shadow-card-dark` |
| `PortfolioSummary.tsx` (×3) | `rounded-lg bg-card border` | `rounded-lg bg-card shadow-card dark:shadow-card-dark` |

---

## 验证

| 检查 | 结果 |
|------|------|
| Frontend tsc | ✅ EXIT 0 |
| Frontend build | ✅ 无错误(/landing 328KB) |
| Frontend Jest | ✅ 301 pass |
| 非图表 stale 颜色残留 | ✅ 0 |
| 营销页 hex 残留 | ✅ 0 |
| Frontend 重启 | ✅ HTTP 200 |

---

## 净变化

~20 文件修改 + 1 文件归档(root DESIGN.md) + 1 文档增强(docs/DESIGN.md)。
0 新增依赖,0 逻辑改动(纯视觉 token 对齐)。

*本报告基于 design-review 方法论。色彩真源为 tailwind.config.ts;两份 DESIGN.md 的冲突通过比对 token 定义确认。*
