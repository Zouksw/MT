# 前端设计审查报告 — MT 平台

**日期**: 2026-07-12
**使用的 skills**: design-review (静态审查) · frontend-design (视觉方向) · webapp-testing (Playwright 截图 + 视觉分析) · 3× Explore agents (AI-slop/暗色a11y/组件复用)
**方法**: 只读审查(无代码改动)。静态 token-drift 扫描 + 4 个设计维度并行 agent + Playwright 实截图视觉分析。

---

## 总评

设计系统**地基扎实**(自定义字号阶梯、Vercel 风极简阴影、金色品牌色、完整 token 文件),但**执行不一致**:
- 3 套并行的颜色定义体系(tailwind.config.ts hex / tokens.css hex / globals.css oklch)并存
- 组件原语存在但被绕过(35 个手搓 Card、28 个手搓 button、5 种 StatCard)
- 内部页面与营销页是**两种设计语言**(渐变图标块 vs 扁平描边)

**核心矛盾**: 营销页(landing/about/pricing)刻意做对了 — 零渐变、描边卡、不对称 hero;但应用内页面(ai/settings/trading)退回到 AI-slop 的彩虹渐变图标块 + 手搓组件。

---

## 🔴 CRITICAL — 设计系统架构缺陷

### C1. 三套颜色体系并存 (单一真相源缺失)

| 体系 | 位置 | 格式 | primary 值 |
|------|------|------|-----------|
| Tailwind v3 config | `tailwind.config.ts:13` | hex | `#B8860B` |
| CSS 自定义属性 | `styles/tokens.css:8` | hex | `#B8860B` |
| shadcn/ui oklch | `styles/globals.css` `:root` | oklch | `oklch(0.55 0.12 75)` |

`oklch(0.55 0.12 75)` ≈ `#9C7A2E`,**与 hex 的 `#B8860B` 不完全一致**。
两套值共存 → 同一"金色"在不同组件渲染出微妙不同的色调。需统一为单一真相源。

### C2. Button 默认 variant="primary" 是系统性层级 bug 的根因

`components/ui/Button/index.tsx:29` — `<Button>` 无显式 variant 即为实心金色 primary。
后果: **"返回"按钮被渲染成实心金色**(应为 ghost),跨 `forecasts/show:124`、`anomalies/show:133`、`apikeys/show:264`。
单页面同时出现 2-3 个 primary 按钮,用户无法分辨主操作。

### C3. 金色对比度不达 WCAG AA

`#B8860B` 在白底上对比度 ≈ **3.2:1**,低于 AA 要求的 4.5:1(正文)/ 3:1(大字)。
- `text-primary` 用于正文链接/小字时**不达标**(87 处用法,~72 处在浅底)
- `bg-primary text-white` 按钮(白字金底)≈ 3.9:1,对 <18px 文字不达标
- 代码库甚至自带对比度校验工具 `lib/accessibility/colors.ts` 但**未强制执行**

---

## 🟠 HIGH — 组件复用失败 (手搓绕过原语)

### H1. Card 三种形状并存,35 个手搓卡

| 形状 | 样式 | 代表 |
|------|------|------|
| 原语 Card | `rounded-xl ring-1 ring-foreground/10` | (设计系统) |
| 手搓 A | `bg-card rounded-lg shadow-sm border` | anomalies/show(6个)、forecasts/show(6个)、datasets |
| 手搓 B | `rounded-lg bg-card ring-1 ring-black/[0.06]` | dashboard/QuickActions、trading/Panels |
| 手搓 C | `rounded-2xl ring-1 ring-black/[0.06]` | marketing 页 |

### H2. Button 原语只暴露 4 variant,导致 28 个手搓 `<button>`

`Button/index.tsx` 只导出 `primary|secondary|ghost|danger`,而底层 `button.tsx` 有 `outline|link|xs|icon`。
作者需要 outline/icon 变体时只能手搓,绕过 cva 系统。

### H3. StatCard 五种实现

`ui/StatCard.tsx`(原语,带动画/sparkline)只用于 10 页;另有:
- `forecasts/page.tsx:40-69` 本地重写 StatCard(无 error 变体)
- `alerts/page.tsx:334-361` 内联手搓(label + text-2xl)
- `dashboard/performance/page.tsx:191-238` WebVitalCard(又一种边框)
- `dashboard/page.tsx:161-221` 深色 hero stat

同一"大数字+标签"的活,5 种实现,3 种边框/圆角/配色。

### H4. DirectionBadge 用 inline hex 绕过 token

`components/trading/DirectionBadge.tsx:20-53` — `style={{color:"#16a34a"}}` inline hex,完全绕过 Tailwind。
同类: FreshnessBadge 整个 bespoke 组件重复 Tag+OnlineStatus 的功能。

---

## 🟠 HIGH — AI-slop 模式

### A1. 彩虹渐变图标块 (与营销页设计语言冲突)

| 文件 | 数量 | 渐变 |
|------|------|------|
| `ai/page.tsx:12-34,65` | 4 | `from-primary to-blue-400`、`from-red-500 to-orange-400`、`from-purple-500 to-indigo-400`、`from-emerald-500 to-teal-400` |
| `settings/page.tsx:169,326` | 8 | 同类彩虹组合 |

**共 12 个彩虹渐变图标块**,与营销页 `about:88` 的 `ring-1 ring-black/[0.06] text-primary` 扁平风格冲突。

### A2. Emoji 当图标 (跨 OS 渲染不一致)

| 位置 | Emoji |
|------|-------|
| `ui/Alert.tsx:24,30,36,42` | `✓ ⚠ ✗ ℹ` (Unicode 符号) |
| `alerts/page.tsx:161,206` | `❌ ⚠ ℹ 🚨 📈 ⚙️` |
| `beef/factories/page.tsx:10` | 🇦🇺 🇧🇷 🇦🇷 🇺🇾 🇺🇸 国旗 |
| `landing/Features.tsx:101` | 🇧🇷 🇨🇳 🇦🇺 国旗 |

`lucide-react` 已是依赖且同页在用,emoji 是退化。

### A3. 占位内容上线

| 位置 | 问题 |
|------|------|
| `about/page.tsx:257,285,313` | `picsum.photos` 假人头像(marcus-chen/elena-vasquez)在 About 页 |
| `settings/billing/page.tsx:57` | "Payment not yet available — coming soon" 死页 |
| `settings/page.tsx:255` | "Coming Soon" 标签 |
| `dashboard/page.tsx:96` | "Welcome back, User!" 模板问候 |

---

## 🟡 MEDIUM — 暗色模式 / 可访问性 / 加载态

### 暗色模式 (接线正确但执行有洞)

`.dark` class 策略 + cookie SSR 同步正确(color-mode/index.tsx),但:
- `error.tsx`(8 行)只浅色,暗色下破裂
- `ProfessionalChart.tsx:128-137` 骨架 `bg-gray-200` 暗色不可见
- `TimeframeSelector.tsx:33` 切换 `bg-gray-900 text-white : bg-white` 暗色失效
- `--focus-ring` token(tokens.css:118)**定义了但 0 处引用**(死 token)

### 可访问性

- 56 个原生 `<button>` 中 **0 个有 aria-label**(图标按钮)
- `landing/page.tsx:135` 移动端汉堡菜单无 aria-label
- `Input.tsx` 的 `label` prop 可选 — 省略时无 label 也无 aria-label

### 加载/空/错误态不一致

| 页面 | loading | empty | error |
|------|---------|-------|-------|
| ai/predict | ✅ 骨架 | ✅ | ✅ 重试 |
| dashboard | ✅ | ⚠️ 无零数据态 | ✅ |
| trading | ⚠️ 仅 spinner | ⚠️ | ⚠️ 无重试 |
| **datasets** | ✅ | ✅ | ❌ **无错误态**(失败=空表) |
| **ai/anomalies** | ⚠️ spinner | ✅ | ❌ **无内联错误**(`_apiError` 下划线=未用) |
| alerts | ✅ | ✅ | ⚠️ 仅 toast |

`ai/predict` 是唯一三态完备的页,应作模板。

---

## 🟢 LOW / 响应式

- 响应式基本健全:所有大宽度是 `max-w-[...]`(可收缩),无裸 `w-[1200px]`
- 1 处表格无 `overflow-x-auto`(`settings/data-sources:392,474`)
- token-drift 扫描**零任意 hex 颜色**(Round 6 清理生效)、零任意间距 px(仅固定宽度容器)
- phosphor→lucide 迁移**完全干净**(65 文件,0 残留)

---

## 修复优先级 (按杠杆排序)

| # | 修复 | 杠杆 | 范围 |
|---|------|------|------|
| 1 | **统一颜色体系**: 选 oklch 为单一真相源,删 tailwind.config.ts 的 hex 重复 | 高(架构) | tokens.css + globals.css |
| 2 | **金色加深用于文字**: 新增 `--color-primary-text`(更深,达 AA)或限制金色仅用于填充/边框 | 高(a11y) | 全局 |
| 3 | **Button 默认改 secondary**,审全 `<Button>` 加显式 variant | 高(层级) | Button/index.tsx + 调用方 |
| 4 | **合并双 Button/Card 实现**,暴露完整 cva variant | 高(组件) | ui/Button + ui/Card |
| 5 | **统一 StatCard**: 删 forecasts 本地版 + alerts 内联版 | 中(组件) | 3 文件 |
| 6 | **删渐变图标块** → 改 `ring-1 ring-black/[0.06] text-primary` | 中(AI-slop) | ai/page + settings/page |
| 7 | **Emoji → lucide** | 中(AI-slop) | Alert.tsx + alerts/page |
| 8 | **暗色修补**: error.tsx + trading 组件 + TimeframeSelector | 中(暗色) | 5 文件 |
| 9 | **datasets/ai-anomalies 错误态** 补齐(模板=ai/predict) | 中(UX) | 2 页 |
| 10 | **DirectionBadge inline hex → Tag token** | 低(token) | 1 组件 |
| 11 | **占位内容**: 删 picsum 头像 / "Coming Soon" / 死 billing | 低(信誉) | 4 文件 |

---

## 证据索引

- 三色体系: `tailwind.config.ts:13` / `styles/tokens.css:8` / `styles/globals.css :root`
- Button 默认 primary: `components/ui/Button/index.tsx:29`
- 渐变图标块: `ai/page.tsx:12-34,65` / `settings/page.tsx:169,326`
- Emoji 图标: `ui/Alert.tsx:24,30,36,42` / `alerts/page.tsx:161,206`
- 手搓 Card: `anomalies/show/[id]/page.tsx:130-344` (6个) / `forecasts/show/[id]/page.tsx:121-368` (6个)
- StatCard 五版: `ui/StatCard.tsx` / `forecasts/page.tsx:40-69` / `alerts/page.tsx:334-361` / `dashboard/performance/page.tsx:191-238` / `dashboard/page.tsx:161-221`
- DirectionBadge inline hex: `components/trading/DirectionBadge.tsx:20-53`
- 死 focus token: `styles/tokens.css:118`(0 引用)
- 对比度工具未强制: `lib/accessibility/colors.ts`
- 无错误态: `datasets/page.tsx:54` / `ai/anomalies/page.tsx:56`(`_apiError`)
