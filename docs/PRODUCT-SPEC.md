# 产品最终形态 Spec — 牛肉贸易数据 + AI 预测平台

**日期**: 2026-07-12
**定位决策**: 类**牧集网**的牛肉贸易数据收集/展示/分析平台 + 集成类 **IoTDB AINode** 的数据预测功能
**依据**: [牧集网 web.mooket.com](https://web.mooket.com/) + [牧集 App Store](https://apps.apple.com/cn/app/牧集/id1624403418) + 项目 Round 12 AINode 架构

---

## 一、产品定位 (一句话)

> **为中国牛肉产业链上下游提供进口牛肉（外贸市场）价格数据采集、行情展示、多维分析,并以 AI 模型预测未来价格走势的专业平台。**

> **2026-09-06 修订（round-155）**:国产（中国国内市场）维度已**完全删除**——/beef 国产筛选、dashboard 国产均价卡、trend 契约 domestic 字段、27 个 `_cn` 商品序列与 china_wholesale 源全部移除。平台自此只做牛肉外贸市场。

**对标**: 牧集网 (数据+资讯+交易) 的数据/分析层 + IoTDB AINode (预训练模型预测) 的智能层。
**差异化**: 牧集网无 AI 预测;AINode 无行业数据。本项目 = **牧集的数据深度 × AINode 的预测智能**。

---

## 二、牧集网产品形态拆解 (对标基准)

牧集网 (mooket.com) 核心功能:

| 模块 | 牧集网 | 本项目现状 | 差距 |
|------|--------|-----------|------|
| **行情数据** | 进口牛肉/牛副产品价格（国产维度已删除,round-155） | ✅ 有 (7 源: abares/cepea/inac/mla/secex/usda_ams/usda_psd) | 数据源已具备,需激活+补采 |
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
| 行情 > 进口牛肉 | `/beef` | 重命名/聚焦为进口牛肉行情（国产视图已随维度删除,round-155） |
| 行情 > 牛副产品 | `/beef/cuts` | 按部位分类（round-120 起该 URL 为到 `/beef` primal 分组看板的重定向——功能实现于 /beef 页内） |
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

> **修订注记（2026-08-23 round-126 D2）**：第一张 KPI 卡已由"进口均价"（04-30 冻结种子值）换为**全球牛肉价**（IMF 全球牛肉月度基准，FRED PBEEFUSDM，USC/lb）——全站唯一有活数据的牛肉序列；该槽位原挂的 CBBTCUSD 实为 Coinbase 比特币（KNOWN-ISSUES D4）。三卡现为（2026-09-06 round-155 起）：全球牛肉价 / 进口 90CL 周度基准 / AI 7日预测——国产均价卡已随国产维度删除,由进口 90CL（USDA NW_LS421,USD/cwt 周度）接位。
```
┌────────────────────────────────────────────────────┐
│  今日牛肉行情                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 全球牛肉价│ │ 进口90CL │ │ AI 7日预测│           │
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
- "108 商品" → "85+ 牛肉部位" (用 landing 现有数字)（2026-08-21 核正：landing 已无 "85+" 文案；DB 实测 74 部位分类、16 部位有实价，README 已同步——后续文案勿再引用 85+）
- "7 模型" → "6 模型" (统一用 landing 数字) 或核实后统一
- crude_oil/gold 等非牛肉商品从主 IA 移除

### 计划新增任务
| # | 任务 | 阶段 | 状态（2026-08-09 核实） |
|---|------|------|------|
| **新** | 行情总览页重构 (库存计数 → 实时牛肉价格看板) | 阶段 3 | ✅ 已实现（`dashboard/page.tsx:179-225` 三卡 hero；round-126 起第一卡为全球牛肉价，见 §5.1 修订注记） |
| **新** | AI 预测融入行情行 (每个商品旁显示预测摘要) | 阶段 3 | ✅ 已实现（`beef/page.tsx` 7d Forecast 列 + `CutForecastCell` + `MarketForecastBoard`） |
| **新** | 资讯模块 (market dynamics feed) | 阶段 4 | ✅ 已建（MarketNews model + route + service + 5 页 + 5 条 seed）；⚠️ 外部 RSS 抓取源未接入（M3 待办） |
| **新** | IA 重组: 行情/分析/AI预测/资讯/数据/系统 6 区 | 阶段 2 | ✅ 已实现（`AppShell.tsx:38-83` 6 个 NAV_SECTIONS；⚠️ 资讯/分析顺序与本文档 spec 略有出入，属产品微调） |
| **调整** | dashboard hero = 牛肉均价+涨跌 (非覆盖率) | 阶段 3 | ✅ 已实现（真实进口均价聚合；国产侧已随维度删除 round-155） |
| **降级** | trading/portfolio+watchlist → 关注列表 | 阶段 4 | ✅ 已降级（`/trading` 标题为 "Market Intelligence"，`/portfolio` 目录已移除；无交易撮合语义） |

### 优先级不变
阶段 1 (信任修复) 仍是最高 — 假声明/假数据必须先修。阶段 2 (Shell+导航) 次之。
但阶段 3 的"KPI 重构"现在更明确: **牛肉价格看板 + AI 预测融入**,而非泛泛的"覆盖率"。

---

## 七、数据层现状对照 (支撑最终形态的能力)

| 最终形态需要 | 现状 | 差距 |
|-------------|------|------|
| 牛肉价格数据 (进口/国产/部位) | **免 key 活水已开**（2026-08-31 live 实测）：CME 活牛/架子牛 daily（08-28）、beef_90cl_us 进口 90CL weekly（USDA NW_LS421，round-150）、beef_carcass_us / beef_retail_us / pork_world / poultry_world monthly（FRED 免 key CSV，07-01，八月值 mid-Sep 发布属正常节奏）；**冻结面收窄至部位级**——usda_ams（beef_australia 等，2026-04-29）与 mla_nlrs 需 key（详见 KNOWN-ISSUES D1）；爬虫 21 文件/18 注册（chinaCustomsStats 与 chinaWholesale 已退役〔后者随国产维度删除，round-155〕，comtrade_mirror/argentina_exports/usda_import_beef 接入）；CSV 手动导入路径已验证可用（round-81） | ◐ 进口基准与替代蛋白月度已自动化；**部位级 BeefCutPrice 是剩余硬缺口**（key 解阻或 CSV 运营） |
| AI 价格预测 | 6 统计模型 + 3 chronos + Redis 缓存 + MAPE 验证 | ✅ 已具备（~~chronos MAPE 1.7% 显著优于 stat 3.6%~~ **2026-08-23 round-121 取证修订**：~~全时间轴 chronos 均值 46-59%~~（**round-129 口径再修**：46-59% 为 raw 口径，混入 stale 失效行——chronos 30d 窗 16 条 stale 行 avg≈9676% 主导；可引用的 verified-only 口径为 **chronos 全周期均值 7-10% vs naive 3.75%，中位 0.51-0.52 vs 0.33**）、中位数均 <1%——真实故事是"chronos 全面劣于 naive（约 2 倍均值）、被淘汰线清出投票"，详见 COMPETITIVE-ANALYSIS §三.3 v1.1.1 口径修正与 accuracy 页） |
| 价格走势可视化 | ProfessionalChart (K线+预测叠加) | ✅ 已具备 |
| 多模型共识 | generateForecast | ✅ 已具备 |
| 资讯数据 | ✅ MarketNews model + route + service + 4 路由页 + dashboard 资讯条 | ✅ 已接入（M3/round-118）：Beef Central + USDA Federal Register RSS 每 6h 摄取入 market_news，sourceUrl 幂等去重——当前唯一自动更新的外部内容通道 |
| 实时更新 | SWR 轮询 (30s/15s/60s) | ✅ 轮询已具备。~~socket.io WebSocket~~ **已移除（round-112 复核 2026-08-23）**：Socket.IO 服务长期零消费者被整体摘除（`app.ts` 注释、CHANGELOG、TECH-DEBT TD 有据），实时能力现状 = SWR 轮询 only；如需 WS 需重新立项 |
| 进口到岸成本测算（获客工具） | 公开页 `/tools/landing-cost` + 只读端点 `GET /api/tools/landing-cost` | ✅ 已上线（2026-08-30，v3.2.0 批3）：白名单活价（IMF 牛肉基准 USC/lb 月度、CME 活牛/架子牛 USD/cwt 日更、USD/CNY，全部带日期/新鲜度旗标）× 用户自担关税/增值税/运费/损耗参数 → ¥/kg 到岸参考区间；**平台不内置各国税率（不造虚构数据）**，未知量纲拒绝换算、断流诚实降级 |
| 多源数据治理 | `authoritativeSources` 权威源声明 + 写入侧量纲守卫 | ✅ 18 个混源 slug 已声明（2026-08-30 批2）——训练/MAPE 验证/最新价/相关性全链一致取数；写入侧按源 20× 量纲守卫；未声明混源不进方向聚合（provenance 守卫）。明细见 KNOWN-ISSUES R2 |
| 贸易词汇五维（v3.0.0 批 C） | BeefCutPrice metadata 扩 feedingRegime/feedingDays/leanPct/breed/locationPort + CSV 模板扩展 + taxonomy 报盘俗名映射 | ◐ 设计登记未落地——数据解冻（KNOWN-ISSUES D1）即接上 |
| 对华贸易流量层（FOB/CIF 双轨） | `comtrade_mirror`（UN Comtrade 免 key：partner 月度 FOB 镜像 BR/AU/NZ/US + AR/UY 年度回退 + 中国年度 CIF 校准）+ `comext_eu`（Eurostat 免 key：欧盟 IE/NL/FR/PL 月度 **FOB-EUR** 镜像，round-161 双币呈现不合并）+ `argentina_exports`（SSPM ica_carnes 月度 FOB）+ `inac_expo`（INAC eDIAE 乌拉圭官方：对华月度 FOB 金额 + 冻/冷部位族 FOB USD/kg 全球口径，round-162 批 1）落库 MarketFactor；读侧 `GET /api/market/trade-flows`（8 HS 码 + 3 个 Comext CN8 部位级码，USD/EUR 每行币别；CN8 口径 round-162 批 2）+ /beef 对华贸易流卡（round-152 批 0/2/4、round-161 批 1、round-162 批 1/2） | ✅ 已上线：FOB（partner 口径 USD / 欧盟口径 EUR）与 CIF（中国口径）分轨呈现、口径注记随载荷、**绝不合并**；AR 品类×目的国交叉不存在（SSPM 75/77 互补缺口已登记）；到岸成本工具另挂 Drewry WCI 周度海运参照（USD/40ft，round-161 批 2） |

**结论（2026-08-09 核实，2026-08-23 round-120 修订）**: M1+M2 阶段（阶段 0-3）**已实现**——beef-only 叙事、6 区 IA、dashboard hero 重构、AI 预测融入行情行均已落地；~~WebSocket 实时~~（round-112 移除，见上表）。平台地基完成度 **>90%**。唯一硬阻塞是 D1 数据流（网络封锁/key 缺失），可通过 CSV 手动导入绕行。M3 资讯 RSS 已接入（round-118），品牌完善见 M3 清单。

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

### M3 — 完整的资讯+分析平台 (进行中)
- 资讯模块 RSS 源接入 ✅（2026-08-22 round-118：Beef Central + USDA Federal Register 每 6h 拉取入 market_news，sourceUrl 去重幂等，live 首跑 +15 篇）
- 进口到岸成本计算器上线 ✅（2026-08-30 v3.2.0 批3：`/tools/landing-cost` 公开获客工具，与 /beef/forecast 互链——牧集结构性做不了的差异化，活价可溯源、税费用户自担）
- 阶段 4: 品牌完整 (about 清理 + 社交证明 + signature) ◐（2026-08-22：about 方法论口径修正为 Chronos 主力、site-stats 实测数字刷新（19 源）、死按钮清除；社交证明保持"官方数据源可信度"口径，无用户基数前不虚构证言）
- 产地对比/相关性独立页 ✅ 已存在（`/dashboard/analysis/origin` + `/dashboard/analysis`）
- 公开中文行情摘要页 + 每周真数据周报（v3.0.0 批 B）◐ 候选方向未排期——SEO 长尾打法，只做可溯源真数据、不打"分析师洞察"；用户确认优先级后再立项
- **里程碑**: 类牧集的完整 数据+分析+资讯+AI预测 平台

---

## 九、明确不做 (最终形态边界)

- ❌ **交易撮合** — 信息平台定位 (CLAUDE.md)
- ❌ **非牛肉商品进主 IA** — crude_oil/gold 等留在数据层,不进导航
- ❌ **用户生成内容/社区** — 不是社交平台
- ❌ **移动端原生 App** — 响应式 web 优先 (牧集有 App 但非必须)
- ❌ **付费墙/订阅** — billing 已降级为静态,AI 分层留待用户基数到
- ❌ **国产（中国国内市场）维度** — 2026-09-06 round-155 完全删除（产品只做牛肉外贸市场）：国产筛选/国产均价卡/`_cn` 序列/china_wholesale 源全部移除,不再回归
