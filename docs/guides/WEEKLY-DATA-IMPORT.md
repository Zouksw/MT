---
title: "牛肉价格数据周度导入 Runbook"
en_title: "Weekly Beef Price Import Runbook"
version: "1.0.0"
last_updated: "2026-08-23"
status: "active"
maintainer: "MT Team"
tags:
  - runbook
  - data-ops
target_audience: "Operator (ADMIN)"
related_docs:
  - "Known Issues D1/D4": "../KNOWN-ISSUES.md"
  - "Improvement Plan": "../IMPROVEMENT-PLAN.md"
---

# 牛肉价格数据周度导入 Runbook

> **为什么有这份手册**：`beef_cut_prices` 自 2026-04-30 冻结（KNOWN-ISSUES D1：爬虫源被网络封锁 + 4 个空 API key）。在源复活之前，**CSV 手动导入是核心数据解冻的唯一路径**（round-81 已验证）。目标：把"想起来才补"变成**每周固定 30 分钟的节律**。本手册写成第三方可照做的程度。

## 一、节奏与提醒

- **频率**：每周一次（建议固定周一上午，覆盖上周 5~7 个交易日的报价）。
- **耗时**：数据在手 10~15 分钟；含下载核对约 30 分钟。
- **提醒**：建议在个人日历设每周重复事项（平台侧暂无自动提醒；dashboard freshness 板可事后核对，见 §五）。

## 二、数据从哪来（按优先级）

现有 2401 行历史数据的两个来源，周度可续：

| 源 | 已入库口径 | 获取方式 |
|----|-----------|---------|
| MLA NLRS（澳大利亚） | `mla_nlrs`，1440 行 | mla.com.au 的 NLRS 周度价格报告（公开页导出，具体下载入口**待运营确认后补此处链接**） |
| CEPEA（巴西，出口报价） | `cepea_export`，960 行 | cepea.esalq.usp.br 牛肉出口周报（公开页，同上待补直链） |

> 诚实边界：两个源的具体导出 URL 由运营首次使用时核实后回填本表；未核实前不写死链接。其他源（USDA AMS 等）在 key 到位后由爬虫自动恢复，不占用本节律。

## 三、准备 CSV

1. 用 ADMIN 账号登录 → **/beef/import** 页面 → 点 **Download CSV template**（即 `GET /api/beef/import/template`）获得模板。
2. 按行填写（页面上的 Contract 卡片即校验规则）：

   | 列 | 必填 | 格式 | 说明 |
   |----|------|------|------|
   | `factoryCode` | ✅ | 如 `AU-847` | 必须是已登记工厂码，页面 Reference 表可查（`GET /api/beef/factories`） |
   | `cutCode` | ✅ | 如 `BRISKET_POINT` | 必须是已登记部位码（`GET /api/beef/cuts`） |
   | `price` | ✅ | 数字，如 `8.45` | |
   | `date` | ✅ | `YYYY-MM-DD` | |
   | `currency` | ⬜ | 如 `USD`（默认） | |
   | `unit` | ⬜ | 如 `USD/kg`（默认） | |
   | `grade` | ⬜ | | |

3. 注意事项：
   - **不要混单位**——同一工厂+部位的历史序列若以 USD/kg 记录，续入请保持同单位（round-115 起 upsert 有 >20× 中位数的价格尺度护栏，混单位会被拒并留 warn 日志）。
   - 日期用真实报价日，不是导入日。

## 四、导入与即时反馈

1. 在 /beef/import 拖入 CSV → 提交（`POST /api/beef/import`，仅 ADMIN）。
2. 页面返回 ImportResultTable：inserted / updated / 错误行明细。**updated 不是坏事**——重传同周数据会幂等更新而非重复插入。
3. 任何被拒行按提示修正后重传即可（导入是事务性的，坏行不会半写入）。

## 五、导入后验证（一键版优先）

**一键版（round-129 批 10）**：`cd /root/backend && npx tsx scripts/verify-beef-import.ts`——打包下列全部检查，另含 runbook 原缺的两项：**行数增量**（对上次验证的基线，基线存 `/root/.mt-healthcheck/beef-import-baseline.json`）与**近 14 天工厂/部位覆盖**。退出码 0=PASS（允许 WARN），1=FAIL。以下 SQL 为其等价展开，供人工排查用：

```bash
cd /root/backend && set -a && source .env && set +a && psql "${DATABASE_URL%%\?*}" -P pager=off

-- 1) 覆盖与新鲜度：最新日期应为本导入周期的最后一个报价日
SELECT source, count(*) n, max(date)::date latest FROM beef_cut_prices GROUP BY 1 ORDER BY latest DESC;

-- 2) 日期域完整：本周应有 5~7 个不同日期
SELECT count(DISTINCT date) FROM beef_cut_prices WHERE date >= date_trunc('week', current_date);

-- 3) 无重复（同工厂+部位+日期+来源应唯一）
SELECT "factoryId", "cutCode", date, source, count(*)
FROM beef_cut_prices GROUP BY 1,2,3,4 HAVING count(*) > 1 LIMIT 5;   -- 期望 0 行
```

再核对 dashboard（/dashboard 热门部位表"今日价"列恢复数字、/settings/data-sources 的 beef 类源不再是 stale）。

## 六、失败处置

| 症状 | 处置 |
|------|------|
| 页面 403 | 用的不是 ADMIN 账号；换管理员或让现有 ADMIN 在 /settings/users 提权 |
| 某行被拒 "unknown factory/cut code" | 对照页面 Reference 表改码；新工厂/新部位目前**无管理 UI**，需在 `beef_cut_taxonomy` / 工厂表直接插行（或让开发加一条 seed），登记后重传 |
| 价格被 scale-guard 拒（>20× 中位数） | 十有八九是单位错了（$/吨 vs $/kg），修正单位或换算后重传 |
| 导入成功但 dashboard 仍旧价 | 30~300s 路由缓存；刷新或等一个周期；freshness 板核对 `latest` |

## 七、回滚

CSV 导入是 upsert（无删除）。若误传错误价格：按 (factoryId, cutCode, date, source) 定位行，用**同键正确值重传覆盖**即可；整批灾难性错误时从 `backups/` 最近快照恢复（`scripts/backup.sh` 每日产物），恢复流程见 DEPLOYMENT-CHECKLIST。

## 八、本节律的退出条件

任一爬虫源复活（MLA/USDA key 到位且网络可达——KNOWN-ISSUES D1 解除）后，该源部分自动回归爬虫，人工只覆盖爬虫拿不到的口径；全部源复活则本 runbook 转为备份手段。
