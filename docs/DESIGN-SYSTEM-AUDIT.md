# MT 前端设计系统深度审计

> **审计日期**：2026-08-07（round-77）
> **方法论**：frontend-design + design-review + frontend-ui-engineering + theme-factory + canvas-design 五技能交叉验证，三 Explore agent 并行全量扫描（158 TSX/TS 文件）
> **事实核验**：所有数字均 live grep / 实测，不沿用历史文档陈述
> **产品锚**：`docs/DESIGN.md` 是设计 brief 的唯一事实来源（"the brief's own words always win"）

---

## 〇、设计理念判定（基于 canvas-design 方法论）

**当前项目的设计 DNA**：`DESIGN.md §215` "Gold = AI intelligence. Every gold element signals AI content. Use sparingly."

这不是装饰，是**产品语义编码**——金色的每一次出现都在告诉用户"这里是 AI 智能"。这是 MT 区别于通用行情平台的设计签名（signature element）。frontend-design 技能要求"让签名元素成为唯一令人记忆深刻的点，周围一切保持安静与克制"——这条原则本项目已正确建立，但执行有偏差（见下）。

**对标定位**：`AGENTS.md` "类牧集网的数据/展示/分析 × 类 IoTDB AINode 的预训练模型预测"。牧集网是中性蓝/绿数据界面；MT 用金色锚定 AI 差异化——设计方向正确，**金色是品牌护城河，不是技术债**。

---

## 一、总体健康度（实测，非主观）

| 维度 | 状态 | 关键数字 |
|---|---|---|
| AI-slop（生成痕迹） | ✅ **异常干净** | `bg-gradient`: **0**；emoji 渲染: 仅 5 国旗（合理）；`shadow-2xl`: 0；`rounded-2xl`: 16（营销页为主） |
| 语义 token 主导 | ✅ | 语义 token ~1000+ 用 vs hex 漂移 180 处（9:1 主导） |
| 设计原语采纳 | ✅ | PageHeader(30)/Button(25)/Card(24)/Toast(20)/Tag(19) 高采纳 |
| 组件拆分 | ⚠️ | 16 个文件 >200 行（ProfessionalChart 582、AnomalyChart 553、PredictionChart 526） |
| 无障碍 | ⚠️ | 30/38 页无 h1；标题跳级；1 个未标注 input；1 个色-only 状态点 |
| 死配置 | ⚠️ | 字号 token 半死（data-*/code 0 用）；动画 token 3/4 死；字体 display/code 别名冗余 |

**结论**：这是一个**真实工程师构建的、非 AI-slop 的设计系统**——token 体系健全、原语采纳高、AI 美学陷阱（紫渐变/全场圆角/lorem）几乎完全规避。主要缺陷是**一致性维护**（token 漂移、标题层级）而非**设计方向**。

---

## 二、Token 系统深度（design-review 方法论）

### 2.1 色彩：三源并存的真相

经 round-76 实测，三源**不是"两套完整 palette 对立"**，而是**局部不一致**：

| Token | `tailwind.config.ts` | `globals.css` oklch | `tokens.css` hex | live 渲染 | 冲突？ |
|---|---|---|---|---|---|
| primary | `#8B6914` 金 | hue 84 ≈ `#8B6A00` | `#8B6914` | 金（var→oklch） | ✅ 一致 |
| info | `#8B6914` 金 | ~~hue 250 蓝~~ → **已修 hue 84**（round-76） | `#8B6914` 金 | 金 | ✅ 已收敛 |
| success | `#16A34A` | hue 145 ≈ 柔绿 | `#16A34A` | 柔绿（oklch） | ⚠️ 色相偏 |
| warning | `#D97706` | hue 70 ≈ 偏橙 | `#D97706` | 偏橙 | ⚠️ 色相偏 |
| destructive | `#DC2626` | hue 27 ≈ `#E52000` | `#DC2626` | 略偏 | ⚠️ 轻微 |

**活源是 `@theme inline` oklch**（globals.css），tailwind.config.ts 颜色段 + tokens.css 颜色段对 `text-*` utility 基本是死配置（被 oklch 全覆盖）。

### 2.2 Token 漂移热点（design-review: "high count = token waiting to be born"）

**hex 漂移 180 处，集中在 3 类**：

1. **图表配置**（最大热点）：`trading/MultiSourceChart.tsx`(34)、`trading/ProfessionalChart.tsx`(25)、`dashboard/performance`(18)、`ForecastTrendChart`(11)、`AlertDistributionChart`(10)——Recharts 接受 JS 值非 CSS var，硬编码 hex 是**框架约束**，非纯 drift
2. **StatCard 内联色**（`StatCard.tsx:127-134`）：6 variant 各硬编码 hex + `style={{color}}`，**包括 `info: "#2563EB"` 蓝——与 round-76 info→金 收敛直接矛盾**（见 §四.1）
3. **EmptyState 内联色**（9 处）

**最大可收敛点**：`#8B6914` 出现 37 次，已定义为 `primary.DEFAULT`——可全部替换为 `text-primary`/`bg-primary`/内联 `var(--primary)`。

### 2.3 WCAG 实测（round-76 已测，此处补全）

| 色值 | 用途 | on 白 | on #0A0A0A | 评 |
|---|---|---|---|---|
| `#8B6914` primary 金 | 文本+按钮 | **5.09 ✓ AA** | 3.89 ~large | ✓ |
| `#16A34A` success | 文本 | 3.30 ~large | **6.01 ✓** | 浅色下需大字 |
| `#D97706` warning | 文本 | 3.19 ~large | **6.21 ✓** | 浅色下需大字 |
| `#DC2626` error | 文本 | **4.83 ✓** | 4.10 ~large | ✓ |
| `#9CA3AF` gray-400 | 次要文本 | **2.85 ✗ FAIL** | — | **85 处用，多处是真文本** |

**`gray-400` (#9CA3AF) 是无障碍重灾区**：85 处使用，对比度 2.85:1 **不过 AA**（需 4.5:1）。实测 `beef/page.tsx:227` "Unable to load prices" 错误文本用 gray-400——错误信息不可读是无障碍红线。

---

## 三、Typography 系统（frontend-design: "typography carries personality"）

### 3.1 双字体加载冗余（实测确认）

`layout.tsx` **同时**通过两机制加载 Geist：
- L1-2: `geist/font` 包 → `GeistSans`(`--font-geist-sans`) + `GeistMono`(`--font-geist-mono`)
- L9,13: `next/font/google` → `Geist`(`--font-sans`)（**第三个独立副本**）
- L75: 三变量全应用；L94: body 又加 `GeistSans.className`

**tailwind.config.ts 只读 `--font-geist-sans`/`--font-geist-mono`**（geist 包），**不读** `--font-sans`（next/font/google）→ **next/font/google 的 Geist 是死加载**，多拉一份字体。`display` 别名与 `sans` 字节相同，`code` 与 `mono` 字节相同——**2 个冗余别名**。

### 3.2 字号 scale：自定义 10:1 落败于默认

| 自定义 token | 用 | 默认 token | 用 |
|---|---|---|---|
| text-display | 1 | text-sm | **308** |
| text-h1 | 6 | text-xs | **289** |
| text-h2 | 1 | text-lg | 32 |
| text-h3 | 3 | text-base | 27 |
| text-h4 | 11 | text-2xl | 22 |
| text-body | 27 | text-xl | 12 |
| text-body-lg | 6 | text-3xl | 14 |
| text-body-sm | 17 | text-4xl | 12 |
| text-data-lg | **0** | text-5xl | 5 |
| text-data | **0** | | |
| text-data-sm | **0** | | |
| text-code | **0** | | |

**自定义 scale 72 用 vs 默认 716 用（10:1 落败）**。`text-data-lg/data/data-sm/code` 全 0 用——**死配置**。实际 body 是 `text-sm`(308) + `text-xs`(289)，不是 `text-body`(27)。

### 3.3 字重违规（DESIGN.md "Only 400/500/600"）

- `font-medium`(500): 205 ✅
- `font-semibold`(600): 180 ✅
- `font-bold`(700): **8 违规**（data-sources 3 + DataHealthCard 3 + ImportResultTable 1 + PriceForecastPanel 1）
- `font-light`(300): 0 ✅

违规集中在 2 文件（data-sources 相关），可定向修。

---

## 四、组件架构（frontend-ui-engineering 红线）

### 4.1 StatCard：D4-2 收购后遗留的 info 蓝内联

`StatCard.tsx:127-134` variantColors 硬编码 hex + `style={{color}}`：
```typescript
info: { text: "#2563EB" },  // 蓝！与 round-76 info→金 直接矛盾
```
D4-2 把 StatCard 收购成单源（无本地副本，14 处全引 `@/components/ui/StatCard`），但**内部色板未对齐 token**。这是 round-76 调色板收敛的**遗留漏洞**——info 在 globals.css 已是金，在 StatCard 内联仍是蓝。

### 4.2 大组件红线（>200 行 = 拆分信号）

| 文件 | 行 | 类型 |
|---|---|---|
| trading/ProfessionalChart.tsx | **582** | 图表 |
| charts/AnomalyChart.tsx | **553** | 图表 |
| charts/PredictionChart.tsx | **526** | 图表 |
| trading/PriceForecastPanel.tsx | 364 | 面板 |
| beef/CutForecastSection.tsx | 305 | 区段 |
| landing/Hero.tsx | 288 | 营销 |
| ui/GeometricArt.tsx | 273 | 装饰 |

前 3 大都是图表组件——Recharts 配置天然长，但 500+ 行通常意味着 tooltip/legend/format 逻辑未抽。

### 4.3 原语 vs 手写

| 原语 | 用 | 手写替代 |
|---|---|---|
| `<Card>` | 280 | 60 手写 card-div |
| `<Button>` | 123 | 60 原生 `<button>` |
| `<EmptyState>` | 4 | 56 空 array 检查（多数路由到 EmptyState） |
| `<ErrorDisplay>` | 8 | 26 catch（8 用 ErrorDisplay） |
| `<LoadingState>` | 37 | 4 bare "Loading..." 文本 |

Card/Button 主导但 60 手写原生 `<button>` 是 consistency 缺口（Button/index.tsx 注释自称是 raw button 根因）。

---

## 五、无障碍（WCAG 2.1 AA，frontend-ui-engineering 硬要求）

### 5.1 标题层级（最严重，影响 SEO + 屏幕阅读器导航）

**30/38 页无 `<h1>`**。首标题级别分布（实测全量）：
- 无 h1：30 页（dashboard/beef/trading/ai 大多）
- h1：6 页（alerts/show, apikeys/edit, datasets/show, about, pricing, market-news 相关）
- **h4 起始跳级**：settings(4) + settings/profile(4)
- **h3 起始跳级**：trading, beef, apikeys/show

**dashboard/page.tsx 源序错乱**：h2(137) → **h1(155)** → h2(233) → h3(402)——h1 出现在 h2 之后。

### 5.2 真实缺陷清单

| 缺陷 | 位置 | 严重度 |
|---|---|---|
| 色-only 状态点 | `data-sources/page.tsx:133-145` StatusDot healthy/error 无文本/aria | **高**（WCAG 1.4.1） |
| 未标注 input | `beef/page.tsx:257` 搜索框无 label/aria-label | **高**（WCAG 3.3.2） |
| gray-400 错误文本 | `beef/page.tsx:227` "Unable to load prices" 2.85:1 fail | **高**（不可读错误） |
| title-only 命名 | `data-sources/page.tsx:507,519` 图标按钮用 title 非 aria-label | 中 |
| avatar alt="" | 3 处用户头像 alt="" 应为 alt={name} | 低 |

### 5.3 已做对的无障碍（不应回退）

- skip-to-content 链接（layout.tsx:95）+ `<main id="main-content">` ✅
- 单 `<main>` + 单 `<nav aria-label>` ✅
- icon-only 按钮 3/3 有 aria-label ✅
- **0 处** onClick-on-div/span ✅
- Modal 用 base-ui Dialog（自带 focus trap/restore）✅
- reduced-motion CSS 2 块 + JS 4 处 ✅（但 animate-spin 34 处未 motion-aware）

---

## 六、Motion 系统（frontend-design: "leverage motion deliberately"）

### 6.1 三套动画系统并存

| 系统 | 活用 | 死用 |
|---|---|---|
| tailwind.config 动画 | skeleton-pulse(1) | **fade-in/slide-up/modal-in 全 0** |
| animations.css (~20 keyframes) | slide-up(9)/fade-in(5)/shimmer(2) | stagger-fade-in/scale-in/shimmer-slide/mobile-fab/pulse-soft **0** |
| tw-animate-css | animate-in(4)/fade-in(5)/zoom/slide ~27 | — |
| framer-motion (motion.ts) | PageTransition/MotionReveal/landing | — |

**tailwind.config 的 4 个动画 token 中 3 个死**——实际动画靠 animations.css + tw-animate-css + framer-motion。`animate-spin`(34) + `animate-pulse`(25) 是默认 Tailwind，最常用。

### 6.2 reduced-motion 缺口

CSS reduced-motion 块覆盖页面过渡/stagger/modal/skeleton，**但不覆盖 `animate-spin`（34 处）**——用户设 reduced-motion 时 spinner 仍转。需加 `@media (prefers-reduced-motion: reduce){ .animate-spin{ animation: none } }` 或用 `motion-reduce:` 变体。

---

## 七、综合判定与优先级

### 设计方向：**正确，勿改**
金色锚 AI 智能、语义 token 主导、AI-slop 几乎清零、原语采纳高——这是一个**设计方向健康**的系统。frontend-design 的"signature element"（金色）已正确建立。

### 真实缺陷：**一致性 > 方向**

| 优先级 | 项 | ROI | 依赖 |
|---|---|---|---|
| **P0** | gray-400(2.85:1) 用于真文本→改 gray-500/600 | 高（无障碍红线） | 无 |
| **P0** | beef 搜索 input 加 aria-label | 高（WCAG） | 无 |
| **P0** | StatusDot healthy/error 加文本/aria | 高（WCAG 1.4.1） | 无 |
| **P1** | StatCard info `#2563EB`→金（补 round-76 漏洞） | 高（调色板一致） | 无 |
| **P1** | 30 页加 h1 + 修跳级 | 中（SEO+a11y） | 无 |
| **P2** | 死字号/动画 token 清理 | 低（§十.5 不删非己所造，仅标记） | 无 |
| **P2** | next/font/google 死字体加载移除 | 低（性能） | 无 |
| **P3** | animate-spin motion-aware | 低 | 无 |
| **P3** | 大图表组件拆分 | 低（§十.5 不顺手改） | 无 |

### 不建议做的（§十.5 外科约束）
- 不删 tokens.css `--color-*`（0 引用但非己所造）
- 不强制全切自定义字号 token（默认 Tailwind 已成事实标准，10:1）
- 不重构 ProfessionalChart 等（非本轮范围，且图表长配置是框架特性）

---

## 八、技能应用记录

| 技能 | 应用 |
|---|---|
| frontend-design | "brief's words win"→金为权威；"signature element"→金色锚定已正确 |
| design-review | token-drift 扫描法→发现 180 hex 漂移 + StatCard info 蓝遗留 |
| frontend-ui-engineering | >200 行红线→16 文件；AI-slop 表→0 gradient 证清；a11y checklist→标题/input/色缺陷 |
| theme-factory | 色彩对比参考（WCAG 实测法） |
| canvas-design | 设计 DNA 提炼→"Gold = AI intelligence" 是签名元素 |

---

**本审计为只读研究，未改任何代码。后续动手需按 §七 优先级逐项独立 commit + tsc + test + live 验证。**
