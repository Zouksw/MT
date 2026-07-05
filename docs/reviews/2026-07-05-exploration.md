# MT 项目全面探索报告 — 运营/架构/功能完整性

> **日期**: 2026-07-05 | **方法**: ops-check(运营健康)+ investigate(inference 根因)+ 数据实测
> **状态**: 6 轮开发已完成(架构债清零、测试基建稳固)

---

## 一、运营健康(ops-check 巡检)

```
OPS STATUS — 2026-07-05
═══════════════════════════════════════
Mode: PM2
frontend:  [UP :3000]   restarts: 0   uptime: 14h
backend:   [UP :8000]   restarts: 4   uptime: 2m   /health: 200
inference: [DOWN :10810]              /health: 拒绝连接 ⚠️
postgres:  [UP :5432]    SELECT 1 OK
redis:     [UP :6379]    PONG
nginx:     (host, 未检)
═══════════════════════════════════════
```

**关键发现**:
- ✅ backend/frontend/postgres/redis 全健康
- ⚠️ **inference 服务(10810)完全未运行** — 这是平台 AI 功能(预测/异常检测)的核心

---

## 二、inference 服务根因(investigate)

### 根因
venv 严重损坏:**多个包的 `core.py` 文件缺失**。
- `click.core` 缺失 → uvicorn 无法启动
- `pip._vendor.idna.core` 缺失 → pip 自身损坏,无法自修复
- 这与 Round 5 的 js-yaml 损坏同源 — **疑似 pnpm prune 或磁盘清理误删了 .py 文件**(保留 package.json/metadata 但删了 .py 实现)

### 修复方案
重建 venv:`rm -rf venv && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`。无需改代码,纯环境修复。

### 影响
- backend 每 30 分钟调度 110 商品预测 → 队列 worker 连不上 inference → **所有 AI 预测静默失败**
- /api/models/:id/predict、/api/inference/predict 等端点返回 500/超时
- prediction_logs 表停止增长(无新预测验证)

---

## 三、数据源实际状态(实测,非旧调研)

### 与 Round 3 诊断的差异
Round 3 判定 dce/fao/usda/baltic 等"端点全失效",但**实测最近 24h 它们报 success**(仅偶发 warning)。这说明:
- 端点**间歇可达**(非永久失效),但产出 0 行(warning = inserted=0/updated=0)
- fred/weather 的"缺 key"在 Round 3 的诚实标记下正确显示为 **error**(验证修复生效)

### 当前数据源健康
| 状态 | 源 | 说明 |
|------|----|------|
| ✅ 真产数据 | commodity_prices(17)/cme_futures(6) | 汇率 + FRED 公开 CSV |
| ⚠️ success 但 0 产出 | abares/argentina/cepea/dce/fao/inac/mla/secex/usda_psd/shipping 等(各4次) | 端点可达但返回空,可能解析逻辑问题或数据源改版 |
| ❌ error(缺key) | fred(2)/weather(2) | key 空,诚实标记生效 |

---

## 四、架构债(C 线)几近清零

6 轮重构后:
| 指标 | 起点 | 当前 |
|------|------|------|
| 胖路由(>600行) | 6 | **1**(仅 metrics 657) |
| 已抽 service | 0 | **5**(auth/market/anomaly/dataset/model) |
| 路由直连 Prisma | 208 | **~75** |
| 测试 429 假失败 | 存在 | **0** ✅ |
| 死代码 | 多处 | i18n/social/14死组件/8死函数 清除 |

代码量:61,018 行(backend + frontend),累计 683 文件变更。

---

## 五、剩余技术债

| 项 | 现状 | 工作量 |
|----|------|--------|
| metrics.ts(657行) | 有状态单例(endpointMetrics Map),需"状态化 service"新样板 | 中 |
| Next.js 15.5.15→15.5.18 | 修 DoS/middleware bypass/SSRF high 漏洞 | 小(patch) |
| 设计 token 化 | 219 处硬编码(多数图表 stroke,类里 ~27 处) | 小-持续 |
| 依赖漏洞 | 后端 16 + 前端 35(多 high) | 中 |
| a11y(L9) | 62 个 Input 仅 10 个 label | 中 |
| CSP `unsafe-inline`(L10) | security.ts | 小 |

---

## 六、产品定位完成度

| 功能 | 定位目标 | 状态 |
|------|---------|------|
| Simulation | 回测工具 | ✅ B1 删除伪交易,/ai/backtest 唯一入口 |
| Portfolio | 分析分组 | ✅ B2 去交易语义 |
| Billing | AI 分层 | ✅ B3 修 M7,VIEWER 拦截 |
| 数据覆盖 | 60%+ | ⚠️ 34.5%(A 线暂缓,部分源 0 产出) |
| AI 预测 | 8 模型 | ⚠️ inference 服务 DOWN(venv 损坏) |
