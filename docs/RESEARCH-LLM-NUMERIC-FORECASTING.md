# 数值预测与大模型实践调研（服务器现状复查 + 量化金融/肉类贸易/开源项目三路调研）

| | |
|---|---|
| **版本** | 1.0.0（经独立批评代理复审修订：初稿 5 处硬伤已改——牛肉月度行数/H=6 状态口径、timer/sundial verified 计数、aus_sirloin_m9 遗漏、chronos-2 已缓存已评估的事实、R3 与 round-138 关闭记录的冲突） |
| **日期** | 2026-08-31（round-151，调研轮） |
| **状态** | active |
| **输入** | 用户目标："重新获取当前服务器的状态，重点关注预测数值变化的模型使用的方案，调研量化金融和肉类贸易等相关实践，学习其他相关项目是如何使用大模型来实现数值预测的" |
| **related_docs** | [PREDICTION-STRATEGY.md](PREDICTION-STRATEGY.md)（§六/§七=预测策略规范与学术前沿，本报告不重复）、[IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md)（v3.1.0~v3.5.0 批次与执行状态）、[RESEARCH-BEEF-INFO-LANDSCAPE.md](RESEARCH-BEEF-INFO-LANDSCAPE.md)（供给侧全景） |

> **定位与分工**：PREDICTION-STRATEGY §六（2026-08-30）已回答"MT 自己该怎么做"（七条规范），§七已检索 TSFM 学术前沿（模型清单层面）。本报告回答另外三个问题：**① 服务器与预测链路的 2026-08-31 现状（全部实测）② 量化金融与肉类贸易的*从业者*（非学术前沿）实际怎么做数值预测 ③ 其他开源项目怎么用大模型做数值预测（工程组织视角）**。启示部分只登记增量（标注与 §六/§七 及 IMPROVEMENT-PLAN 的关系），不重复登记。
>
> **证据分级**沿用 round-148 约定：【实测】= 本轮一手命令/代码取证，或主调研亲自 WebFetch 到的原文；【代理】= 子代理单次取证；【转述】= 二手来源。外部取证只读，未注册/登录/付费任何服务。

---

## 一、服务器与预测链路现状（2026-08-31 05:24-05:27 UTC 实测）

### 1.1 服务面

| 服务 | 状态 | 证据 |
|---|---|---|
| mt-backend（:8000） | online，uptime 6h，↺7，RSS 155MB（05:24 时点读数，会漂移），`/health` 200 | pm2 list + curl |
| mt-frontend（:3000） | online，uptime 6h，↺3，RSS 99MB，HTTP 200 | 同上 |
| mt-inference（:10810） | online，uptime 8h，↺0，RSS 1.9GB（3 份 T5 权重常驻的常态量级）；`/health` 200；`/ready`=`{ready:true}`，3 个 Chronos pipeline 全部预加载成功、零 preload 失败 | 同上 |
| PostgreSQL（:5432）/ Redis（:6379） | 监听正常，redis-cli PONG | ss + redis-cli |

部署模式 PM2（compose 栈未运行，与 AGENTS.md 记载一致）。推理服务 RSS 1.9GB 属常态（3 份 T5 权重常驻），重启计数 0——并发闸门（§1.3）生效后未再复发 round-104 的 RSS 爆破。

### 1.2 数据与预测日志面（SQL 实测）

**数据新鲜度**：

| 表 | 最新 date | 行数 | 判读 |
|---|---|---|---|
| commodity_prices | **2026-08-31（当日）** | 66,638 | 宏观/期货池持续自动更新 |
| beef_cut_prices | **2026-04-30（冻结 4 个月）** | 2,401 | 部位级数据等 CSV 导入/源解冻（runbook：docs/guides/WEEKLY-DATA-IMPORT.md） |

**prediction_logs 总量与状态**（全表 201,456 行）：completed 50,962 / verified 36,658 / stale 11,718 / unverifiable 102,118；cadence：daily 52,765 / monthly 168 / NULL(legacy 按 daily 读) 148,523。

**model_id 出现过 10 个**——比 /models 的 9 个多出 `sundial` 与 `timer_xl`（各 165-167 行，2026-07-05 出尽、2026-07-16 最后验证；verified 各 10 条，另有各 6 条带 MAPE 的 stale 行，即前表"已算 MAPE 行数=16"）。不是逃逸模型：`inference_engine.py:11` 明确"previous Timer-XL/Sundial online-training path was removed as an anti-pattern"——被移除的是**请求时在线训练的接入方式**（违反"只用预训练模型"红线），而非模型家族本身（Sundial=清华 THUML ICML'25 生成式 TSFM、Timer-XL=ICLR'25，§4.1 表内均登记）。【实测】

**分模型精度（两个口径，SQL 实测）**：

| 模型 | 全历史中位 MAPE | 全历史 p90 MAPE | 30d 窗口中位（live track-record） | 已算 MAPE 行数¹ |
|---|---|---|---|---|
| holtwinters | 0.4 | 18.0 | **0.31** | 3,067 |
| naive_forecaster | 0.4 | 16.3 | 0.35 | 3,067 |
| exponential_smoothing | 0.4 | 17.5 | 0.35 | 3,067 |
| arima | 0.4 | 18.5 | 0.38 | 3,066 |
| chronos_tiny | 1.5 | 220.7 | 1.45 | 7,302 |
| chronos_mini | 1.5 | 357.4 | 1.45 | 7,301 |
| chronos_base | 1.5 | **530.6** | 1.45 | 7,304 |
| timer_xl（已移除） | 1.6 | 118.5 | — | 16 |
| sundial（已移除） | 4.8 | 48.4 | — | 16 |
| stl_forecaster（在库不投票） | 8.1 | 32.3 | — | 2,866 |

¹ 已算 MAPE 行数 = `count(mape)`，跨 status 口径：verified 36,658 行全部有 MAPE，另有 414 行 stale 带已算出的 MAPE（验证后被生命周期重分类），二者合计即本列（各模型相加 37,072）。【实测】

两个新读数值得单独记录【实测】：

1. **均值口径会被 Chronos 尾部彻底拉爆**（chronos_base 全历史均值 MAPE 212% vs 中位数 1.5%），且 **p90 随模型容量单调变差**（tiny 220 → mini 357 → base 531）："更大模型=更重尾部"。这把 PREDICTION-STRATEGY §6.1-1 的"chronos 劣于 naive"细化成"中位差距有限、尾部差距巨大"——容量多样性（三变体集成）的收益方向与尾部风险方向相反。
2. **部位级（beef cut）当前零预测**——62 个有预测历史的 commodity 中牛肉相关只剩 `beef_carcass_us`/`beef_retail_us` 月度（FRED/世行系）与已停更的部位代理序列 `beef_australia`/`aus_cube_roll_m9`/`aus_sirloin_m9`（后两者 2026-04 冻结，sirloin 留有 4,773 条预测行）。牛肉预测的"现在进行时"全部在月度宏观层；日度/周度预测池由 FX（aud/brl/usd_cny/eur）+ CME 期货复合（live_cattle/feeder_cattle/lean_hogs/corn/wheat/soy*/crude/gold…）+ 现货（LME/LBMA/Cotlook）+ 世界序列（pork/poultry/rice/sugar）构成。

**牛肉月度预测的到期时刻**：`beef_carcass_us` 月度共 **28 行 = 7 模型 × H∈{1,3,6,10}**，全部锚定 `forecast_start_at=2026-07-31`【实测】。其中 H∈{1,3,10} 的 21 行 completed；**H=6 的 7 行 status=stale 且从未验证（mape/verified_at 均 NULL）**——这不是缺陷而是政策处置：这 7 行是 interval 列出现前的 legacy 行（interval=NULL），round-136 0d 按 D5（月度 horizon 收敛 [1,3]+遗留行 stale）统一标记；H=10 属"existing rows stay valid"的历史有效行。**H=1 的对账日就是今天（2026-08-31）**，八月实值按 FRED 惯例 ~9 月中旬发布——批 0a 值守窗（2026-09 中下旬）口径与 round-147 前置检查一致。【实测 + IMPROVEMENT-PLAN round-136 记录】

### 1.3 预测数值的模型方案（代码级梳理）

**推理层**（inference-service，FastAPI:10810；chronos-forecasting 2.3.1 / torch 2.12.1+cpu / statsmodels 0.14.6 / sktime 1.0.1，pip show 实测）：

- **主模型 = Chronos T5 三容量零样本集成**（tiny/mini/base）。**Bolt 变体被显式跳过**——`inference_engine.py:29-31`：chronos-forecasting 2.3.1 与 bolt 的 `input_patch_size` 配置不兼容。
- **数值预测的技术路线 = 分位数化**：`pipeline.predict_quantiles()` 返回 (lower, median, upper)；置信水平参数化（默认 0.95）。
- **确定性推理**（round-136）：请求 payload 派生 SHA-256 → 31-bit torch seed，信号量内 `torch.manual_seed` 后再采样——串行调用 bit 级可重放，回测可比。
- **工程护栏**：并发信号量（默认 3）治 CPU 超订 RSS 爆破；`torch.inference_mode()` 治梯度图累积（曾致每预测 +200MB、30 分钟一轮回收）；pipeline 进程级缓存 + 双检锁；权重未缓存则 /models 如实标 blocked、/predict fail-fast。

**统计基线层**（`statistical_models.py`）：

| 模型 | 实现 | 关键细节 |
|---|---|---|
| arima | ARIMA(2,1,1) | <4 点退化 naive；原生 se_mean 置信带，z 查表向上钳制 |
| sarimax | SARIMAX(2,1,1)+exog | **唯一协变量通道**；exog 长度契约前置校验；future_exog 缺省前向填充；不收敛退化 arima。**不在投票池（零 verified 历史）** |
| holtwinters | 三次指数平滑 add/add | ≥14 点用 period=7 季节项，否则无季节 |
| exponential_smoothing | 简单（一次）指数平滑：`ExponentialSmoothing(trend=None, seasonal=None)`（/models 自述同口径；AGENTS.md 旧注"二次"与实现不符，已随手修正） | |
| naive_forecaster | sktime NaiveForecaster("last") | 淘汰制"及格线" |
| stl_forecaster | STL(robust)+Gardner-McKenzie 阻尼外推（damping=0.5）+信噪比门控 | 已移出投票池（B3：证据池 2026-07-26 冻结） |

置信带：统计模型用一阶差分残差 bootstrap 近似（std × z × √step），零退化按序列量级 1% 兜底。

**共识层（backend）**：

- 投票池 `ALL_MODELS` = 3 Chronos + 4 统计基线；stl、sarimax 排除且理由入库注释。历史注脚：2026-08-23 前投票池 chronos-only——三变体当时 30d 窗口全部劣于 naive，质量权重全零后静默退等权，round-122 批 3 加入基线后质量机制才真正起作用。
- **质量加权**：滚动 30d 中位 MAPE 归一权重；劣于-naive 淘汰制（round-110，双侧 MIN_VERIFIED 防误杀）；per-series 冠军路由（序列局部 ≥20 条 verified 时按该序列精度表定权）；证据不足退等权。
- **共识语义**：方向 up/down/flat（±1%）；方向=质量加权投票（好模型可以以少胜多）；共识价=加权中位数；支撑/阻力不让离群预测拉伸区间。
- **验证环**：completed → 实值到位 verifyPrediction → verified/stale/unverifiable；对账锚=`forecast_start_at`（预测时间线第一步，非落库时刻）；月度按月数窗（ADR-0001）；回测服务 7/30/90 天窗。
- **公开档案**：`GET /api/signals/models/accuracy/public`（免鉴权、白名单只放宏观商品与牛肉序列、私有 id fail-closed），30d 排行榜 live 通过。
- **调度**：每商品每 30 分钟后台刷新（TTL 45 分钟缓存先行），在飞守卫防周期重叠。
- **牛肉月度滚动回测已执行**（round-136 批 1，`docs/backtests/beef-monthly-2026-08.md`，36 origins × H=1/3 × 7 模型，两次 3-origin 对照 md5 一致——确定性种子的直接收益）：**chronos 的淘汰结论在牛肉月度 H=1 不成立**（中位 1.61-2.08% vs naive 1.69% 同带）、**在 H=3 成立**（3.28-3.91% vs 2.71%）；可预测上限就在 naive 附近（最优 arima 仅好 14%/3%），与 M6 教训形态一致；**arima 为牛肉月度冷启动冠军**；chronos 原生区间欠覆盖 58-78%（校准区间的直接动因）。§1.2 表内 chronos 的差中位数主要来自 FX/CME 日更池——牛肉月度序列上三个变体与 naive 同带，这正是 per-series 冠军路由（round-137 2a）存在的理由。

**方案一句话**：数值预测 = "预训练 TSFM 三容量分位数零样本 + 统计基线委员会"双轨，全部预测过同一套滚动验证与淘汰门禁，牛肉月度已有滚动回测基线，对外卖共识（方向+加权中位价+区间）——即 PREDICTION-STRATEGY §6.2 规范 2 的生产形态。

---

## 二、量化金融的数值预测实践（业界）

> 子代理取证（三路之一），关键条目附来源；【代理】=代理 WebFetch 到原文，【转述】=二手。

### 2.1 方法论栈：组合与门禁，而非单模型军备

- **组合预测是五十年的主结论**：M4 竞赛（10 万序列、61 方法）最佳**可复现**方法 = SES/Holt/Damped 的**等权平均**，冠军方法（ES-RNN 混合）不可复现【转述，Makridakis et al. IJF 2020，sciencedirect.com/science/article/pii/S0169207019301128】。"组合预测之谜"（简单平均常胜精巧权重，Stock & Watson 2004 提出术语）有 50 年综述【转述，Timmermann IJF 2023】。**与 MT 的关系**：MT 的"质量加权+证据不足退等权"正是文献推荐的稳妥形态；等权平均这个"零成本第 10 模型"反而还没登记（→ 启示 R2）。
- **GARCH 族管波动率、不管价格水平**；regime switching 源自 Hamilton 1989 Markov 转移自回归【转述】。引入时勿混用：MT 若做波动率带（区间校准）可借鉴 GARCH 思想，价格水平预测不是它的用途。
- **回测卫生**：Deflated Sharpe Ratio（修正多重检验选择偏差）与 PBO/CSCV（组合对称交叉验证）是量化圈防"回测过拟合"的标准工具【转述】。MT 的对应物=固定评估协议 + 淘汰制双侧证据门槛；扩展模型时的多重比较风险（试得越多、总有模型碰巧赢）已有制度对冲。

### 2.2 LLM 在量化里的真实位置：文本→特征，不是数值回归

- **Lopez-Lira & Tang**（arXiv 2304.07619，已刊 JFE）【代理】：LLM 给新闻标题打情绪分作特征——对**初始市场反应**约 90% 组合日命中率（作者自注不可交易），对可交易漂移显著，小盘+负面新闻最强。两条告诫：**策略收益随 LLM 普及衰减**；后续《The Memorization Problem》（arXiv 2504.14765）证明训练覆盖期内 LLM 的经济预测不可信（记忆污染）【转述】。
- 机构落地全是**文本侧**：BloombergGPT 50B（金融文本任务）【代理】、Morgan Stanley GPT-4 助手（内部内容生成+合规监督）【转述】、摩根大通 **IndexGPT 只是 2023-05 商标申请、无对应产品**（纠偏：勿引用为"产品"）；其真实产品 LLM Suite 是研究助手/摘要【转述】。
- **LLM 直接回归价格数值：金融场景无可靠正面证据**（见 2.3）。

### 2.3 两类模型的区分（本轮最重要的引用纠偏）

- **Tan et al.《Are Language Models Actually Useful for Time Series Forecasting?》（NeurIPS 2024 Spotlight，arXiv 2406.16964）**【代理】：对 OneFitsAll/Time-LLM/CALF 做 ablation——**去掉 LLM 骨干或换成单层 attention 不掉点、多数反升**；patching+attention 编码器即可匹配。**纠偏两则**：① 流传的"多数 LLM 方法打不过 DLinear/统计基线"在现行 arXiv 版**不存在**（Table 19 反而注明 LLM-based 略优于 non-LLM）——引用以 ablation 结论为准；② 官方代码是 github.com/BennyTMT/LLMsForTimeSeries（自证官方），不是传闻的 tanhle 仓。
- **区分成立但须精确表述**：Tan et al. 否定的是"把预训练**语言**模型当回归骨干"；**Chronos（arXiv 2403.07815）是数值 token 化后从头预训练的 T5**，属不同范式【代理】。MT 现行"统计+Chronos、聊天 LLM 不进数值预测"的路线与两篇文献同时相容。
- PREDICTION-STRATEGY §7.2 对 Tan et al. 的引用（"骨干移除后不降反升"）与原文一致，无需修订；本报告补充的是"别过度引申"的边界。

### 2.4 开源量化项目的工程组织

- **Qlib**（microsoft/qlib）【代理】：数据服务 → 版本化特征集（Alpha158/360）→ 可插拔模型动物园（GBDT/LSTM/TRA/HIST 等 20+）→ `qrun` 端到端（训练→回测→年化/IR/回撤）→ 组合优化独立成层；`benchmarks_dynamic` 提供 **Rolling Retraining** 应对非平稳；RD-Agent 用 LLM agent 自动挖因子（arXiv 2505.15155）。
- **FinRL**（AI4Finance）【代理】：市场环境（Gym）/DRL 代理/应用三层，train/test/trade 三段式。**FinGPT**（arXiv 2306.06031）【转述】：五层管线，核心是自动数据管道+轻量微调而非从头训练。
- **共同模式**：特征集版本化、模型可插拔、回测/模型管理内建、组合层独立。MT 的对应物已各就各位（modelRegistry=可插拔注册表、prediction_logs=预测管理、tradingSignals=组合层）；缺的是"外生特征表版本化"（→ 启示 R8）。

---

## 三、肉类/农产品贸易的价格预测实践（业界）

> 子代理取证（三路之二）。

### 3.1 权威机构：判断+模型+供需平衡的混合，发布区间而非点值

- **USDA**【代理，ers.usda.gov/topics/farm-economy/commodity-outlook/usda-outlook-process】：WASDE 月度预测出自跨部门商品估算委员会约 2 周"共识制"流程，官方口径=“经济模型与统计分析+专家判断”混合；长期基线="模型结果与判断分析的复合"。**USDA 自己的区间常被打脸**：Sanders & Manfredo (2003) 评估实际价落入其预测区间仅 48%（肉鸡）/35%（猪）【转述】——"区间也未必覆盖"是行业常态，MT 的覆盖率审计（规范 4）正对此痛点。
- **LMR 报价的用途纠偏**【转述】：AMS 强制报价（覆盖 ≥12.5 万头/年屠宰企业、>90% 箱装牛肉量）与 CME Boxed Beef Index 是**定价基准**（约 61% 育肥牛 formula 定价挂钩已报告价格），是价格发现的输入而非预测对象——MT 把 LMR/AMS 系数据当数据源而非预测目标，方向正确。
- **MLA**【代理】：90CL 是描述性指标（输美 90% CL 制造肉 CIF 报价）非预测产品；Cattle Industry Projections 每年 3/9 月两期，索引页未见数字价格预测（PDF 内是否有数值预测未核实）。**Rabobank/FAO/世行**【转述】：分析师判断型展望（Rabobank 牛肉季报、FAO Food Outlook 供需平衡+短期一致性模型、世行 CMO 年度级预测），方法论在订阅墙内、无公开方法文档。
- **小结**：权威机构全部是混合制、发布区间/情景；纯统计/纯模型机构预测罕见。MT"无分析师观点、纯模型+自动验证"反而是差异化定位（RESEARCH-BEEF-INFO-LANDSCAPE §七已述的空位）。

### 3.2 期货锚 + 基差：现货预测的实务分解

- **BeefBasis.com（K-State 系）**【代理，beefbasis.com/about-the-price-forecasting-tool/】：期望现货价 = β0 + β1×期货价（β0 即基差、β1 套保比率），按批次特征（性别/体重/地点/日期）回归，输出 **68% 置信区间**与套保头寸——把"预测价格"分解成"锚定期货 + 预测基差"两步。
- **基差预测的学术结论**【转述】：Payne & Karali (2015)——贝叶斯改进有限，"no-change"与 3 年历史均值基差法**最难打败**；K-State 推广材料称历史平均基差法"最简单且最可靠"。→ 牛肉进口到岸价对 `beef_90cl_us`/活牛期货的基差分解，是 MT 数据条件下比直接外推更稳健的建模候选（→ 启示 R5）。
- 中国进口商直接用 CME 活牛/Beef Trim 对冲南美/澳新牛肉的公开案例**未找到**【未核实】；间接证据：中国关税/配额政策变化直接传导至 CME 活牛期货。

### 3.3 ML vs 统计：证据按"频度×样本长度"分层

- **Alberta 育肥牛月度价（2005-2023，约 226 点）**【代理，Rahmani et al. 2024, Sustainability 16(5):1789】：ARIMA/SARIMA/SARIMAX vs SVR/RF/AdaBoost——**RF 与 AdaBoost 总体占优**，SARIMAX 可引入产量/贸易外生变量。样本量与 MT 牛肉月度序列（195 点）同量级——**树模型是 MT 尚未试过的一族**（→ 启示 R8 备注）。
- **印度 23 种农产品日度批发价（千点级长序列）**【代理，Manogna 2025, Sci Rep】：GRU/LSTM 显著优于 ARIMA/XGBoost（DM 检验），但**平稳序列上 ARIMA 仍具竞争力**；作者承认纯价格输入无法捕捉突发冲击。
- 汇总规律：**高频+长样本+高波动 → DL 胜出；月度短序列 → 树模型/统计差距缩小甚至反超**。"样本短到什么程度统计必然占优"的精确阈值无系统研究【未核实】。
- Bessler (1992)：活牛期货价格曾优于专家预测——朴素基准不可忽略【转述】。

### 3.4 商业披露：MAPE 类指标会自欺，公开档案是稀缺品

- **Expana（原 IHS Markit/OPIS 农业）**【代理，expanamarkets.com/insights/article/when-95-accuracy-is-meaningless-how-to-read-commodity-forecast-claims/】：公开撰文批判"95% 准确率"宣传——其论证机制：年波动 15% 的商品月化约 4.3%，**naive 不变预测 1 个月平均即有 95.7% "准确率"（=100%−4.3% 偏差）、12 个月 85%（=100%−15%）——"准确率"口径是宣传方自定义的 100%−偏差，零技能可得**；其披露方式=向客户提供历史预测目标全档案+套保建议存档（仅客户可见）。**对 MT**：MAPE 类偏差指标在高波动源上天然好看，验证环需要"相对 naive 的技能分"（MASE 或相对提升）与方向准确率互补（方向准确率 round-139 已 live；MASE 未登记 → 启示 R1）。
- **DTN**：Six Factors 框架有观点、无公开量化档案【转述】。**AgFlow**：未检索到公开预测准确率披露【未核实】。
- **ABARES（澳政府）**：定期发布农业预测表现与准确率评估【转述，agriculture.gov.au/abares/research-topics/agricultural-forecasting】——"公开预测对错档案"的政府先例，MT 的 track-record 有先例可引（商业侧无一家做到）。

### 3.5 TSFM 在农产品的实证：刚起步、且没碰到牛肉

- **arXiv:2601.06371（2026-01）**【代理】：5 个 TSFM（Chronos、Chronos-2、TimesFM 2.5、Time-MoE、Moirai-2）零样本在 **USDA ERS 月度农产品价（1997-2025，约 340 点）**上稳定胜过传统时序/ML/从头训练 DL 基线，且 4 个商品中 3 个胜过 USDA 基于期货的季节均价预测（Time-MoE 最优：小麦较 USDA 基准改进 54.9%）。**注意边界**：月度**长**序列（~340 点 > MT 的 195 点）、不含牛肉/牲畜。
- TSFM 在牛肉/周度/日度价格上的应用研究**未找到**【未核实】——MT 的场景（牛肉+周度 90CL）若做滚动回测基准，本身就是可发表的增量证据（批 1 回测的副产品价值）。

---

## 四、开源项目如何用大模型做数值预测（工程视角）

> 子代理取证（三路之三）+ 主调研补证（4.6）。

### 4.1 TSFM 全景（截至 2026-08，参数量/许可重点核实）

| 模型 | 机构/出处 | 参数量 | 架构要点 | 概率输出 | 协变量 | 许可（商用判定） |
|---|---|---|---|---|---|---|
| Chronos-T5 | Amazon 2024 | 20M-710M | 数值 mean-scaling 量化为类别 token，T5 enc-dec 自回归采样；28 数据集 890K 序列 ≈84B tokens | 采样→任意分位 | 无原生 | Apache-2.0 |
| Chronos-Bolt | Amazon 2025 | tiny 9M/mini 21M/small 48M/base 205M | **encoder-only**+patch+直接多步 quantile 头；ctx 2048、预测≤64；比 T5 版快 250x、省内存 20x、误差低 5%（repo README/AWS 博客口径，**无独立论文**） | 直接分位 | 无原生 | Apache-2.0 |
| **Chronos-2** | Amazon 2026 | 120M | encoder-only + group attention 跨序列 in-context learning；原生多变量；ctx 8192、预测≤1024；官方称对 Bolt 胜率>90%、支持 CPU | 用户指定分位 | **原生：past+future known、实数+类别** | Apache-2.0 |
| TimesFM | Google | 1.0 200M→2.0 500M→2.5 200M(+30M 分位头)、ctx 16k→**3.0（2026-08）原生协变量+多变量+9 分位** | decoder-only+patch | 2.5 起 | 3.0 原生 | 代码 Apache-2.0；**3.0 权重 non-commercial（禁生产使用）** |
| Moirai 家族 | Salesforce | MoE base 0.9B；Moirai 2.0（2025-08）decoder-only 36M 序列 | any-variate attention 多变量 | 分位/混合分布 | 支持 | 库 Apache-2.0；**MoE 权重 CC-BY-NC-4.0 非商用** |
| Lag-Llama | 时间序列联盟 | ≈2M（社区口径待核） | LLaMA 式+lag 特征 | 分布头 | 有限 | Apache-2.0 |
| TimeGPT | Nixtla | 未公开 | **闭源 API**（官方明言 closed source，仅 SDK 开源） | 分位 | 支持 | 商业 API |
| MOMENT | CMU ICML'24 | Small/Base/Large | masked 重建通用底座；预测非强项 | 否 | 否 | 开源 |
| Timer / Timer-XL | 清华 THUML | Timer-XL ≈128M | decoder-only 因果注意力、TimeAttention 多变量 next-token、长上下文 | 采样 | Timer-XL 多变量 | 开源 |
| TTM | IBM NeurIPS'24 | **≈1M 起** | all-MLP TSMixer+adaptive patching；R2 外生 channel-mixing | 分位(r2) | R2 外生 | 开源 |
| Sundial | 清华 THUML ICML'25 | base 128M | 生成式（连续 token 采样模拟未来），≈1T 点训练 | 采样 | 否 | 开源 |
| TabPFN-TS | PriorLabs | 继承 TabPFN-v2 | 表格基础模型+轻量特征工程零样本 | 点+概率 | 特征即协变量 | 开源 |

（来源：arxiv.org/abs/{2403.07815,2406.16964,2410.10393,2410.04803,2501.02945,2502.00816,2511.11698}；github.com/{amazon-science/chronos-forecasting, google-research/timesfm, SalesforceAIResearch/uni2ts, thuml/Sundial, thuml/Timer-XL, PriorLabs/tabpfn-time-series, unit8co/darts}；huggingface.co/{amazon/chronos-2, amazon/chronos-bolt-base, Salesforce/moirai-moe-1.0-R-base, ibm-granite/granite-timeseries-ttm-r2}；均 2026-08-31 取证【代理】。）

### 4.2 引用纠偏三则（写对外文案前必读）

1. **“Chronos 零样本 27/42 数据集优于季节性朴素”是误引**【代理，论文 HTML §5.5】：原文是 42 数据集=域内 15+零样本 27，结论表述为"significantly outperform local statistical models"，**无逐数据集胜负计数**。对外表述用"零样本集上显著优于局部统计模型（WQL/MASE 相对分几何平均）"。
2. **arXiv:2410.18065 不是 Bolt 论文**（实为机器人论文 SPIRE）；Bolt 的 250x/20x/5% 数字出处是 repo README 与 AWS 博客，引用时标"官方口径"。
3. **GIFT-Eval（28 数据集 144K+ 序列，arXiv 2410.10393）上，TSFM 中仅 Chronos-2 与 TimesFM-2.5 胜过 Auto-Theta**【转述】——统计基线在少样本/短序列场景仍极具竞争力，与 MT 自家实测（§1.2）同构。

### 4.3 微调门槛：MT 当前不达标，红线与官方阈值殊途同归

AutoGluon 官方教程（auto.gluon.ai/dev/tutorials/timeseries/forecasting-chronos.html）【代理】：LoRA 微调（默认 `fine_tune: True` 即 LoRA；lr 1e-4、2000 步量级）的**官方门槛 = >100 条序列且序列中位长度 >3× 预测长度**。MT 的可预测序列（62 个 commodity 池、牛肉月度 195 点）**低于该阈值**——不微调不只是仓库红线（"只用预训练模型"），也是官方工程建议；唯一例外是 AutoGluon `chronos2_ensemble` 预设（零样本+微调版兜底）。未来部位级数据若聚合成 >100 条序列（16 部位 × N 厂 × 多国），微调议题才值得重开（→ 启示 R4）。

### 4.4 框架编排：多模型竞争选优的机制细节

- **AutoGluon-TimeSeries**【代理】：GreedyEnsemble=**Caruana 贪心带放回**，在 hold-out backtest 窗按验证分（默认 WQL）迭代选模型、**权重∝入选次数**，对分位预测加权平均；另有逐序列权重的 PerItemWeightedEnsemble——与 MT 的 per-series 冠军路由（≥20 verified 激活）哲学相同，机制可借（→ 启示 R8）。
- **statsforecast（Nixtla）**：`Auto*` 模型内自动搜阶；`cross_validation(h, n_windows, step_size)` 滚动窗多折选优；`predict(h, level=[90])` 直接出区间列【代理】。
- **darts（unit8co）**：Naive/RegressionEnsemble + **Conformal 模型做校准区间** + moving-window backtest【代理】——MT 的 conformal 区间（α=0.1，round-110）与此同流。
- **sktime**：make_reduction（recursive/direct）+ EnsembleForecaster(aggfunc) + 滚动窗 CV【转述】——MT 统计层正构建在 sktime/statsmodels 上。

### 4.5 工程模式（CPU 部署参照）

- 原版 Chronos CPU 上 ≈400ms/条（AutoGluon 教程口径），可用 ONNX 优化【转述】；Bolt 单次前向即多步（250x 提速的来源）；Chronos-2 支持 CPU 但官方未给吞吐数字（**须本地实测**）。MT 当前 T5 三变体 + 信号量 3 的延迟量级与之相容。
- 后处理链（去量化→bin 中心→乘 mean-scaling 回原始单位）在库内自动完成【代理】；前端惯例=画 0.1-0.9 分位扇形带（darts 官方示例即 5/95 带）。
- 层级序列 reconciliation（Nixtla hierarchicalforecast）【未核实】——若 MT 将来做"月度总盘 × 部位分解"两层一致预测可用。

### 4.6 主调研补证：chronos-forecasting 版本与 chronos-2 现状（升级路径的承重核查）

**【实测】github.com/amazon-science/chronos-forecasting/releases（2026-08-31）**：

- **v2.3.1 就是最新版**（MT 已装即最新）。releases 全 history 无任何 `input_patch_size`/Bolt 修复条目——引擎注释记录的 Bolt 不兼容**在最新版仍无包侧修复记录**，Bolt 路线暂无"升级即得"的出路。
- **Chronos-2 已被同一包 2.1.0+ 原生支持**（Chronos2Pipeline、2.2.0 起 LoRA 微调、cross_learning、2.3.0 预处理提速 20x）——接入不涉及依赖变更。

**【实测】chronos-2 权重已在本地缓存**：`/root/.cache/huggingface/hub/models--amazon--chronos-2/`（456MB，与 T5 三变体并列）。且 round-138（2026-08-30）批 3 双臂门禁实验中**臂 B 已用 chronos-2 协变量跑过**：四组 FAIL（rel 0.955-1.317，brl H=3 劣化 +32%），报告在 `docs/backtests/beef-leading-indicator-2026-08.md`——**领先指标方向经双臂门禁诚实关闭（重评 2028-11），chronos-2 测过未采**（D6 例外条款已履行）。因此"chronos-2 接入"在本仓库不是开放待办，而是**已评估、有留档结论的关闭项**；本轮外部证据（120M/Apache-2.0/原生协变量/CPU）的价值在于为 2028-11 重评窗口提供背景，而非新落地路径。

---

## 五、对 MT 的启示（增量登记）

> 每条标注【新增】或【强化 §6.2 规范 N / IMPROVEMENT-PLAN 批 X】，避免重复登记；均不改变现有批次排序。

| # | 启示 | 证据 | 与既有规划的关系 |
|---|---|---|---|
| R1 | **验证环补"相对 naive 技能分"（MASE 或 相对提升%）并按波动分层报告**——Expana 论证年波动 15% 的商品 naive 不变预测 1 个月即有 95.7% "准确率"；USDA 自己的区间覆盖率也只有 48%/35% | §3.4【代理】 | 【强化】规范 4/5（方向准确率已 live round-139；MASE/技能分是 MAPE 的互补维度，未登记）。落点可在批 0b 校准区间同批或紧随 |
| R2 | **"组合预测"作为第 10 个受验证 model id 入排行榜**（投票池等权平均，零新依赖）——组合预测之谜（简单平均常胜精巧权重）的学理已见于 §6.1-2(b)/规范 2（证据不足退等权即其应用）；**本条增量只在"载体"**：把等权平均做成一条受验证的对照线进 prediction_logs/track-record，让"共识 vs 最佳单模 vs 组合"三线可比较。M4 最佳可复现方法即简单平均是其实证底气 | §2.1【转述】 | 【新增候选】载体级增量，不重复学理登记；约几十行代码，过同一验证环 |
| R3 | **挑战者路径的记录校正**（复审修正）：领先指标方向已按 D6 例外条款**测过并诚实关闭**——臂 A sarimax lagged-exog 与臂 B chronos-2 协变量双 FAIL（rel 0.955-1.317），重评 2028-11；chronos-2 权重已在本地缓存、评估有留档。本轮增量只剩两个确权事实：① Bolt 在 2.3.1（最新）仍无兼容修复记录→维持不可用；② **TimesFM 3.0 权重 non-commercial、Moirai-MoE CC-BY-NC——商用许可直接排除**（2028-11 重评窗口的候选集据此收窄） | §4.1/§4.6【实测+代理】+ IMPROVEMENT-PLAN round-138 记录 | 【校正+登记】修正初稿对批 3 状态的误读（其时已关闭）；许可排除是 D6 的新证据，登记备 2028-11 重评用 |
| R4 | **微调议题的证据落袋**：官方门槛 >100 条序列 & 中位长度 >3×h——MT 当前不达标，"只用预训练"红线与官方工程建议一致；重开条件=部位级数据聚合成 >100 条序列 | §4.3【代理】 | 【强化】§6.3"微调禁止"行——从"195 点必过拟合+红线"升级为"红线+官方阈值+重开条件"三重依据 |
| R5 | **基差分解建模候选**：对与外部基准强相关的序列（如 beef_90cl_us 挂钩的美湾市场、活牛期货），按"基准锚+基差"两步建模（基差用历史均值/回归），学术证据表明比直接外推稳健且小数据够用（BeefBasis 68% 区间口径可参照） | §3.2【代理+转述】 | 【新增决策项】依赖部位级数据解冻或 90CL 序列积累（批 1 已接入 90CL 周度，2026-08-28 起有数据）；与 landing-cost 工具语义互补 |
| R6 | **LLM 文本→特征实验的两条告诫**：alpha 随 LLM 普及衰减；训练覆盖期内记忆污染——market_news 情绪标记实验须含"发布时点对齐"设计（避免用到未来信息） | §2.2【代理+转述】 | 【强化】§6.3"LLM 读资讯"行（维持登记实验、不进共识、过门禁才对外） |
| R7 | **对外叙事弹药三件**：ABARES 政府级公开预测评估先例；Expana 对"95% 准确率"的公开批判（naive 95.7% 论证）；arXiv:2601.06371（TSFM 零样本胜 USDA 月度农产品基准，但无牛肉——MT 场景即增量） | §3.4/§3.5【代理】 | 【强化】批 5（叙事弹药已登记 M6 教训；本三条补"业界实践"侧） |
| R8 | **工程借镜两条**：① AutoGluon GreedyEnsemble（Caruana 贪心带放回）机制可在自有 9 模型上以约百行并入现有质量加权共识（备选增强，非必需）；② Qlib Alpha158 式"外生特征表版本化"供批 3 领先指标管线参照（特征工程与模型解耦）。另备注：Alberta 育肥牛月度价上 RF/AdaBoost 胜 SARIMA——树模型是 MT 未试过的一族，若批 1 回测框架参数化，可作为零依赖扩展 | §2.4/§4.4/§3.3【代理+转述】 | 【新增登记（低优先）】不改批次排序；批 1 回测框架是它们的前置 |

**总判断**：三路外部证据与 MT 现行架构方向完全一致——"统计基线为锚 + 预训练 TSFM 为委员会成员 + 组合/门禁/公开档案"就是量化金融（M4/组合之谜/回测卫生）与农产品界（USDA 混合制、Expana 技能分批判、基差分解）的公约数。**本轮没有发现任何"必须改道"的信号；也没有发现"被错过的机会"——最接近的一条（chronos-2 协变量）已在 round-138 按门禁测过并关闭。增量集中在验证指标（R1/R2）、重评窗口的确权事实（R3/R4）、建模候选（R5）与叙事（R7）四个外围面。** 数值预测继续不用聊天 LLM（§2.3 区分经两篇原文复核成立）。

---

## 附录 A：证据清单

**本地实测（2026-08-31 05:24-05:27 UTC）**：

- 服务面：`pm2 list`（三进程 online/↺/RSS）；`curl :8000/health`、`:3000`、`:10810/health`、`:10810/ready`、`:10810/models`；`ss -ltnp`；`redis-cli ping`
- 数据面：psql 查询 commodity_prices/beef_cut_prices 最新 date 与行数；prediction_logs 按 model_id×status/interval 聚合、percentile_cont 中位/p90、beef_carcass_us 21 行明细、62 commodity 池 slug 清单
- 代码面：`inference_engine.py`（CHRONOS_VARIANTS/Bolt 注释/seed/semaphore/pipeline cache/readiness）、`statistical_models.py`（6 模型实现与退化路径）、`modelRegistry.ts`（ALL_MODELS/BASELINE_MODELS 与排除理由）、`tradingSignals.ts`（质量加权投票/加权中位数/±1% 方向）、`modelQuality.ts`（权重/淘汰/激活门槛）、`mapeTracking.ts`（验证生命周期/对账锚）、`predictionCache.ts`（30min 刷新/TTL 45min）、`backtesting.ts`（7/30/90 窗）、`signals.ts:95-115`（公开 track-record 白名单）
- 依赖面：`pip show chronos-forecasting 2.3.1 / torch 2.12.1+cpu / statsmodels 0.14.6 / sktime 1.0.1`
- 外部（主调研亲测）：amazon-science/chronos-forecasting/releases（v2.3.1=最新、无 input_patch_size 修复条目、Chronos-2 于 2.1.0+ 支持）

**外部（代理取证，2026-08-31）**：正文各节内联 URL；分级标注随行。转述级条目（M4/组合之谜/DSR/PBO、Payne & Karali、Bessler、ABARES、DTN）未逐一复核原文，引用时注明"转述"。

## 附录 B：局限与未验证项

1. **子代理转述条目未逐一复核**：§2.1（M4 等权平均结论）、§3.2（Payne & Karali）、§3.4（ABARES）等为二手；如需对外引用，先按 URL 核原文。
2. **arXiv:2601.06371 只读了摘要页**：TSFM 胜 USDA 基准的数字（小麦 54.9%）未读全文复核；且其"月度长序列（~340 点）"与 MT 195 点的差距未做敏感性分析。
3. **Chronos-2 CPU 吞吐无正式数字**：HF 卡只给 A10G 300+ 条/s；round-138 臂 B 在本机 CPU 实际跑通过（说明可行性），但未记录吞吐/延迟基线——若 2028-11 重评，补测一次即可。
4. **Bolt 不兼容的复现未做**：本轮只确认"最新版无修复记录"，未实际装 bolt 权重复现 `input_patch_size` 报错（无必要——chronos-2 路径优先）。
5. **MLA Projections PDF 内是否有数值预测**：索引页无，未下载 PDF 核实。
6. **中国进口商 CME 对冲案例**：公开文档未找到，标注【未核实】；不影响本报告结论。
7. releases 页日期为相对显示（"02 Jul"无年份），版本时序按 v 号排列推断；v2.3.1=最新与 pip show 一致（【实测】交叉验证）。
8. **外部快照时效**：全部外部取证为 2026-08-31 单日快照；模型版本/许可可能变化，动手前重核（尤其 TimesFM 3.0 许可）。
