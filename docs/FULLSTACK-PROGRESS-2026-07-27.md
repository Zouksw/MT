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

## 当前已知缺口（本轮明确不做）

- **billing 无支付后端**（PLANS 硬编码，/cancel 仅改 plan 为 free）——超出本轮范围
- **API-key scraper 待激活**（DATA-1 MLA + G6 USDA-AMS）——需用户提供 key
- **18 个 scraper 零单测**——独立大工程
- **settings/sessions + notifications 用 mock/localStorage**——非核心路径

## 部署健康（2026-07-27 实测）

| 服务 | 端口 | 状态 |
|---|---|---|
| backend | 8000 | ✅ `/health` 200 |
| frontend | 3000 | ✅ |
| inference | 10810 | ✅ `/health` 200, `/ready` ready:true |
| postgres | 5432 | ✅ |
| redis | 6379 | ✅ |
