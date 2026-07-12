# 前端提升最佳计划 — MT 平台

**日期**: 2026-07-12
**方法**: web 研究(2026 最杰出金融/数据界面设计) + frontend-design skill + 3 路并行 Explore agent (信息架构/数据可视化/营销页)
**对标**: Stripe / Linear / Vercel / Grafana / Bloomberg 终端 / FinboTech

---

## 研究基准 (2026 最杰出设计原则)

来自 [Dashboard Design Patterns 2026](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/) + [35 SaaS Dashboard Examples](https://www.925studios.co/blog/saas-dashboard-design-examples-2026) + [Eleken Financial Dashboards](https://www.eleken.co/blog-posts/financial-dashboard-examples):

| 原则 | 杰出实践 | MT 现状 |
|------|---------|--------|
| **冷静 UI 承载数据密度** | FinboTech: 杂乱数据用克制界面 | ⚠️ 装饰性深色 AI 卡 + 彩虹渐变 (已部分修) |
| **KPI 层级清晰** | Stripe: 一个 hero metric + 次级 | ❌ 4 个库存计数当 KPI,无实时价格 |
| **绿色=涨/红色=跌 仅此语义** | Bloomberg/Grafana 严格 | ❌ 绿红还用于严重度/新鲜度/置信度/"最佳" |
| **展示产品,不展示插画** | Linear/Vercel hero = 真实界面截图 | ✅ landing hero 有真实仪表盘 mock (最强项) |
| **持续导航** | 所有杰出产品有侧栏/顶栏 | ❌ Header 是死代码,10 个顶级区无导航 |
| **数据格式统一** | Intl.NumberFormat 共享 | ❌ 142 处 ad-hoc toFixed,MAPE 精度不一致 |
| **真实社交证明** | 客户 logo/证言/实例 | ❌ 全无,且数字自相矛盾 |

---

## 三个 CRITICAL 发现 (探查阶段新发现)

### N1. 应用内无持续导航 — Header 是死代码
`components/header/index.tsx` 定义了导航但**从未被任何页面渲染**。50 个路由、10 个顶级区,用户只能靠 QuickActions (4 链接)、面包屑或手改 URL 导航。移动端零导航。
**影响**: 用户进了 dashboard 就迷路,找不到 AI/trading/alerts 等核心功能。这是最大的可用性缺陷。

### N2. 虚假 WebSocket 声明 + 仪表盘显示假数据
- landing 页声称 "WebSocket alerts <50ms" (`FAQ.tsx:42`),但前端**零 WebSocket 代码**
- 仪表盘主图 `ForecastTrendChart` 默认显示**硬编码 mock 数据** (Mon=12…Sun=28, `ForecastTrendChart.tsx:55-77`),`page.tsx:139` 不传真实数据
- trading/dashboard 页**无自动刷新** (`useTradingData`/`useDashboardStats` 无 refreshInterval)
**影响**: 信任崩塌 — 产品承诺实时,实际连轮询都没有。

### N3. 产品故事自相矛盾
landing 卖 **beef-only** (85 cuts/6 models),about/pricing 卖 **108 商品** (7 models)。
GettingStarted 在 beef hero 旁显示 **Crude Oil/Gold/Natural Gas** 价格。
**影响**: 访客滚动一页就看到不同产品,landing 的具体数字显得不可信。

---

## 提升计划 (4 阶段,按信任 → 可用 → 品质 → 品牌排序)

> 原则: 先修信任漏洞(假声明/假数据),再修可用性(导航),然后品质(数据呈现),最后品牌(营销一致性)。

### 阶段 1 — 信任修复 (P0,阻断性)

| # | 任务 | 文件 | 依据 |
|---|------|------|------|
| 1.1 | **删 landing 页 WebSocket 假声明** (改为真实轮询频率说明) | `components/landing/{FAQ,Features}.tsx` | N2 |
| 1.2 | **仪表盘假数据替换为真实数据或空态** | `ForecastTrendChart.tsx` + `dashboard/page.tsx:139` | N2 |
| 1.3 | **trading/dashboard 加 SWR refreshInterval** (30s) | `useTradingData.ts`/`useDashboardStats.ts` | N2 (次优实时方案,WebSocket 留后续) |
| 1.4 | **统一产品数字** (确定: 108 商品 / 8 模型,还是 beef-only) | landing/about/pricing 全局 | N3 |

**验证**: landing 不再有无支撑声明;dashboard 显示真实数据或诚空态;数字跨页一致。

### 阶段 2 — 可用性地基 (P0,体验阻断)

| # | 任务 | 文件 | 对标 |
|---|------|------|------|
| 2.1 | **创建应用 Shell 布局** (persistent sidebar + top bar),挂载 Header | 新 `app/(app)/layout.tsx` + 侧栏组件 | Linear/Vercel/Stripe 全有侧栏 |
| 2.2 | **侧栏导航 10 个区分组**: Overview(dashboard/analysis) / Markets(trading/beef) / Intelligence(ai/forecasts/anomalies) / Data(datasets/timeseries) / System(alerts/apikeys/settings) | 新 sidebar 组件 | IA 收敛 |
| 2.3 | **移动端抽屉导航** (复用 landing 的 hamburger 模式) | sidebar 组件 responsive | N1 |
| 2.4 | **面包屑标准化** (layout 层注入,不再 per-page opt-in) | PageContainer/PageHeader | 17/50 → 全覆盖 |

**验证**: 任何页面都能一键回到首页/切到任意区;移动端有抽屉。

### 阶段 3 — 数据呈现品质 (P1,核心价值)

| # | 任务 | 文件 | 对标 |
|---|------|------|------|
| 3.1 | **共享数字格式化器** `lib/format.ts` (Intl.NumberFormat, 按货币/精度) | 新文件 + 142 处迁移 | Stripe 的统一货币格式 |
| 3.2 | **颜色语义严格执行**: 绿=涨/红=跌/金=AI品牌;严重度/新鲜度/置信度改用蓝/灰/描边 | chart-config + 全局 | Bloomberg 严格惯例 |
| 3.3 | **仪表盘 KPI 重构**: hero = 基准商品最新价 + 日涨跌;次级 = 覆盖率/信号数/异常数 | dashboard/page.tsx | Stripe 单一 hero metric |
| 3.4 | **Table 组件加排序/分页** (消灭 6 处手搓 pageSize/slice) | Table.tsx + 6 列表页 | Grafana/Linear 表格 |
| 3.5 | **chart skeleton 统一** (ProfessionalChart 的骨架模式推广到 5 个 recharts 图) | charts/*.tsx | Linear 的 skeleton |

**验证**: 数字格式跨页一致;颜色语义无冲突;仪表盘首屏即见实时价;表格可排序分页。

### 阶段 4 — 品牌完整度 (P2,转化优化)

| # | 任务 | 文件 | 对标 |
|---|------|------|------|
| 4.1 | **about 页清理**: 删 picsum 假头像 / 删不实统计 (487 企业用户等) 或替换为真实数据 | about/page.tsx | N3 + 探查发现 |
| 4.2 | **logo/wordmark 一致** (T vs MT vs TradeMind 统一) | landing/about/logo | 探查发现 |
| 4.3 | **真实社交证明** (1 个实例/证言/logo,或诚实移除该区) | SocialProof.tsx | 杰出产品全有 |
| 4.4 | **排版个性化** (Geist 是默认;评估一个 characterful display 字体用于 hero,或保留 Geist 但做独特字重处理) | typography.css | frontend-design skill: "排版承载个性" |
| 4.5 | **signature 元素强化** (hex grid 是已有的 owned motif — 推广为 loading pattern / 空态插画 / 图表水印) | GeometricArt 复用 | frontend-design: "花在一处的勇气" |

**验证**: 无占位内容;品牌元素跨页一致;至少一个令人记忆的点。

---

## 不做 (明确排除,避免过度工程)

- ❌ **真实 WebSocket 实时推送** — 阶段 1 用 30s 轮询替代;WebSocket 是后端架构改动,ROI 不足,留待数据覆盖达标后
- ❌ **重写图表库** — ProfessionalChart (lightweight-charts) 已是 Bloomberg 级;recharts 动态导入已对;只统一状态/颜色
- ❌ **i18n 多语言** — 之前已删;当前单语(英)足够
- ❌ **动画/微交互堆砌** — frontend-design skill 明确: "额外动画增加 AI 生成感";当前 MotionReveal 已足够
- ❌ **设计系统重写** — token 体系(Round 26 已统一金色)+ 组件原语已存在;阶段 3 是迁移非重写

---

## 风险与依赖

1. **阶段 1.4 (统一数字) 需产品决策** — 是定位 "beef 贸易情报" 还是 "108 商品分析平台"? 这影响 landing 全文。需用户拍板。
2. **阶段 2.1 (应用 Shell) 是架构改动** — 需 `(app)` 路由组重组,可能影响 middleware 认证路径。需仔细测试。
3. **阶段 3.1 (格式化器迁移)** — 142 处,规模大但机械;分批进行,每批验证 build+test。
4. **阶段 3.2 (颜色语义)** — 改动面广(严重度/新鲜度/置信度都改色),需视觉验证每个改动页。

---

## 度量目标

| 指标 | 现状 | 目标 |
|------|------|------|
| 应用内导航可达性 | Header 死代码,4 链接 | **10 区全覆盖,侧栏持续可见** |
| 仪表盘首屏信息 | 4 库存计数 + 假数据图 | **1 实时价格 hero + 真实次级** |
| 数字格式化一致性 | 142 处 ad-hoc | **0 处 ad-hoc,全走 lib/format** |
| 颜色语义冲突 | 4+ 绿色 hex 过载 | **绿/红仅方向,其余蓝/灰** |
| 营销页占位/矛盾 | picsum 头像 + 6vs7 模型 + beef vs 108 | **0 占位,数字单一真相** |
| 虚假声明 | WebSocket <50ms (不存在) | **0 虚假,声明与实现一致** |
