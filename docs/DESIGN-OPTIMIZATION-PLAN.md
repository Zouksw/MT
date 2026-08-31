# 前端界面美学优化计划（DESIGN-OPTIMIZATION-PLAN）

> 版本 v1.0.0 · 2026-08-31
> 方法：live 生产前端截图评估（14 张，桌面 1440×900 + 移动 390×844，含登录态）+ 静态 token 扫描（design-review 方法论）+ 世界级产品设计实现调研（Linear / Vercel Geist / TradingView / Mercury-Stripe-Ramp 拆解）。
> 证据基线：`/tmp/design_audit/*.png`（易失目录，复现命令见附录 A）。
> 关系：本文档不推翻 [`DESIGN.md`](DESIGN.md) 的 "Refined Industrial" 方向与 [`DESIGN-SYSTEM-AUDIT.md`](DESIGN-SYSTEM-AUDIT.md) §七 "设计方向正确，勿改" 的结论；它处理的是**系统层之上的体验层差距**。

---

## 一、总体判定

**系统层已是高水平，差距在"最后一公里"的体验层。**

| 层 | 现状 | 判定 |
|---|---|---|
| Token 体系 | oklch 双主题、语义色、`--panel` 三级海拔、machined 卡片阴影（round-107）、tabular-nums + mono eyebrow | ✅ 世界级做法已在（Linear 式 LCH 分层、Geist 式 shadow-as-border） |
| 字体 | Geist Sans + Geist Mono（Vercel 同款），8 级字阶，权重纪律 400-600 | ✅ 达标 |
| 色彩语义 | 金 = AI 智能签名色（round-76 定案） | ✅ 方向正确；❌ 执行有漏洞（见 §二.2 蓝 22 处） |
| **版面编排** | trading 页下半区单窄列、约 50% 宽度浪费；beef hub 表格无降噪 | ❌ **最大差距** |
| **空态设计** | dashboard/alerts/beef hub 多处大黑空盒；全 0 KPI 卡 | ❌ 优秀产品与模板的分水岭就在这 |
| **图表可读性** | accuracy 趋势图被 280% MAPE 离群值压扁（R5 的可视化后果） | ❌ 数据侧问题在前端的显性伤口 |
| **语言一致性** | 侧栏中文 + 页面标题英文/中文混杂（dashboard EN vs forecast CN） | ❌ 打磨感缺失 |
| **签名时刻** | 营销页 hero 金渐变（round-107）✅；产品内页缺同等级时刻 | ⚠️ 部分 |

一句话：**对标 Linear 的 token 纪律已就位；对标 TradingView 的版面密度编排、对标 Mercury/Stripe 的空态与信任细节，还差一个执行批次。**

---

## 二、现状评估（截图证据）

### 2.1 版面编排（严重度最高）

- **/trading**：图表区专业（lightweight-charts + SMA/支撑/压力标注，是全站最强视觉资产），但图表以下 `CommodityInfoCard` 与 `PriceForecastPanel` 各占约 370px 窄列依次下排，右侧约 50% 宽度为纯黑空白；`价格预测` 卡内 7 个信息块挤在窄列里，形成长滚动。对照 TradingView 面板架构（上工具栏 / 图表主体 / 右侧详情面板 / 底部面板），本页信息密度编排明显未达标。
  - 证据：`/tmp/design_audit/trading.png`
- **/dashboard**：`Alert Distribution`（空态时为一个巨大空卡 + 居中小对勾）与 `Recent Activity` 占据首屏下方近一半面积却几乎无信息；`AI Price Models` 卡的金点串 + 全宽金条无语义（看不出编码什么）。
  - 证据：`dashboard.png`
- **/alerts**：4 张全 0 KPI 卡 + 一条空态文案后，页面剩约 400px 纯黑。
  - 证据：`alerts.png`
- **/beef**：数据密度本身优秀（50+ 行 cut 表），但顶部琥珀色诚实公告为整段小字墙（3 行长句），表格 `7d FORECAST` 列全部为 `--`、`PROVENANCE` 列全部红色 `● Snapped`——死列 + 满屏红点构成视觉噪音（数据冻结期的诚实呈现，但呈现方式可分级降噪）。
  - 证据：`beef_hub.png`

### 2.2 色彩纪律

- **22 处 `blue-*` 原始类分布在 7 个文件**（`components/ui/Alert.tsx`、`ui/Tag.tsx`、`ui/Badge/index.tsx`、`trading/DataSourcePanel.tsx`、`trading/MarketFactorsPanel.tsx`、`beef/ImportResultTable.tsx`、`app/settings/data-sources/page.tsx`），绕过了 `--info`（oklch hue 84 金族，round-76 已定案"金为权威"）直接渲染蓝色——alerts 页空态横幅、market-news 的类别 pill（Trade Policy/Insight 蓝色胶囊）是最显眼的两处。
  - 复测命令：`grep -rnoE '\b(blue|sky|indigo|cyan)-[0-9]{2,3}\b' frontend/src/`
- 任意 hex 仅 3 处（`#A8821C` ×2、`#E3C566` ×1，均为既定亮金变体，TD-12b 已记档）——原始 hex 纪律良好。
- `text-gray-400`（2.85:1，低于 AA）仍有 16 处文本用途——DESIGN-SYSTEM-AUDIT P0 项，**遗留未清**（plan 外但应并入执行）。

### 2.3 感知 bug 级

- **移动端 /trading 图表横向溢出**：390px 视口下 K 线图被裁切（右缘价格刻度出屏）；`ModelConsensusTable` 列亦被裁。桌面 `overflow-x-auto` 包裹（`app/trading/page.tsx:336/420`）在移动端对图表容器不生效或尺寸未约束。
  - 证据：`m_trading.png`
- **/market-news 类别 pill 与标题重叠**：`Trade Policy`/`Insight` 蓝胶囊叠压在标题文字上（如 "Bulk-Power Sys▓stem Policy"）。证据：`market_news.png`。
- `/accuracy` 的 `Overall Accuracy 0.8`（无单位无刻度说明）+ `+99%` 徽标语义不明；趋势图 y 轴到 280%，全部曲线被压成贴地直线——单离群值（holtwinters 273.66%，KNOWN-ISSUES R5）毁掉整张图的可读性。
- `/market-news`：`Views` 列全 0（死列）；4 行 `[No title available]`（KNOWN-ISSUES D5 的 UI 显影）。

### 2.4 语言一致性

侧栏全中文；页面标题：dashboard=英文、trading=英文+中文副题、accuracy/alerts/news=英文、forecast/landing-cost=中文。卡片头同样混杂（`热门部位价格` 表头却是 `Cut / 产地 / 7d Forecast`）。结论：**无成文规则**，各页随实现者当时语感漂移。对中文牛肉贸易从业者为目标用户的产品，这是显性的"未完成感"来源。

### 2.5 值得保留的强项（优化时不得破坏）

- /beef/forecast 是全站美学最佳页：诚实验证时间线、backtest 表 + "Reading:" 注解、追溯来源卡——把"诚实"做成了设计语言，与 PRODUCT-SPEC 的数据可信定位一致。
- /tools/landing-cost 的双栏计算器 + 低/中/高三档卡 + 逐项拆解，密度与层级均达标。
- /login 品牌分屏（"74 beef cuts. / 9 AI models. / One signal." 金色点题）。
- 营销页 bento 特性格 + 编号步骤 + FAQ，完成度高（注意其 CTA 按钮是黑白系，与产品内金色主按钮并存——见 §四.6）。

---

## 三、参照系：知名网站的设计实现思路（调研摘要）

### Linear（linear.app/now/how-we-redesigned-the-linear-ui）

1. **LCH 感知均匀色域生成主题**：主题从 98 个变量收敛为 3 个输入（基色 / 强调色 / **对比度**），对比度本身是一个可调参数，可一键生成高对比主题。
   → 对 MT 的启示：我们已用 oklch（同一思想）；差距不在色彩空间而在**把对比度当作一等参数**的意识——具体化为：文本层级用 `--muted-foreground` 的 3 档明度阶梯，而不是 16 处裸 `text-gray-400`。
2. **"inverted L-shape" 全局 chrome**：侧栏 + 顶栏构成 L 形框架，内容区是舞台；标签/图标/按钮在侧栏内垂直水平双对齐。
   → MT 的侧栏分组已是此结构；缺的是内容区对"舞台"的使用（trading 下半区浪费）。
3. **先用黑白透明度设计海拔，再上色**：所有层级关系在无色状态下成立。
   → 这解释了为何 machined 卡片（round-107）方向正确，但空盒卡片仍显空——海拔有了，**内容编排**没跟上。
4. Inter Display 用于标题制造表情 → MT 用 Geist 全家桶是等效做法，保留。

### Vercel Geist（vercel.com/geist）

1. **暗色为规范画布，亮色是变体**——与 MT dark-first 一致，无需改。
2. **极简即工程原则：shadow-as-border**（round-107 已采纳同款）。
3. **图表必须色盲友好 + 用 APCA 校验对比**：MT 图表红绿蜡烛依赖色相区分，应补形状/虚线冗余编码（lightweight-charts 可配）；`text-gray-400` 类问题应按对比度阶梯治理。
4. 值标注、whisker、tooltip 的信息密度规范值得在图表批中对照。

### TradingView（charting-library-docs UI Elements + RonDesignLab 案例研究）

1. **面板架构**：上工具栏 / 左绘图工具 / 右详情面板（watchlist、symbol info）/ 底部面板——图表永远是最大单元格，详情永远在右侧触手可及。
   → /trading 的直接药方：`CommodityInfoCard` + `PriceForecastPanel` 移到图表右侧或紧下方双列，废除窄列纵排。
2. **暗色主题的存在理由 = 长时间盯盘 + 突出价格红绿**——MT 受众（贸易商盯盘）相同，验证了 dark-first。
3. 快捷键与布局持久化是"专业感"来源（后续项，非本计划范围）。

### Fintech 仪表盘拆解（Mercury / Stripe / Ramp——adminlte.io 与 themasterly.com 两篇 teardown）

1. **KPI 层级**：一屏最多 4-6 个 KPI，主 KPI 大号 tabular 数字 + 单位 + 环比，次级收进卡内——MT 的 StatCard 结构已对齐，但 `Overall Accuracy 0.8`（无单位）与全 0 卡说明**数据语义层**没守住。
2. **空态即产品**：Mercury/Stripe 的空态带图形、一句解释、一个行动入口，从不留黑盒。
3. **信任细节**：数据时间戳、来源标注、异常提示的排版一致性 = fintech 产品的核心视觉资产——MT 的 `Data Provenance` / `验证时间线` 已是这个思路，应复制到更多页面。

---

## 四、优化计划（分批，每批独立 commit + 验证）

> 原则：不改设计方向（gold authority / dark-first / machined surfaces 维持）；每批外科手术式；先修"感知 bug"，再修"编排"，最后"签名"。预估工作量为 AI 执行批次粒度，非人日。

### 批 A — 感知 bug 修复（P0，可全自动，先行）

| # | 项 | 位置 | 做法 |
|---|---|---|---|
| A1 | 移动端 trading 图表溢出 | `components/trading/ProfessionalChart.tsx` / `MultiSourceChart.tsx` + `app/trading/page.tsx` | 容器加 `min-w-0`/`w-full` 约束 + resize observer 已有则查断点；390px 验收截图 |
| A2 | market-news pill 压标题 | market-news 列表行组件（定位 `app/market-news/page.tsx` 及其行组件） | pill 改为流内 flex 布局或去掉负 margin/绝对定位；桌面+移动截图验收 |
| A3 | accuracy KPI 语义 | `app/ai/accuracy/page.tsx` + StatCard 用点 | `0.8` → 带刻度说明（如 `80% 方向命中`或标注 MAPE 中位数 + 单位）；`+99%` 徽标改中性说明 |
| A4 | accuracy 趋势图离群值压扁 | accuracy 趋势图组件 | 前端显示侧 winsorize/截断 y 轴（如 95 分位封顶 + 离群点标注"273%（超出刻度）"）；**不改后端指标**（R5 仍留 owner 决策） |
| A5 | 死列处理规则 | market-news `Views` 列、beef hub `7d FORECAST` 列 | 全 0/全 `--` 列隐藏或降级为 tooltip；规则成文于 DESIGN.md |

验收：tsc + Jest + build + PM2 + Playwright 390px/1440px 截图 + judge 视觉验收。

### 批 B — 版面编排（P1，最大美学收益）

| # | 项 | 做法 | 参照 |
|---|---|---|---|
| B1 | /trading 下半区双列编排 | `lg:` 断点起 `CommodityInfoCard` + `PriceForecastPanel` 并排（`grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]` 之类），`MarketFactorsPanel` + `DataSourcePanel` 并排；预测卡内 7 块改 2 列分区 | TradingView 右详情面板 |
| B2 | dashboard 空态设计 | 空态组件：图形 + 一句话 + 行动入口（"0 条告警 — 设置告警规则 →"）；`AI Price Models` 金条改语义化（9 模型徽标行，去掉无编码的全宽条） | Mercury/Stripe 空态 |
| B3 | /alerts 页填充 | 空态区加引导卡（最近 3 条预测快讯 / 告警规则入口），消除 400px 黑洞 | 同上 |
| B4 | beef hub 降噪 | 琥珀公告收敛为首行 + "展开详情"；`● Snapped` 降为灰色 dot + tooltip，仅在悬浮/详情强调红 | Linear "reduce visual noise" |

### 批 C — 色彩纪律收口（P1）

| # | 项 | 做法 |
|---|---|---|
| C1 | 22 处 `blue-*` → 语义 token | `Alert/Tag/Badge` 的 info 变体改 `text-info/bg-info/10/border-info/20`（金族，round-76 补漏）；`DataSourcePanel/MarketFactorsPanel/ImportResultTable/data-sources` 同规则 |
| C2 | `text-gray-400` 16 处 → `text-muted-foreground`/`gray-500` | DESIGN-SYSTEM-AUDIT P0 遗留清零（顺带，属同一纪律批） |

### 批 D — 语言一致性（P2，需先定规则再批量执行）

规则提案（执行前需用户确认，涉及产品语言决策）：**chrome 与页面标题统一中文，数据值/专有名词/模型名保留英文**。涉及：dashboard/trading/accuracy/alerts/market-news 等 ~10 页标题与卡头、表头混排（`部位 Cut` → `部位`）。

### 批 E — 签名时刻（P2，克制）

- 登录后首屏（dashboard）顶部加一条 1px 金线 + `--panel` 海拔的"行情条"（全局 ticker：全球基准 / 上游期货 / 汇率三数并排，复用现有数据），把 round-107 的 hero 金渐变语言带进产品。
- 营销页 CTA 按钮统一为金色主按钮（当前页面内金色 hero CTA 与黑白底部 CTA 并存）。

### 明确不做（延续既有决策）

- 不改金色权威方向、不做三源 token 大迁移（TD-12 架构项仍留 v4 迁移批）。
- 不重写 `ProfessionalChart` 长配置（audit §七 既定）。
- 不动后端 MAPE 指标（R5 留 owner）；不补新闻标题数据（D5 留 owner）——本计划只处理其**前端呈现**。
- 批 D 语言规则未确认前不批量改文案。

---

## 五、验证与回归方案

每批固定：`cd frontend && npx tsc --noEmit && pnpm test` → `pnpm build && pm2 restart mt-frontend` → Playwright 截图（附录 A 命令）→ judge 子代理视觉验收 → 独立 commit。测试基线 354 不回退。

## 附录 A：证据复现

```bash
# 截图（脚本内含 admin 登录，种子凭据仅本地测试用）
python3 /tmp/design_audit/capture.py    # 14 张：11 桌面 + 3 移动
python3 /tmp/design_audit/capture2.py   # 滚动触发的 /landing 全景 + 未登录 /login
# 蓝色漂移复测
grep -rnoE '\b(blue|sky|indigo|cyan)-[0-9]{2,3}\b' frontend/src/
```

## 附录 B：参照来源

- Linear：[How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Vercel：[Geist 设计系统](https://vercel.com/geist/introduction)、[DesignSystems.one 评述](https://www.designsystems.one/design-systems/vercel-geist)
- TradingView：[UI Elements 文档](https://www.tradingview.com/charting-library-docs/latest/ui_elements/)、[RonDesignLab 案例研究](https://rondesignlab.com/cases/tradingview-platform-for-traders)
- Fintech 拆解：[9 Real Products Analyzed（Mercury/Stripe/Ramp/Wise/Revolut）](https://adminlte.io/blog/fintech-dashboard-design-examples/)、[Ramp/Mercury/Stripe Patterns](https://www.themasterly.com/blog/fintech-dashboard-design-guide)
- 本仓基线：`docs/DESIGN.md`、`docs/DESIGN-SYSTEM-AUDIT.md`（2026-08-07）
