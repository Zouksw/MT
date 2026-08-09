# 产品最终形态 Spec — 牛肉贸易数据 + AI 预测平台

**日期**: 2026-07-12
**定位决策**: 类**牧集网**的牛肉贸易数据收集/展示/分析平台 + 集成类 **IoTDB AINode** 的数据预测功能
**依据**: [牧集网 web.mooket.com](https://web.mooket.com/) + [牧集 App Store](https://apps.apple.com/cn/app/牧集/id1624403418) + 项目 Round 12 AINode 架构

---

## 一、产品定位 (一句话)

> **为中国牛肉产业链上下游提供进口/国产牛肉价格数据采集、行情展示、多维分析,并以 AI 模型预测未来价格走势的专业平台。**

**对标**: 牧集网 (数据+资讯+交易) 的数据/分析层 + IoTDB AINode (预训练模型预测) 的智能层。
**差异化**: 牧集网无 AI 预测;AINode 无行业数据。本项目 = **牧集的数据深度 × AINode 的预测智能**。

---

## 二、牧集网产品形态拆解 (对标基准)

牧集网 (mooket.com) 核心功能:

| 模块 | 牧集网 | 本项目现状 | 差距 |
|------|--------|-----------|------|
| **行情数据** | 进口牛肉/国产牛肉/牛副产品价格 | ✅ 有 (7 源: abares/cepea/inac/mla/secex/usda_ams/usda_psd) | 数据源已具备,需激活+补采 |
| **价格展示** | 按部位/产地/进口国分类 | ✅ beef 页有 cuts/factories | 需优化为牧集式的行情看板 |
| **资讯服务** | 行业资讯/市场动态推送 | ✅ 有 (MarketNews model + route + service + 5 页, 2026-07-19 建) | 已建,需内容运营 |
| **数据可视化** | 价格走势图/对比图 | ✅ ProfessionalChart (K线) + recharts | 需牧集式的行情总览页 |
| **交易撮合** | 连接上下游服务商 | ❌ 无 (且按 CLAUDE.md 不做交易) | **明确不做** (定位为信息平台) |
| **AI 预测** | 无 | ✅ 6 统计模型 + chronos (AINode 架构) | **核心差异化优势** |

### 关键决策: 做牧集的"数据+分析+资讯",不做"交易"
CLAUDE.md 已明确"信息平台,非交易平台"。交易撮合不做。这反而简化了产品 — 聚焦数据深度 + AI 预测。

---

## 三、IoTDB AINode 预测能力 (项目已有)

项目 Round 12 已采用 **pretrained-model-only 架构** (类 IoTDB AINode):

| 能力 | 现状 | 前端展示 |
|------|------|---------|
| **统计模型** (6) | arima / sarimax / holtwinters / exponential_smoothing / naive_forecaster / stl_forecaster | `/ai/predict` `/ai/accuracy` |
| **深度模型** (3) | chronos (chronos-t5 tiny/mini/base 预训练,零样预测) | 同上 |
| **预测缓存** | Redis (prediction:{commodityId}:{modelId}:{horizon}, 45min TTL) | 后台 30min 调度 |
| **MAPE 验证** | prediction_logs verified 状态 | `/ai/accuracy` 页 |
| **多模型共识** | generateForecast 多模型投票 | `/trading` PriceForecastPanel |

**前端差距**: AI 预测功能存在但**藏在 /ai 子页面**,主流程不可见。牧集式平台应把预测**融入行情页** (每个商品旁直接显示"7日预测↑2.3% (置信度78%)")。

---

## 四、最终信息架构 (IA)

```
┌─────────────────────────────────────────────────────────┐
│  顶栏: logo + 搜索(商品/部位) + 通知 + 用户菜单          │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  侧栏    │   主内容区                                    │
│          │                                              │
│  ◆ 行情  │                                              │
│    价格总览│                                              │
│    进口牛肉│                                              │
│    国产牛肉│                                              │
│    牛副产品│                                              │
│          │                                              │
│  ◆ 分析  │                                              │
│    价格走势│                                              │
│    产地对比│                                              │
│    相关性 │                                              │
│          │                                              │
│  ◆ AI 预测│                                              │
│    价格预测│                                              │
│    模型准确率│                                            │
│    异常检测│                                              │
│          │                                              │
│  ◆ 资讯  │  (新增)                                       │
│    市场动态│                                              │
│          │                                              │
│  ◆ 数据  │                                              │
│    数据源 │                                              │
│    数据集 │                                              │
│    时间序列│                                              │
│          │                                              │
│  ◆ 系统  │                                              │
│    告警 │                                              │
│    设置 │                                              │
│    API Key│                                             │
└──────────┴──────────────────────────────────────────────┘
```

### 与现状的映射 (不新建路由,重组+重命名)

| 新 IA | 现有路由 | 调整 |
|-------|---------|------|
| 行情 > 价格总览 | `/dashboard` | **重定位**: 库存计数 → 实时牛肉价格看板 |
| 行情 > 进口牛肉 | `/beef` | 重命名/聚焦为进口牛肉行情 |
| 行情 > 国产牛肉 | `/beef` (筛选) | 按产地拆分视图 |
| 行情 > 牛副产品 | `/beef/cuts` | 按部位分类 |
| 分析 > 价格走势 | `/trading` | 保留 (ProfessionalChart 是核心资产) |
| 分析 > 产地对比 | `/dashboard/analysis` | 聚焦多产地价格对比 |
| 分析 > 相关性 | `/dashboard/analysis` (correlation) | 已有逻辑,提取独立页 |
| AI 预测 > 价格预测 | `/ai/predict` | **融入行情**: 每个商品旁显示预测 |
| AI 预测 > 模型准确率 | `/ai/accuracy` | 保留 |
| AI 预测 > 异常检测 | `/ai/anomalies` | 保留 |
| 资讯 > 市场动态 | (新增) | **新模块** — 资讯/市场动态 |
| 数据 > 数据源 | `/settings/data-sources` | 提升为顶级 (数据是核心) |
| 数据 > 数据集 | `/datasets` | 保留 |
| 数据 > 时间序列 | `/timeseries` | 保留 |
| 系统 > 告警 | `/alerts` | 保留 |
| 系统 > 设置 | `/settings` | 保留 |

**删除/降级**:
- `/trading/portfolio` `/trading/watchlist` — 交易语义,降级为"关注列表" (符合信息平台定位)
- `/forecasts` — 与 `/ai/predict` 重复,合并
- 108 商品 → **聚焦牛肉品类** (crude_oil/gold 等非牛肉商品从主 IA 移除,保留在数据层但不进导航)

---

## 五、核心页面最终形态

### 5.1 行情总览页 (首页,对标牧集首页)
```
┌────────────────────────────────────────────────────┐
│  今日牛肉行情                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 进口均价  │ │ 国产均价  │ │ AI 7日预测│           │
│  │ ¥XXX/kg  │ │ ¥XXX/kg  │ │ ↑2.3%    │           │
│  │ ↓1.2%   │ │ ↑0.5%   │ │ 置信78%  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                    │
│  热门部位价格 [表格: 部位 | 产地 | 今日价 | 涨跌 | 7日预测]│
│  Chuck Roll    巴西   ¥45.2   ↓0.8%   ↑1.2%       │
│  Brisket       美国   ¥52.1   ↑1.1%   ↑2.8%       │
│  ...                                               │
│                                                    │
│  最新市场动态 [资讯流 3-5 条]                        │
└────────────────────────────────────────────────────┘
```

### 5.2 价格走势页 (= 现有 /trading,保留 ProfessionalChart)
保留 Bloomberg 级 K线 + AI 预测叠加。这是已有最强资产,不改。

### 5.3 AI 预测融入行情 (核心差异化)
每个商品的行情行旁直接显示:
- **7日预测方向** (↑/↓/平) + **变化幅度** + **置信度** + **模型数**
- 点击展开 → 多模型预测详情 + 置信区间图
- 这让 AI 预测从"藏在子页面"变成"每个价格都带预测"

### 5.4 资讯模块 (已建,对标牧集资讯)
- ✅ 已实现: MarketNews model + marketNews route + marketNewsService + 5 前端页 (2026-07-19)
- 市场动态 feed (手动录入已支持 /market-news/create;外部 RSS/新闻 API 待接入)
- 每条资讯关联相关商品/部位

---

## 六、对前端提升计划的调整

基于"牧集+AINode"定位,前端提升计划的阶段 0 决策已解决（原计划文档已归档清理）:

### ✅ 阶段 0 决策: **beef-only 聚焦**
- landing/about/pricing 全部统一为**牛肉贸易**叙事
- "108 商品" → "85+ 牛肉部位" (用 landing 现有数字)
- "7 模型" → "6 模型" (统一用 landing 数字) 或核实后统一
- crude_oil/gold 等非牛肉商品从主 IA 移除

### 计划新增任务
| # | 任务 | 阶段 | 状态（2026-08-09 核实） |
|---|------|------|------|
| **新** | 行情总览页重构 (库存计数 → 实时牛肉价格看板) | 阶段 3 | ✅ 已实现（`dashboard/page.tsx:179-225` 三卡 hero：进口均价/国产均价/AI 预测） |
| **新** | AI 预测融入行情行 (每个商品旁显示预测摘要) | 阶段 3 | ✅ 已实现（`beef/page.tsx` 7d Forecast 列 + `CutForecastCell` + `MarketForecastBoard`） |
| **新** | 资讯模块 (market dynamics feed) | 阶段 4 | ✅ 已建（MarketNews model + route + service + 5 页 + 5 条 seed）；⚠️ 外部 RSS 抓取源未接入（M3 待办） |
| **新** | IA 重组: 行情/分析/AI预测/资讯/数据/系统 6 区 | 阶段 2 | ✅ 已实现（`AppShell.tsx:38-83` 6 个 NAV_SECTIONS；⚠️ 资讯/分析顺序与本文档 spec 略有出入，属产品微调） |
| **调整** | dashboard hero = 牛肉均价+涨跌 (非覆盖率) | 阶段 3 | ✅ 已实现（`useDashboardStats.ts:282-334` 真实进口/国产均价聚合） |
| **降级** | trading/portfolio+watchlist → 关注列表 | 阶段 4 | ✅ 已降级（`/trading` 标题为 "Market Intelligence"，`/portfolio` 目录已移除；无交易撮合语义） |

### 优先级不变
阶段 1 (信任修复) 仍是最高 — 假声明/假数据必须先修。阶段 2 (Shell+导航) 次之。
但阶段 3 的"KPI 重构"现在更明确: **牛肉价格看板 + AI 预测融入**,而非泛泛的"覆盖率"。

---

## 七、数据层现状对照 (支撑最终形态的能力)

| 最终形态需要 | 现状 | 差距 |
|-------------|------|------|
| 牛肉价格数据 (进口/国产/部位) | 8 源代码已存在 (abares/cepea/inac/mla/secex/usda_ams/usda_psd/chinaCustomsStats) | ⚠️ 数据冻结 2026-04-30（详见 KNOWN-ISSUES D1：3 个 key 已 set 但源站网络封锁，非缺 key）；CSV 手动导入路径已验证可用（round-81） |
| AI 价格预测 | 6 统计模型 + 3 chronos + Redis 缓存 + MAPE 验证 | ✅ 已具备（chronos MAPE 1.7% 显著优于 stat 3.6%，round-82 accuracy 页已强化展示） |
| 价格走势可视化 | ProfessionalChart (K线+预测叠加) | ✅ 已具备 |
| 多模型共识 | generateForecast | ✅ 已具备 |
| 资讯数据 | ✅ MarketNews model + route + service + 5 页 (2026-07-19) | 已建（5 条 seed）；⚠️ 外部 RSS 抓取源未接入（M3 待办） |
| 实时更新 | ✅ SWR 轮询已开 (30s/15s/60s) + socket.io WebSocket | ✅ 已具备（`app.ts` SocketIOServer + `anomalies.ts` emit + `alertNotifications.ts` WS 通道） |

**结论（2026-08-09 核实）**: M1+M2 阶段（阶段 0-3）**全部已实现**——beef-only 叙事、6 区 IA、dashboard hero 重构、AI 预测融入行情行、WebSocket 实时均已落地。平台地基完成度 **>90%**。唯一硬阻塞是 D1 数据流（网络封锁），可通过 CSV 手动导入绕行。剩余 M3 待办：资讯 RSS 源接入 + 品牌完善。

---

## 八、路线图 (3 个里程碑)

### M1 — 可信的牛肉行情平台 ✅ 已完成（2026-08-09 核实）
- 阶段 1: 删假声明 + 仪表盘真实数据 + 轮询 ✅
- 阶段 2: 应用 Shell + 牛肉聚焦 IA + 移动导航 ✅（`AppShell.tsx` 6 区 NAV_SECTIONS）
- 阶段 0: 统一为 beef-only 叙事 ✅（`Hero.tsx` + `site-stats.ts`，无多品类残留）
- **里程碑达成**: 导航清晰、数据真实、聚焦牛肉的平台

### M2 — AI 预测融入主流程 ✅ 已完成（2026-08-09 核实）
- 阶段 3: 行情总览重构 + AI 预测融入行情行 + 格式化器 + 颜色语义 + KPI 重构 ✅（dashboard 三卡 hero + `CutForecastCell` + `MarketForecastBoard`）
- 数据层: 激活牛肉数据源 ⚠️（受阻于 D1 网络封锁，CSV 手动导入已验证可用）
- **里程碑达成**: 每个牛肉部位价格旁有 AI 预测（`beef/page.tsx` 7d Forecast 列）

### M3 — 完整的资讯+分析平台 (待做)
- 资讯模块 RSS 源接入（后端 model/route/service/页已建，缺外部数据抓取源）
- 阶段 4: 品牌完整 (about 清理 + 社交证明 + signature)
- 产地对比/相关性独立页 ✅ 已存在（`/dashboard/analysis/origin` + `/dashboard/analysis`）
- **里程碑**: 类牧集的完整 数据+分析+资讯+AI预测 平台

---

## 九、明确不做 (最终形态边界)

- ❌ **交易撮合** — 信息平台定位 (CLAUDE.md)
- ❌ **非牛肉商品进主 IA** — crude_oil/gold 等留在数据层,不进导航
- ❌ **用户生成内容/社区** — 不是社交平台
- ❌ **移动端原生 App** — 响应式 web 优先 (牧集有 App 但非必须)
- ❌ **付费墙/订阅** — billing 已降级为静态,AI 分层留待用户基数到
