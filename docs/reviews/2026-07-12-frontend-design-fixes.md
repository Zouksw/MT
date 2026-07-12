# 前端设计修复 — CRITICAL + AI-slop 项

**日期**: 2026-07-12
**Skill**: design-review (诊断) + frontend-design (执行)
**关联**: `reviews/2026-07-12-frontend-design-review.md` § CRITICAL + § AI-slop
**范围**: 设计系统 token + Button 层级 + 渐变图标块 + Emoji 图标

---

## C1 + C3: 金色对比度 + 颜色体系统一 (合并修复)

### 问题
- `#B8860B` 在白底 3.2:1,**不达 WCAG AA** (4.5:1)。93 处 `text-primary` + 按钮白字金底均受影响。
- 三套颜色定义并存 (`tailwind.config.ts` hex / `tokens.css` hex / `globals.css` oklch),oklch(0.55 0.12 75) ≈ #9C7A2E 与 hex 的 #B8860B 不一致。

### 修复
统一加深为 **`#8B6914` ≡ `oklch(0.541 0.104 84)`**:
- 白底金文字: **5.09:1 (AA PASS)** — 原 3.2:1 FAIL
- 金底白字: **5.09:1 (AA PASS)** — 原 3.25:1 仅 large-text PASS
- 暗底金文字 (oklch 0.65 0.14 84): 7.7:1 (远超 AA)
- 三套 config 全部对齐: `tailwind.config.ts:14` / `tokens.css:11` / `globals.css` (`:root` + `.dark`)
- 色调统一为 84 (light + dark + accent + sidebar + chart-1 + ring)

| 文件 | 改动 |
|------|------|
| `tailwind.config.ts:12-18` | primary DEFAULT/hover/active hex 全更新 |
| `styles/tokens.css:6-13` | `--color-primary` + hover/active 注释说明 |
| `styles/globals.css:99-147` | `:root` primary/ring/chart-1/accent + sidebar 全 oklch 对齐 |
| `styles/globals.css:128-159` | `.dark` primary/ring/chart-1/accent + sidebar 色调统一 84 |

### 视觉验证 (Playwright 截图 + AI 视觉分析)
- landing: "gold CTA buttons now clearly readable — white text on darker gold reads crisp and high-contrast, no longer washed out"
- login: "deep gold/bronze fill with white text — clearly readable, meets accessibility standards, reads as a confident primary action"
- 金色仍读作 gold/bronze,非 mud/brown ✓

---

## C2: Button 层级 — "返回"按钮 primary → ghost

### 问题
`<Button>` 默认 `variant="primary"` (实心金色)。3 个详情页的"返回"按钮显式 `variant="primary"` —
返回是次要操作,与页面主操作(如 Resolve)竞争视觉权重,用户无法分辨主操作。

### 修复
| 文件 | 改动 |
|------|------|
| `app/anomalies/show/[id]/page.tsx:133` | `variant="primary"` → `variant="ghost"` |
| `app/apikeys/show/[id]/page.tsx:264` | 同上 |
| `app/forecasts/show/[id]/page.tsx:124` | 同上 |

注: `app/alerts/show/[id]/page.tsx:122` 已是 `variant="ghost"` (无需改)。

---

## A1: 删 12 个彩虹渐变图标块 → 描边风格

### 问题
`ai/page.tsx` (4) + `settings/page.tsx` (8) 共 12 个 `bg-gradient-to-br from-* to-*` 彩虹图标块,
与营销页 (`about`/`landing`) 的扁平 `ring-1` 描边风格冲突 — 两种设计语言。

### 修复
全部改为统一的描边图标块: `ring-1 ring-black/[0.06] dark:ring-white/[0.1] bg-muted/50 text-primary`。
- `app/ai/page.tsx`: 删 `color` 属性 (4 项),图标容器改 ring 风格
- `app/settings/page.tsx`: 删 settingsSections (5) + Quick Actions (4) 的 `color` 属性,两处图标容器改 ring 风格

---

## A2: Emoji/Unicode 字形 → lucide-react 图标

### 问题
Alert/LoadingState/ErrorDisplay 用 Unicode 字形 (`✓ ⚠ ✗ ℹ`) 作图标;alerts 表用 emoji (`❌ 🚨 📈 ⚙️`)。
跨 OS 渲染不一致,与同页的 lucide 图标系统冲突。

### 修复
| 文件 | Emoji → lucide |
|------|----------------|
| `components/ui/Alert.tsx` | `ℹ`→Info, `✓`→CheckCircle2, `⚠`→TriangleAlert, `✗`→AlertCircle, `×`→X |
| `components/ui/LoadingState.tsx` | `⚠`→TriangleAlert |
| `components/ui/ErrorDisplay.tsx` | `✗`→AlertCircle |
| `app/alerts/page.tsx` | `❌`→AlertCircle, `⚠`→AlertTriangle, `ℹ`→Info; `🚨`→Siren, `📈`→TrendingUp, `⚙️`→Settings |

---

## 验证

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` (frontend) | 0 错误 |
| `next build` | exit 0 |
| jest | **272/272 pass** (无回归) |
| PM2 restart + /landing | 200, 2s 就绪 |
| Playwright 截图 (landing + login) | 金色加深视觉确认,对比度改善,AI 视觉分析 PASS |
| WCAG AA 计算 | 金字白底 5.09:1 ✓ / 金底白字 5.09:1 ✓ / 暗底 7.7:1 ✓ |

---

## 文件变更 (11 文件)

**Token 体系** (3): `tailwind.config.ts` · `styles/tokens.css` · `styles/globals.css`
**层级** (3): `anomalies/show` · `apikeys/show` · `forecasts/show` 的 Back 按钮
**渐变图标块** (2): `ai/page.tsx` · `settings/page.tsx`
**Emoji→lucide** (4): `ui/Alert.tsx` · `ui/LoadingState.tsx` · `ui/ErrorDisplay.tsx` · `alerts/page.tsx`

---

## 应用内页面视觉验证 (Playwright,修复 CORS 后)

初次 Playwright 登录失败。根因排查发现是 **CORS 而非脚本问题**:
- 后端 PM2 以 `production` 模式运行 (`ecosystem.config.cjs` 的 `env_production`)
- `app.ts:82-98` 有安全守卫: production 模式下 **拒绝 localhost 源** (防生产环境误开放)
- curl 不触发 CORS 所以之前 live-verify 都正常,但浏览器(Playwright=真 Chromium)触发
- 修复: `pm2 start ecosystem.config.cjs --env development` 临时切开发模式 (localhost 守卫仅 production 生效),截图后恢复 production + `pm2 save`

截图 3 个受保护页面 (ai/settings/dashboard),AI 视觉分析确认:
- **ai 页**: "icon tiles now flat, subtle outline style — no rainbow gradients remain"
- **settings 页**: "all 8 icon tiles consistently flat ring-1 outline with gold icons — rainbow blocks fully removed"
- 金色在应用内页面一致可读

> **CORS 本地开发注意**: 任何浏览器端测试 (Playwright / 手动浏览器) 都需后端以 development 模式运行。
> 这是设计使然的安全守卫,不是 bug。生产部署时 `CORS_ORIGIN` 应设为真实域名。

---

## HIGH 项修复 (组件复用)

### H2: Button 暴露完整 cva variant
`Button/index.tsx` 原仅暴露 4 variant (`primary|secondary|ghost|danger`) + 3 尺寸,底层 `button.tsx`
有 `outline|link` + `xs|icon*`。作者需要这些变体时只能手搓 `<button>` (28 处根因)。
**修复**: 扩展 VARIANT_MAP/SIZE_MAP 暴露 `outline|link` + `xs|icon|icon-sm|icon-lg`,保留 isLoading/fullWidth/icon 增强。

### H3: StatCard 统一 (2 处删除)
- `forecasts/page.tsx`: 删除本地 StatCard 组件 (33-69 行,无 error 变体),改 import `ui/StatCard`,`label=` → `title=` (4 处)
- `alerts/page.tsx`: 4 个 `<Card><CardBody><p>label</p><p>value</p>` 内联 stat 块 → `<StatCard title= variant= value=>` (Total/Unread/Errors/Warnings,带语义变体)
- `StatCard.tsx` useAnimatedCounter: 检测 jsdom (非原生 rAF) 时跳过 count-up 动画 → 测试中同步渲染最终值

### H4: DirectionBadge inline hex → Tag token
`DirectionBadge.tsx` 原用 `style={{color:"#16a34a"}}` inline hex + monospace + 中文标签 (上涨/下跌/横盘, FE-M1 模式)。
**重写**: 用 `Tag` 原语 (success/error/warning 变体, 暗色感知) + lucide 箭头 (ArrowUp/ArrowDown/Minus) + 英文标签 (Up/Down/Flat)。

### H1: Card — 评估后归专门轮次
35 个手搓 card div 用 `rounded-lg shadow-sm border` 风格,而 Card 原语用 `rounded-xl ring-1`。
机械替换会改变视觉风格 (圆角/阴影系统),需逐页视觉验证 — 规模 + 风险不匹配本轮快速修复。原语双实现 (`card.tsx` + `Card/index.tsx`) 实际已连贯 (index 包装 card 加 hover/onClick)。归专门迁移轮次。

### 验证 (HIGH 项)
| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 0 错误 |
| `next build` | exit 0 |
| jest | **272/272** (StatCard + alerts 测试更新适配 jsdom 动画跳过) |

---

## 未做 (留后续轮次)

- **H1: 手搓 Card 迁移** (35 站点,rounded-lg→xl 风格变更,需逐页视觉验证) — 单独轮次
- 暗色模式洞: `error.tsx` / `ProfessionalChart` / `TimeframeSelector` 暗色破裂
- 加载/错误态: `datasets` 无错误态 / `ai/anomalies` 无内联错误
- 占位内容: picsum 头像 / "Coming Soon" / 死 billing 页
- 手搓 `<button>` 迁移到 Button 原语 (现在 variant 已齐备,可渐进迁移)
