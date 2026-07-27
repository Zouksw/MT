# 全栈推进记录 — round 17-21（2026-07-27）

**性质**：4 轮并行审计（前端/后端/inference）驱动的针对性修复 + 真实数据注入闭环。每批独立 commit + 测试 + live 验证。
**测试基线**：backend vitest **573 pass** | frontend jest **277 pass** | inference pytest **21 pass** = **871 tests total**。

---

## 核心成果：真实数据注入闭环已打通

**这是本轮最重要的成果。** 后端 `POST /api/beef/import`（CSV 解析 + 校验 + 幂等事务 upsert）之前已完整实现但前端**零调用**——用户无法从 UI 注入真实牛肉数据。现在闭环已打通：

```
管理员 /beef/import → 拖拽上传 CSV → POST /api/beef/import
   → parseBeefCSV (BOM/CRLF/表头归一化)
   → importBeefPrices (校验 factoryCode/cutCode/price/date + 事务包裹)
   → BeefCutPrice upsert (source='manual:<uploader>')
   → freshness 框架分类为 'live' (recent, non-bridge, non-seed)
   → honesty gate 放行 → chronos 集成预测解锁
```

**实测验证**：管理员上传 1 行 CSV → `imported:1` → `/api/beef/prices/latest` 显示 `freshness:live` → `/api/beef/forecasts/STRIPLOIN` 返回 chronos 集成（3 变体，direction:up）。全链路真实，非假活。

**对"在哪里注入真实数据"的最终答案**：两条路径并存——
1. **管理员 CSV 上传**（已可用，无需 API key）——`/beef/import` 页
2. **API key scraper**（待用户提供 key）——`MLA_API_KEY`(AU) + `USDA_MARS_API_KEY`(US)

---

## 批次 17 — 真实数据注入 UI

| 文件 | 变更 |
|---|---|
| `backend/services/beefImport.ts` | 事务包裹（`prisma.$transaction`）+ 1ms 容差 insert/update 判定 |
| `backend/routes/beef.ts` | 新增 `GET /import/template` CSV 模板下载 |
| `frontend/components/beef/CSVDropzone.tsx` | 可复用拖拽上传组件（首个文件输入 pattern） |
| `frontend/hooks/useBeefImport.ts` | FormData 上传 hook（auth + 403 友好提示） |
| `frontend/components/beef/ImportResultTable.tsx` | 导入结果摘要 + 逐行错误表 |
| `frontend/app/beef/import/page.tsx` | 管理员导入页（dropzone + 模板 + 工厂/部位速查表） |
| `frontend/app/beef/page.tsx` | 空状态加"Import prices via CSV" CTA + 页头 Import 按钮 |

**新增测试**：+14（CSVDropzone 6, ImportResultTable 3, useBeefImport 5）

---

## 批次 18 — 诚实性修复

| 问题 | 修复 |
|---|---|
| `models.ts` 硬编码 `anomalyProbability:0`/`isAnomaly:false` 写入每条预测 | 改为 `null`（schema 允许）——诚实表示"此路径未评估异常"，而非假装"0%概率绝对不是异常" |
| `anomalies.ts` `getUser` 未认证时返回幽灵 UUID | 改为抛错（defense-in-depth，所有调用方已在 authenticate 后） |
| `useTradingData.ts` AI 信号失败被空 catch 吞掉，setError 从不调用 | catch 块调用 setError，trading 页 ErrorDisplay 实际渲染错误 |
| `ai/anomalies/page.tsx` `credentials:"include"` 放在 headers 内 | 移到 fetch options 顶层（cookie 正确发送） |

---

## 批次 19 — 推理引擎健壮性

**输入校验**（`routers/predict.py`）：
- `values` 加 `max_length=10000`（OOM 防护）+ `field_validator` 拒绝 NaN/inf（422 非 500）
- `/predict/batch` 上限 50（顺序执行，防阻塞）
- 错误映射精细化：engine `ValueError`→422（客户端错误）、`RuntimeError`→503（服务降级）、其他→500

**就绪探针**（`routers/health.py` + `services/inference_engine.py`）：
- 新增 `GET /ready`：返回 chronos 就绪状态，至少 1 个变体（权重缓存 + pipeline 加载 + 无 preload 失败）才 `ready:true`，否则 503
- `readiness_state()` 暴露 usable/loaded/failures/ready_variants
- `main.py` preload 失败记录到 `_preload_failures`（不再静默 warning）

**新增测试**：+12（test_predict 6, test_health 4, test_inference_engine 3）——chronos quantile 切片逻辑首次有测试覆盖

**实测**：`/ready` 返回 `ready:true` + 3 变体 loaded；超长输入拒绝 422

---

## 批次 20 — 鉴权一致性

**补全缺失鉴权**（OpenAPI 标 security 但实际无 authenticate）：
- `models.ts`: `GET /`, `GET /:id`, `GET /:modelId/forecasts`
- `timeseries.ts`: `GET /:id`, `GET /:id/data`
- `anomalies.ts`: `GET /:id`, `GET /stats/timeseries/:timeseriesId`

**设计决策**：`/api/beef/forecasts` + `/api/signals/*` 保持 `authenticate`（不加 checkAIAccess Pro 门控）——它们是公开 `/beef` 市场页的核心价值，Pro 门控会让免费用户失去预测列（回归）。AI 分层（inference/models = Pro；signals/beef = 任意登录用户）是有意的产品分层。

**train stub 退休**：`inference.ts POST /models/train` 原返回 canned `{status:"ready"}`（假装训练了），改为 410 Gone + 诚实说明（架构是预训练模型，无需训练，用 /predict）

**实测**：未认证 GET 上述端点 → 401；`/models/train` → 410

---

## 当前已知缺口（对照 PRODUCT-SPEC §九）

**注**：以下分类严格对照 `docs/PRODUCT-SPEC.md` 的"明确不做"边界。
billing/支付/订阅**不是缺口，是明确的设计决策**（§九："❌ 付费墙/订阅"）——
本项目是牛肉贸易**信息平台**（类牧集网 × IoTDB AINode），**不是交易平台**，
没有交易撮合，也不需要支付后端。billing 路由保留的静态 PLANS 仅作 UI 占位。

### 明确不做（PRODUCT-SPEC §九，非缺口）
- ❌ 交易撮合（信息平台定位）
- ❌ 付费墙/订阅（billing 已降级为静态占位，AI 分层留待用户基数）
- ❌ 非牛肉商品进主 IA（crude_oil/gold 留在数据层）
- ❌ 用户生成内容/社区

### 待用户输入才能推进
- **API-key scraper 激活**（DATA-1 MLA_API_KEY + G6 USDA_MARS_API_KEY）——
  真实牛肉数据的自动采集路径。但管理员 CSV 上传（批次 17）已提供不依赖
  key 的替代注入路径。

### 后续可做（未阻塞，但超出本轮范围）
- 资讯模块（M3，PRODUCT-SPEC §5.4——market dynamics feed，需后端模型）
- 18 个 scraper 单测覆盖（独立工程）
- settings/sessions + notifications 的 mock/localStorage 改为真实后端
  （非核心路径，且 sessions/notifications 不影响信息平台核心价值）

## 部署健康（2026-07-27 实测）

| 服务 | 端口 | 状态 |
|---|---|---|
| backend | 8000 | ✅ `/health` 200 |
| frontend | 3000 | ✅ |
| inference | 10810 | ✅ `/health` 200, `/ready` ready:true |
| postgres | 5432 | ✅ |
| redis | 6379 | ✅ |

---

# 全栈推进记录 — round 25-29（2026-07-27 续）

**性质**：3 轮并行审计（CI/CD + 预测管道 + 测试体系）驱动的自动化基础设施补齐。不造新功能，让既有护栏生效。每批独立 commit + 测试 + live 验证。
**测试基线**：backend vitest **579 pass**（+5）| frontend jest **278 pass** | inference pytest **21 pass** = **878 tests total**（+7）。

---

## 核心成果：inference-service 首次进入 CI 保护

**这是本轮最重要的成果。** inference-service（6 模型 + chronos + FastAPI）此前完全游离于 CI 之外——`.github/workflows/ci.yml` 无任何 Python job，模型替换/路由变更无回归守门。现在：

```
push/PR → test-inference job
  → setup-python 3.10
  → pip install requirements.txt + requirements-dev.txt
  → ruff check . （lint，零容忍）
  → pytest -q （21 测试）
```

`test-inference` 与 test-backend/test-frontend 平行，纳入 `build.needs` 作为部署前置门。inference 侧从此和 TS 侧享有同级的 CI 保护。

---

## 批次 25 — inference-service 接入 CI

**缺口**：ci.yml 零 Python 内容。

**改动**：
- 新建 `inference-service/pyproject.toml`：`[tool.ruff]` 配置（target py310, line-length 100, select E/W/F/I/UP；非打包文件，纯工具配置）
- `requirements-dev.txt` 加 `ruff>=0.6`
- ci.yml 新增 `test-inference` job + build.needs 加入
- 修复全部 20 个 ruff baseline 违规（5 import 排序、2 unused import、1 unused var、12 E501）

**验证**：`ruff check .` 全绿；`pytest -q` 21 passed。commit `d2063a0`。

## 批次 26 — lint 落地 + 残留清理

**改动**：
- 删除 `backend/jest.setup.js`（vitest 已用 `src/test-setup.ts`，jest.setup.js 冗余）
- 移除 backend `@typescript-eslint/*` 残留依赖（实际用 biome）
- 激活 knip：新建 `knip.json`（backend/frontend workspace 配置）+ 加 knip 脚本

**dead code 处理结论**：`invalidateCommodityCache`（零调用）、`unsubscribeCommodity`（仅测试用）无生产调用方，但可能是功能缺口（数据导入后缓存未失效），记录待查不擅自删。

**验证**：type-check 通过；574 测试全绿。commit `8e3e0a1`（实际哈希见 git log）。

## 批次 27 — readiness 集成

**缺口**：inference 有 `/ready`（chronos 不可用返 503），但 backend 只探 `/health`（liveness），无法区分"进程挂了"vs"chronos 降级"。

**改动**：
- `client.ts` 新增 `checkReadiness()`：先 /health 判存活，再 /ready 判 chronos。返回 `{alive, ready, readyVariants, detail}`
- `health.ts` /ready 端点升级：`checks.inferenceDetail = {alive, ready, readyVariants}`
- `response.ts` ErrorDetail.checks 放宽允许嵌套对象
- 新增 `inferenceClient.test.ts`：5 个单元测试

**Live 验证**：
```json
"inferenceDetail": {
  "alive": true, "ready": true,
  "readyVariants": ["chronos_tiny", "chronos_mini", "chronos_base"]
}
```
commit `9b8af4c`。

## 批次 28 — cron 监控 inference

**缺口**：cron-healthcheck.sh 探测 backend+frontend 但不探 inference。inference 进程挂起时 PM2 兜不住。

**改动**：加 inference(10810) /health 探测 + 自动重启。故意只探 /health 不探 /ready（chronos 冷加载 90s 期间 /ready 返 503 是预期）。

**重新定位说明**：原计划的 coverage 阈值硬化因本地 node_modules 损坏（test-exclude/minimatch）无法安全验证而推迟；MAPE E2E 守护测试经核查已在批次 22 完成。转向确定可验证的 cron 增益。commit `89229fa`。

## 批次 29 — 文档收尾

新建 `docs/AUTOMATION-STATUS.md`：自动化基础设施全景图（CI 7 jobs、crontab 5 条、应用内 setInterval 3 层、PM2 3 进程、测试体系、质量工具、已知限制）。

---

## 部署健康（2026-07-27 round-29 实测）

| 服务 | 端口 | 状态 |
|---|---|---|
| backend | 8000 | ✅ `/health` 200, `/health/ready` 返回 inferenceDetail |
| frontend | 3000 | ✅ |
| inference | 10810 | ✅ `/health` 200, `/ready` ready:true（3 变体） |
| cron-healthcheck | - | ✅ 3 服务全监控 |

