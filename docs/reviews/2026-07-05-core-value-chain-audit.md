# 核心价值链审计 — AI 预测 / 数据 / 分析

**Date:** 2026-07-05
**目的:** 在重排 ROADMAP 前，核实"AI 预测 + 数据 + 分析"这条核心价值链的真实运行状态（不凭假设）

## 审计结论：整条链多处断裂，平台当前实质上不产出任何分析结果

| 环节 | 名义状态 | 真实状态 | 严重度 |
|---|---|---|---|
| AI 模型实现 | 8 模型 | ✅ 真实（统计 5 个 + LSTM/Transformer 在线训练 + Chronos 预训练）| — |
| 预测调度 | 每 30min × 110 商品 | ⚠️ 调度在跑，但 **0 条成功落库** | 🔴 |
| prediction_logs | 应有预测记录 | **1066 条全部 pending，0 completed，0 failed** —— 卡死在中间态 | 🔴 |
| forecasts 表 | AI 预测产出 | **0 行** | 🔴 |
| anomalies 表 | 异常检测产出 | **0 行** | 🔴 |
| 商品数据覆盖 | 108 商品 | **仅 38/110 有价格数据（35%），72 个完全空** | 🔴 |
| 市场因子 | 131 个 | **仅 1 个 distinct type，45 行**（实际只采到 1 类因子）| 🔴 |

## 断裂点定位（从日志直接证据）

**断裂点 1 — 预测因"数据不足"全部失败（根因在数据层）**
```
Prediction failed for sundial: Insufficient price data for commodity ...: 1 points
Prediction failed for holtwinters: Insufficient price data ...: 0 points
```
72 个商品 0 价格点 → 预测无输入 → 失败。这解释了 forecasts/anomalies 为 0。

**断裂点 2 — 即便有数据的商品，ARIMA 也崩（inference 侧 bug）**
```
Prediction failed for arima: Inference service 500:
  "Prediction failed: too many indices for array: array is 0-dimensional, but 1 were indexed"
```
即便 crude_oil_cme 有 10193 条价格，批量调度里的 ARIMA 调用仍 500。这是 inference 服务的 numpy 维度 bug（手工 curl 单条不触发，批量调度走的数据路径触发）。

**断裂点 3 — prediction_logs 卡在 pending**
1066 条预测记录全部是 `status=pending`，既没标 completed 也没标 failed —— 说明 predictionQueue worker 在某处静默吞掉异常，没回写最终状态。队列"在跑"但不推进。

## 核心价值链现状（一句话）

> AI 模型是真的、调度在跑、inference 服务能响应，但 **从数据采集到预测落库整条链是断的** —— 72 个商品无数据 + ARIMA 维度 bug + 队列状态不回写 = 平台当前产出 **0 条预测、0 条异常、0 条信号**。用户看到的前端展示全是空壳。

## billing 降级确认

`billing.ts` 无 Stripe、无支付、无 webhook —— 只是静态套餐配置（free/pro/enterprise 功能列表 + aiAccess 分层）。**按用户决策，billing 降级为静态展示，不再投入开发资源。** 之前的"billing 测试最高优先"判断作废。

## 据此重排的开发优先级（按"先通水管再装修"原则）

链断了，补测试/清漏洞都没意义——**先让核心价值链真的跑通产出**：

1. **修 ARIMA 维度 bug**（inference 服务）—— 阻塞所有有数据商品的预测
2. **修 predictionQueue 状态不回写**—— 1066 条卡 pending，队列形同虚设
3. **数据覆盖**—— 72 个空商品是预测无输入的根因（argentina stub + 脆弱源 0 产出 + 缺失源）
4. **打通后再补**：tradingSignals/backtest 真实运行验证、prediction_logs → forecasts 落库验证
5. **最后**：核心链路有测试保护后，才轮到漏洞清理 / 前端测试
