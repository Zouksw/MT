---
title: "牛肉外贸数据规模/密度评估——对标牧集的取数决策"
en_title: "Data Scale & Density Evaluation: Sourcing Beef Foreign-Trade Information (Mooket Benchmark)"
version: "1.1.0"
last_updated: "2026-09-06"
status: "active"
maintainer: "MT Team"
tags:
  - research
  - data-sources
  - product-strategy
target_audience: "Maintainer, Product decisions"
related_docs:
  - "Competitive Analysis Mooket": "COMPETITIVE-ANALYSIS-MOOKET.md"
  - "Info Landscape": "RESEARCH-BEEF-INFO-LANDSCAPE.md"
  - "Trade Data Sources": "RESEARCH-BEEF-TRADE-DATA-SOURCES.md"
  - "Known Issues D1": "KNOWN-ISSUES.md"
---

# 牛肉外贸数据规模/密度评估——对标牧集的取数决策（round-157）

> **2026-09-06**。回答一个问题：**要实现和牧集网类似的数据规模和数据密度，牛肉外贸的相关信息应该从哪里获取？**
>
> 与既有文档的分工：[COMPETITIVE-ANALYSIS-MOOKET.md](COMPETITIVE-ANALYSIS-MOOKET.md)（CA）与 [RESEARCH-BEEF-INFO-LANDSCAPE.md](RESEARCH-BEEF-INFO-LANDSCAPE.md)（Landscape，17 家供给全景）回答"牧集有什么、MT 差多少"；[RESEARCH-BEEF-TRADE-DATA-SOURCES.md](RESEARCH-BEEF-TRADE-DATA-SOURCES.md)（TradeSources，2026-08-31）回答"贸易数据从哪取"并给出 P0-P2 路线。**本文是 TradeSources 落地一周后的复盘视角**：①牧集密度的分层拆解（规模/密度到底指什么）；②MT 数据层 2026-09-06 全量实测基线；③一周内源站环境的四项新变化（其中一项是**正在断供的线上回归**）；④逐层"从哪里获取"的取数决策更新。
>
> 证据分级沿用 Landscape 约定：**【实测】**=2026-09-06 一手 curl/psql；**【转述】**=网页检索口径。未标处默认【实测】。

---

## 一、结论速览（TL;DR）

1. **牧集的"密度"是三层叠加，只有两层有公开源**：现货日更层（凌晨发布进口牛肉日报：件套/分部位 × 市场/港口，人工行情员采集 + 用户报盘）、统计月更层（海关量价、输华工厂动态）、工具参照层（准入工厂/税率/冷库/成本计算）。**现货日更层没有任何公开可编程源**——牧集/必孚本身是付费/会员终端，爬取既违反其 ToS 也违反本仓合规红线（Landscape §7.4）。这一层的规模只能来自运营人工录入（通道已有）或商业采购（预算决策），不是爬虫问题。
2. **MT 现状实测（2026-09-06）**：18 个在册源只有 **5 个真正产数**（fred / cme / exchange_rate / argentina_exports / comtrade_mirror）；牛肉外贸真正新鲜的序列只有 Comtrade 镜像（6 通道 × 8 HS 月度，最新 2026-07）、阿根廷 FOB（月度 t-2，2026-06）、CME 期货（日度，09-04）。**部位级价格整表 2,401 行冻结在 2026-04-30**；weekly_kills / cold_storage 表在但**无任何在册写入者**（停在 05-08 / 04-30）。
3. **新回归【实测】：USDA AMS 的 mnreports 报告族已迁 eWAPS 平台**——`ams.usda.gov/mnreports/ams_2823.pdf`（usda_import_beef 的 90CL 周度源，round-155 批 D 刚上 dashboard 卡）现返回 eWAPS 门户 HTML 而非 PDF；该源 09-06 连续三次 warning 0/0，digest 的 beef_90cl_us 卡停在 2026-08-28 单点。**这是当前唯一在断供的已落地源，修复优先级最高。**
4. **INAC 复活信号【实测】**：TradeSources 08-31 判"全球性下线"已过时——`www.inac.uy` 根域今日 200（旧域 `inac.gub.uy` SSL 已死），但 `/estadisticas/*` 404、DIAE 页为壳，统计新入口待勘察。乌拉圭周度数据存在低成本复活路径。
5. **最高 ROI 仍是两个 key 门（用户动作，代码端到端就绪）**：`MLA_API_KEY`（恢复 mla_nlrs 的 1,440 行级部位价 + EYCI/OTH）、`USDA_MARS_API_KEY`（LM_XB405 美国部位级；注意 marsapi 直连 000、需走 mihomo 代理出口，round-80 口径）。
6. 中国官方口径维持 TradeSources 结论不变（stats.customs.gov.cn 今日文章页 412 反爬复现；月度节奏已由 Comtrade 镜像承接）；IPCVA 官网 2026-04 改版后 sitemap 已无价格区（降级为 P2）；ComexStat 403 复现（Cloudflare，镜像已替代，不再必要）。
7. **增补批（同日晚）——政府官方 API 扩容实测**：新验证 4 个可用官方接口（USDA NASS QuickStats 屠宰/冻肉库存、USDA FAS 网关、巴西 IBGE SIDRA 季度屠宰 API、巴西 MAPA 工厂名录宿主），加上已在库的 Comtrade/CKAN/FRED——**必孚型"统计+名录"面的政府数据流版基本可构建**（含到岸成本组合推导、税率/成本计算工具面）；牧集型"现货日报"面确认无任何政府数据源；**api.usda.gov（MARS）经直连+代理双通道均 000**，对 §四.1 eWAPS 修复路径 B 是新的环境限制。详见 §八。

---

## 二、牧集基准：规模与密度到底指什么

### 2.1 牧集（mooket.com，Muji Network Technology (Shanghai)）

【转述+实测混合，2026-09-06 采集】

| 模块 | 证据 | 密度特征 |
|---|---|---|
| **进口牛肉日报** | 官网快照（搜索缓存）："进口牛肉日报：今日MF件套市场价格微涨，天津金福临市场成交量较好 2026.9.3 · 03:49" | **日更（凌晨发布）**；件套（按集装箱整套计价的报价单位）+ 分部位 × 市场/港口（天津金福临、上海江桥等）；附成交动态 |
| 贸讯简报 / 猪肉日报 | 同上快照（"牧集贸讯简报 2026.09.4 · 03:48"、"猪肉日报…"） | 日更资讯层 |
| 报盘 / 求购 | App Store 描述："市场：海量报盘和求购" | UGC 实时流（B2B 用户发盘，含国家×厂号×现货/期货维度，CA §8.3） |
| 准入工厂查询 | App 2.11.0（2024-03-29）："新增准入工厂查询，支持查询输华工厂的准入情况" | 输华工厂名录 + 状态动态（事件驱动） |
| 税率查询 | App 2.12.0（2024-04-18）："新增税率查询功能" | 静态参照层 |
| 冷库认证 / 成本计算 | App 2.10.3（冷库详情）、2.9.1（"成本计算，增加仓储、垫资等成本项"） | 工具参照层 |
| 社交 / 情报 | App 定位语："社交/情报/市场/发现"四模块；"行业交互中心，百万用户的专业级应用" | 用户规模口径为 App 自述【转述】 |

牧集具体每日价格条数无公开数字（SPA 无静态内容，付费墙内），**外部可计量的密度特征 = 现货层日更 × 部位 × 市场**。

### 2.2 必孚（Beef to China，beeftochina.com.cn）——数据终端型对标

【转述】订阅制终端，核心数据面：中国牛肉进口量价（分去骨/带骨、来源国、均价）、输华工厂名录动态、港口库存、年度报告。2024 年数据口径（必孚年度报告 2025 数据版）：去骨牛肉进口 234.2 万吨（-4.3 万吨）、均价 +$606 → **$5,826/吨**；带骨近 46 万吨。

### 2.3 密度分层结论

牧集级"数据规模 + 密度" = 三层之积：

- **L-D 现货日更层**（件套/部位 × 市场，日更）：**无公开源**，人工采集 + UGC 构成；
- **L-A 统计层**（海关量价月更、工厂准入事件驱动）：公开源可覆盖大部分（Comtrade/各国官方）；
- **工具参照层**（税率/冷库/成本）：静态维护 + 名单页爬取。

---

## 三、MT 数据层现状实测（2026-09-06 基线）

psql mt_db 全量实测（Explore 代理执行，同日）：

**表总行数**：commodity_prices 66,560 | market_factors 1,391 | beef_cut_prices 2,401 | market_news 166 | weekly_kills 190 | cold_storage 38 | factories 21 | beef_cut_taxonomy 75。

| 层 | source | 行数 | 新鲜度（实测） | 状态 |
|---|---|---|---|---|
| 宏观/期货 | fred | 63,477（22 符号，占全表 95%） | 至 2026-09-01（近 7 天 +4） | ✅ 活（含历史回填） |
| 期货 | cme | 221（14 符号） | **日度至 2026-09-04** | ✅ 活 |
| 汇率 | exchange_rate_api | 225（3 对） | 日度至 2026-09-05 | ✅ 活 |
| 贸易流量价 | comtrade_mirror | 922（6 通道 × 8 HS × 37 个月 + 中国年度 CIF 38 行） | **月度至 2026-07** | ✅ 活（牛肉外贸最新鲜的源） |
| 阿根廷出口 | argentina_exports | 34 | 月度至 2026-06（t-2 正常） | ✅ 活 |
| 90CL 周度 | usda_import_beef | **1** | 2026-08-28 后**断供**（见 §四.1） | ⚠️ 回归中 |
| 部位级价格 | mla_nlrs + cepea_export | 1,440 + 960（16 cuts × 3+2 厂） | **整表冻结 2026-04-30** | ❌ key/反爬门 |
| 美国行情 | usda_ams | 2,596 | 冻结 2026-04-29 | ❌ key 门 |
| Pink Sheet | world_bank | 40 | 停更 2026-06-01 | ⚠️ 待复核 |
| 屠宰 | weekly_kills（无在册源） | 190（5 国 × 38 周） | 停 2026-05-08 | ❌ 无写入者 |
| 库存 | cold_storage（无在册源） | 38（5 国） | 停 2026-04-30 | ❌ 无写入者 |
| 资讯 | RSS（Beef Central 等） | 166 | 持续 | ✅ 活 |

**18 在册源产数仅 5**；摄取全部由 server.ts 进程内定时驱动（HOURLY×1 / 6h×7 / DAILY×10），无数据类 cron。

---

## 四、一周内源站环境四项新变化（2026-09-06 实测）

### 4.1 USDA mnreports → eWAPS 迁移（**线上回归，P0**）

- `https://www.ams.usda.gov/mnreports/ams_2823.pdf` → 302 → **HTTP 200 但返回 1341B 的 "eWAPS Platform Portal" HTML**（附维护公告 "RKE HA Production upgrade"）；`nw_ls421.txt` 同样命中。
- 受害链：`usda_import_beef`（90CL 周度）→ digest `beef_90cl_us` 卡（round-155 批 D 的 dashboard hero 第二卡）→ 前端 90CL 周度基准。ingestion_logs：09-06 13:21 / 11:58 / 11:48 均 **warning 0/0**；digest live 值 = 2026-08-28 close 348（全表唯一行）。
- 修复三选一（按优先序）：① 勘察 eWAPS 新报告端点（`search.ams.usda.gov` 本机 TLS 失败，需经 mihomo 代理再探）；② USDA MARS API key（`USDA_MARS_API_KEY`，data.gov 免费注册体系；与 usda_ams 同 key，一次注册两源受益）；③ LMR DataMart（`mpr.datamart.ams.usda.gov` 今日 500，待复核是否瞬时故障）。
- **注意**：usda_ams（LM_XB405 部位级）若走 mnreports 通道也受同样影响；走 MARS API 通道则只差 key。

### 4.2 INAC 域名复活（P1 勘察项）

- 旧域 `www.inac.gub.uy` SSL 握手失败（= 08-31 判死原因）；**新域 `www.inac.uy` 今日 HTTP 200**（61KB）。
- 但 `/estadisticas`、`/estadisticas/exportaciones.html`（旧爬虫端点）均 404；`/inac/diae/`（统计部门页）是 2.9KB 壳；根页可见 Liferay innovaportal 文件存储仍在服务（如 `inac_anuario_2025_web-esp.pdf` 年鉴）。
- 国家开放数据目录 `catalogodatos.gub.uy/organization/inac` 404（组织 slug 变更或下线），`/dataset?q=faena` 检索页可达但为前端渲染。
- 结论：**乌拉圭通道存在低成本复活路径，但需要一次人工页面勘察**定位新统计入口（或以 Anuario 年鉴 PDF + 周报通讯作过渡）。

### 4.3 IPCVA 改版（降级 P2）

`ipcva.com.ar` 2026-04 重建为 Next.js 站（今日 200）；sitemap 仅 17 个机构/资料页，**无价格数据区**；`/precios` 路径 404。周度出口部位价（outline）若仍发布，藏在前端接口里——价值/成本比下降，降为 P2（阿根廷月度已有 SSPM FOB 活源 + Comtrade 年度校准覆盖）。

### 4.4 封锁复现（结论不变）

- `customs.gov.cn` 文章页今日 **412**（JS 挑战 meta）——中国官方站点反爬口径成立（TradeSources §三矩阵不变）。
- `comexstat.mdic.gov.br` 今日 **403**（Cloudflare WAF）——维持"镜像已替代，不再必要"。
- stooq `/q/l/` 404——与 round-63 已知口径一致（端点已删 + JS PoW），期货通道继续走 cme 源（FRED CSV + Yahoo，活）。

---

## 五、逐层取数决策（"从哪里获取"的直接回答）

| 层（牧集对应物） | 从哪里获取 | MT 现状 | 动作 |
|---|---|---|---|
| **现货日更层**（进口牛肉日报：件套/部位×市场） | **无公开可编程源**。牧集/必孚=付费终端（爬取违反 ToS + 本仓红线）。两条真实路径：① 运营例行人工录入——`POST /api/beef/import` + [WEEKLY-DATA-IMPORT runbook](guides/WEEKLY-DATA-IMPORT.md)（现役唯一通道，已解锁新鲜度→预测→MAPE 全环）；② 商业采购（必孚企业合同 / Volza $1,500 起 / 环球慧思 ¥4-5 万 / 腾道 ¥5-10 万 每年档，TradeSources §4.6【转述】） | 0（通道在、无例行运营） | **运营/预算决策项**（非技术）。UGC 报盘不做（PRODUCT-SPEC §九红线） |
| **量价统计层**（海关量价月度） | UN Comtrade 公共预览 API（免 key）：出口国镜像 BR t-1 / AU·NZ·US t-2 × HS 0201/0202/0202.20/0202.30/0206 族 × partner=CN + 中国年度 CIF 校准 | ✅ 已落地（922 行，最新 2026-07） | 主力维持；扩展项：月度回扫深度、AR 年度校准行 |
| **中国官方口径** | 条件路径不变：中国出口节点 / 人工月度 CSV 导出（stats.customs.gov.cn 412 复现） | 镜像承接中 | 维持（TradeSources §4.2 三选项） |
| **乌拉圭月度/周度** | INAC 新站（已活，入口待勘察）；兜底 Comtrade UY 年度 | 0（08-31 判死已过时） | **P1 勘察** |
| **部位级/国际行情层** | MLA MyMarketInfo（EYCI/OTH 网格 + 出口部位 FOB，`MLA_API_KEY`）；USDA MARS（LM_XB405 + 5-area，`USDA_MARS_API_KEY`，需代理出口）；eWAPS（90CL，修复中）；CEPEA（Cloudflare，需 headless） | mla_nlrs 1,440 + cepea 960 + usda_ams 2,596 全冻结（key/反爬门）；90CL 断供 | **P0：两个 key 注册（用户动作）+ eWAPS 修复（开发）**；CEPEA 缓（P2） |
| **期货层** | CME via FRED CSV + Yahoo（活，14 符号日度）；DCE 死（412 反爬，维持退役口径） | ✅ 活至 09-04 | 维持 |
| **屠宰/库存层**（weekly_kills/cold_storage） | MLA 周屠宰（随 MLA key）；USDA NASS Livestock Slaughter；ABIEC/CICCRA 月报 PDF（半自动） | 表在、**无在册写入者**，停 05-08/04-30 | P1（随 MLA key 顺带接入 MLA 侧；PDF 类半自动） |
| **名单/工具层**（准入工厂/税率/冷库） | 单一窗口注册查询（页面可达、查询需实名会话；ToS 灰色→低频半自动）；SENASA Mercados Abiertos（代理可达）；税率=公告静态维护；冷库名录无公开源 | Factory 21 家静态 seed | P1（单一窗口需用户注册账号）；税率表静态维护即可 |
| **宏观/物流因子** | FRED 免 key CSV（活）；openweathermap（key 空串，免费档）；baltic（FRED key 可选）；SCFI/WCI 航运（公开头条数，P2）；world_bank 停更 06-01 待复核 | fred 活；weather/baltic/shipping 0 行 | P2 补漏 |

---

## 六、优先级路线（对 TradeSources §六 的复盘更新）

**P0（本周粒度）**
1. **eWAPS 修复**（§四.1 三选一）——唯一在断供的已落地源，dashboard 90CL 卡裸奔中。
2. **注册 `MLA_API_KEY` + `USDA_MARS_API_KEY`**（用户动作；后者兼作 eWAPS 的 B 方案）——两个端到端就绪的源（部位级 ~4,000 行存量 + 周刷新）只差 key。

**P1**
3. INAC 新入口勘察（域名已活）→ 复活乌拉圭周度/月度。
4. 屠宰层接入（MLA 周屠宰随 key 顺带；ABIEC/CICCRA 月报 PDF 半自动）。
5. 单一窗口厂号快照（需实名账号，低频半自动，ToS 复核先行）。
6. world_bank 停更根因复核（06-01 后 FRED Pink Sheet 序列是否断发）。

**P2**：CEPEA headless、FAS GATS HS10（免费 key）、SCFI/WCI 航运指数、IPCVA 前端接口勘察、商业提单库试用（预算决策）。

**不做清单**（沿用 + 复核成立）：爬牧集/必孚付费墙；UGC 报盘；硬闯 stats.customs.gov.cn（412 复现）；ComexStat 代理绕行（镜像已替）；新发地国产线（D22 随国产维度关闭，round-155）。

**密度结论**：P0 全落地后，MT 的"统计层月度 + 国际行情日度/周度 + 部位级周度"密度可与牧集的公开可比面对齐（牧集对外可计量的强项本来就是现货日报，其规模口径无法从外部验证）；**现货日更层的差距是运营/商业问题，公开源不存在**——诚实的说法是"用人工录入通道 + 国际基准密度补足，而非伪造爬取"。

---

## 七、附录：今日取证命令（2026-09-06，可复现）

```bash
# USDA eWAPS 回归（302 → 门户 HTML 而非 PDF/TXT）
curl -sSL -A "$UA" -o /tmp/usda2823.pdf -w '%{http_code} %{url_effective}\n' \
  'https://www.ams.usda.gov/mnreports/ams_2823.pdf'        # 200 + eWAPS HTML (1341B)
curl -sS -o /dev/null -w '%{http_code}\n' 'https://mpr.datamart.ams.usda.gov/'   # 500
# INAC 域名迁移
curl -sS -o /dev/null -w '%{http_code}\n' 'https://www.inac.uy/'                 # 200
curl -sS -o /dev/null -w '%{http_code}\n' 'https://www.inac.gub.uy/estadisticas/exportaciones.html'  # SSL eof
curl -sS -o /dev/null -w '%{http_code}\n' 'https://www.inac.uy/estadisticas'     # 404
# IPCVA 改版
curl -sS 'https://ipcva.com.ar/sitemap.xml' | grep -c '<loc>'                    # 17（无价格区）
# 封锁复现
curl -sS -o /dev/null -w '%{http_code}\n' 'https://comexstat.mdic.gov.br/'       # 403
curl -sS -k -o /dev/null -w '%{http_code}\n' \
  'http://www.customs.gov.cn/customs/2025-03/18/article_2025122518342696862.html' # 412
# 断供证据链
psql "$MT_DB_URL" -c "SELECT source,status,inserted,updated,created_at FROM ingestion_logs \
  WHERE source='usda_import_beef' ORDER BY created_at DESC LIMIT 3;"              # warning 0/0 ×3
curl -s 'http://localhost:8000/api/market/public/digest' | jq '.data.digest.series[] | select(.slug=="beef_90cl_us")'
                                                                                   # latest 2026-08-28 close 348
```

psql 密度基线：见 §三（Explore 代理 2026-09-06 全量实测，命令含 per-source group by + min/max date + 近 30/7 天计数）。

---

## 八、增补批（同日晚）：政府官方在线 API 扩容实测——牧集/必孚数据流的官方构建可行性

> 回答追问：**"能不能尽量引入更多在线接口、用政府官方公布数据构建出类似牧集/必孚的数据流？"** 全部结论基于本机（直连 + mihomo 代理）2026-09-06 二次实测。

### 8.1 新验证可用的官方接口（上轮评估未覆盖）

| 接口 | 机构 | 今日实测 | key | 接入形状（落库/节奏/工作量） |
|---|---|---|---|---|
| `quickstats.nass.usda.gov/api/api_GET/` | 美国 USDA NASS | **401（API 契约活，仅差 key）** | data.gov 免费注册 | MarketFactor：月度牛屠宰（头数/活重）、**冻肉库存 Cold Storage**（最接近"库存"的官方数据）、Cattle on Feed；月度；S |
| `api.fas.usda.gov`（GATS + PSD） | 美国 USDA FAS | 网关活（根路径 JSON 404 属正常，08-31 同口径） | data.gov 免费注册 | MarketFactor：GATS 官方口径 HS10 双边出口（比 Comtrade HS6 更细，含 cutoff 子目）、PSD 全球供需；月/季度；M |
| `apisidra.ibge.gov.br` | 巴西 IBGE（国家统计） | **✅ 已落地（round-158 批B）**：boot runAll 首灌 16 行（2024-Q2→2026-Q1，头数与胴体两条序列），2026-Q1 头数 10,289,201 与 API 逐位一致；noChange 契约 + 8 测试守护 | **无 key** | 已接（MarketFactor `slaughter_bovines`/BR，`animais_abatidos`+`peso_carcacas` 双序列） |
| `sistemasweb.agricultura.gov.br` | 巴西 MAPA（农业部） | 根域 200（508KB 系统目录页）；SIF 具体查询入口 `/sipo` `/sidra` 均 404，**待勘察** | 无 | Factory 名录增强（巴西 SIF 注册出口企业 + 输华状态）；月快照；M（入口勘察 + HTML 解析） |
| `datos.gob.ar` CKAN | 阿根廷 | 已在库（argentina_exports 活，2026-06） | 无 | 已接 | — |
| `comtradeapi.un.org` | 联合国 | 已在库（922 行，2026-07） | 免费 key 可提配额 | 已接 | — |
| FRED fredgraph.csv | 美联储 | 已在库（22 序列；World Bank Pink Sheet 的 PBEEFUSDM/IMF 月度/期货均经此通道，**无需再接 WB/BLS 直连 API**） | 可选 | 已接 | — |

### 8.2 牧集/必孚产品 × 官方数据路径——构建可行性（核心回答）

| 牧集/必孚的产品面 | 政府官方路径 | 可行性 |
|---|---|---|
| **中国进口月度量价，分国别 × HS**（必孚旗舰） | Comtrade 出口国镜像（BR t-1 / AU·NZ·US t-2 × 8 HS，已在库）+ 中国年度上报 CIF 校准（已在库）+ FAS GATS HS10（key）加密粒度；AR/UY 月度缺口走 INAC 勘察 / CKAN | ✅ **可构建**（口径=出口国 FOB 镜像 ≠ 中国 CIF 官方月度，必须口径标注——现有 source/metadata 机制已支持） |
| **输华工厂名录 + 暂停/恢复动态** | 巴西 MAPA（宿主可达）+ 阿根廷 SENASA Mercados Abiertos（代理可达）+ 中国单一窗口（实名登录，低频半自动）+ DAFF（本机 000，待） | 🟡 出口国侧官方可自动化；中国侧半自动 |
| **港口库存** | **无任何政府公布**（必孚为自采商业数据）；唯一官方近似 = USDA NASS Cold Storage（美国冻肉库存，月度，key 门） | ❌ 不可（近似替代需明确标"美国口径"） |
| **现货日报（件套/部位 × 市场）** | **无任何政府数据源**；最近官方锚 = USDA 90CL 周度（eWAPS 修复中）+ MLA 指标（key） | ❌ 不可（维持 §五结论：人工录入/商业采购） |
| **税率查询 / 成本计算**（牧集 App 工具面） | 公开税则公告（静态维护）+ Comtrade 均价 × 税率 × 运价指数（SCFI 公开头条数）组合推导 | ✅ 可构建（组合值须标"推导"） |
| **屠宰/产量统计** | 美 NASS（key）/ 巴 SIDRA（免 key，API 已验证活）/ 澳 ABARES（000） | 🟡 两国可得（weekly_kills 表现成无写入者，正好承接） |
| **国际行情（期货/汇率）** | CME via FRED+Yahoo + FX（已在库，日度至 09-04） | ✅ 已在库 |

**构建后的节奏矩阵**（全部官方口径）：日度 CME+FX → 周度 90CL（修复后）+ MLA（key）→ 月度 Comtrade 6 通道 × 8 HS + AR FOB + NASS 屠宰/冻库存 + GATS → 季度 SIDRA + PSD → 年度中国上报校准。**统计面密度可对齐必孚的公开可见节奏**；牧集的差异化（现货日报 + 港口库存）确认不可由政府数据替代。

### 8.3 本环境不可达清单（直连+代理双通道实测，2026-09-06）

| 主机 | 直连 | 代理 | 影响 |
|---|---|---|---|
| `api.usda.gov`（MARS） | 000 | 000 | **§四.1 修复路径 B 受限**：即使注册 key，本机出口也连不上该网关（NASS/quickstats 同属 usda.gov 家族但可达——封锁是主机级非域名级） |
| `search.ams.usda.gov` / `ewaps.ams.usda.gov` | TLS 拒绝 / 000 | TLS 拒绝 | eWAPS 端点勘察需更换出口节点（`www.ams.usda.gov` 经代理 200，代理本身可到 AMS） |
| `api.data.abs.gov.au`（澳官方统计 ABS） | 000 | 000 | 与 ABARES 同族（agriculture.gov.au 000，round-118 口径）——澳官方 API 体系本环境整体不可达 |
| `api.indec.gob.ar` | 000 | 000 | 阿根廷走 CKAN（datos.gob.ar）替代，已覆盖 |
| `api.bls.gov` | 403（Akamai） | — | CPI/PPI 经 FRED 已覆盖，无需直连 |
| `api.stats.govt.nz`（新西兰） | 502 | 502 | 待复核（可能是路径/瞬时故障；低优先——NZ 月度可由 Comtrade 镜像承接） |
| `stats.customs.gov.cn` / `customs.gov.cn` | 412 | —（无大陆节点） | 维持：中国官方口径走镜像 + 条件路径 |
| `api-comexstat.mdic.gov.br` | 403 | 403 | 维持：Comtrade 镜像已替代 |
| CEPII BACI（`www.cepii.fr`） | 页面 404（站点活） | — | 年度全球双边贸易 bulk CSV，仅回填历史深度时用（P2） |

### 8.4 对既有优先级的影响更新

- **P0（eWAPS 修复）路径重排**：路径 B（MARS key）在本环境多一层出口封锁；**路径 C（LMR DataMart `mpr.datamart.ams.usda.gov`，今日 500 待复核）成为本环境内最可行路径**，路径 A（eWAPS 勘察）需换出口节点。
- **P0 新增（key 清单）**：data.gov 免费 key 一把覆盖 NASS + FAS 两家（ slaughter/cold storage/GATS HS10/PSD 四组官方序列）；MLA key 独立。
- **P1 新增**：~~IBGE SIDRA（免 key、API 已验证——四个新接口中唯一零依赖可立即写代码的）~~ **已落地（round-158 批B，见 §8.1）**；MAPA SIF 入口勘察（补 Factory 名录动态）。
- **P2 新增**：StatsNZ 复核、CEPII BACI 年度回填、WB 直连 API（无必要，FRED 已覆盖）。

### 8.5 增补批取证命令（2026-09-06）

```bash
# 官方 API 活性（直连）
curl -s 'https://quickstats.nass.usda.gov/api/api_GET/?commodity_desc=CATTLE'          # {"error":["unauthorized"]} = 契约活
curl -s 'https://api.fas.usda.gov/'                                                     # JSON 404 框架应答 = 网关活
curl -s 'https://apisidra.ibge.gov.br/values/t/1092/n1/1/v/265/p/last%201'              # 400 参数校验 = API 活（接入时查正确表/变量码）
curl -s -o /dev/null -w '%{http_code}\n' 'https://sistemasweb.agricultura.gov.br/'     # 200
# 代理通道（mihomo 127.0.0.1:7890）
curl -x http://127.0.0.1:7890 -o /dev/null -w '%{http_code}\n' 'https://www.google.com/'   # 302 代理活
curl -x http://127.0.0.1:7890 -o /dev/null -w '%{http_code}\n' 'https://www.ams.usda.gov/' # 200（代理可到 AMS 母域）
curl -x http://127.0.0.1:7890 -o /dev/null -w '%{http_code}\n' 'https://api.usda.gov/'     # 000（主机级封锁）
# eWAPS 子域
curl -sS -o /dev/null -w '%{http_code}\n' 'https://ewaps.ams.usda.gov/'                    # 000
```
