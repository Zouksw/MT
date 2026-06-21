# MT 项目性能基准报告 (Round 3 — Benchmark)

> **日期**: 2026-06-14
> **方法论**: benchmark skill (API 延迟基线 + 数据库索引分析 + bundle 解析)
> **状态**: 基线已建立,2 项性能问题已修复

---

## 执行摘要

| 维度 | 基线 | 修复后 | 改善 |
|------|------|--------|------|
| 后端 API 延迟 (12 端点) | 1-25ms | 不变(已健康) | — |
| prediction_logs 热查询索引 | 缺 2 个复合索引 | 已补 | 回测查询 6×/请求 走索引 |
| 前端 First Load (非图表页) | 411 KB | **325 KB** | **−86 KB (−21%)** |
| 前端 First Load (/trading 图表页) | 478 KB | **392 KB** | −86 KB |
| commons chunk | 1012 KB (含 recharts) | 656 KB (recharts 分离) | −35% |
| 数据库索引总数 | 104 | 106 (+2 复合) | — |

---

## Benchmark 1: 后端 API 延迟(健康 ✅)

各核心端点 5 次取平均(种子数据量,10k 价格行):

| 端点 | AVG | MAX |
|------|-----|-----|
| `/health` | 1ms | 1ms |
| `/api/market-data/commodities` | 2ms | 3ms |
| `/api/beef/cuts` | 5ms | 9ms |
| `/api/signals/models/accuracy` | 6ms | 19ms |
| `/api/auth/me` | 8ms | 23ms |

**结论**: 无慢端点。当前数据量下全部 <25ms。注意这是种子数据量(10k 行),生产数据量增长后需复测。

---

## Benchmark 2: 数据库索引分析 → 已修复 ✅

### 发现:prediction_logs 缺 2 个高频查询的复合索引

**热查询模式**(`signals.ts`、`backtesting.ts`、`mapeTracking.ts`):
- `WHERE modelId = ? AND status = "verified"` + `ORDER BY verifiedAt DESC`
- 每个**回测请求触发 6 次此查询**(3 窗口 × list+count)
- 原仅有单列 `modelId` 索引 → 每次过滤后需内存重排

### 修复:新增 2 个复合索引

```sql
-- migration 20260614_add_prediction_logs_indexes
CREATE INDEX prediction_logs_model_id_status_verified_at_idx
    ON prediction_logs (model_id, status, verified_at DESC);
CREATE INDEX prediction_logs_commodity_id_predicted_at_idx
    ON prediction_logs (commodity_id, predicted_at);
```

**验证**: `pg_indexes` 确认 6 个索引就位(4 原有 + 2 新增)。

### 其他低优先级索引建议(未改,影响低)
- `beef_cut_prices (source, date)` — 最新价查询(LOW-MED)
- `cold_storage (category, date)` — 仅唯一约束(LOW)
- `ingestion_logs (createdAt)` — dashboard 7 天扫描(LOW)

---

## Benchmark 3: 前端 Bundle → 已修复 ✅

### 发现:recharts 被 webpack 塞进 commons chunk

**根因**: `next.config.mjs` 的 `splitChunks.commons` cacheGroup 用 `minChunks:2` 且**无 test 过滤**,任何被 ≥2 个 chunk 引用的模块都被提升进 commons。recharts(尽管各组件用 `next/dynamic` 导入)因被多个图表组件引用而落入 commons → **所有页面**(login/register/settings)首屏都要下载 recharts。

### 修复:为 recharts/d3 独立 cacheGroup,并从 commons 排除

```js
// next.config.mjs
commons: {
  // 排除重型图表库,不进 commons
  test: (module) => !/[\\/]node_modules[\\/](recharts|d3|lightweight-charts...)[\\/]/.test(...),
},
recharts: {
  name: 'recharts',  // 独立懒加载 chunk
  test: /[\\/]node_modules[\\/](recharts|d3[-a-z]*|...)[\\/]/,
},
```

### 效果(实测)

| 页面 | 修复前 | 修复后 | 节省 |
|------|--------|--------|------|
| `/login` | 411 KB | **325 KB** | −86 KB (−21%) |
| `/register` | 411 KB | **325 KB** | −86 KB |
| `/settings` | 413 KB | **328 KB** | −85 KB |
| `/dashboard` | 416 KB | **331 KB** | −85 KB |
| `/trading` (图表页) | 478 KB | **392 KB** | −86 KB |

recharts 现在是独立懒加载 chunk,**非图表页不再下载它**。

---

## Benchmark 4: 资源占用

| 进程 | 内存 | CPU |
|------|------|-----|
| mt-backend | 125 MB | ~0% (空闲) |
| mt-frontend | 93 MB | ~0% |
| PostgreSQL | (系统服务) | — |
| Redis | (系统服务) | — |

启动时间: backend cold start ~3s, frontend build ~90s。

---

## 验证

| 检查 | 结果 |
|------|------|
| Frontend tsc | ✅ EXIT 0 |
| Backend tsc | ✅ EXIT 0 |
| Frontend Jest | ✅ 301 pass |
| Backend build | ✅ |
| Migration 应用 | ✅ `prisma migrate deploy` 成功 |
| 索引存在性 | ✅ `pg_indexes` 确认 |
| Frontend 重启 | ✅ HTTP 200, 150ms |

---

## 净变化

3 文件:`schema.prisma`(+8 行索引)、`migration.sql`(新增)、`next.config.mjs`(+13 行 cacheGroup)。
0 新增依赖。

*本报告基于 benchmark skill 方法论。索引建议来自查询模式与 schema 的交叉分析;bundle 分析来自实际 webpack build 产物解析。*
