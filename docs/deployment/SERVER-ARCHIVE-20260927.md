# 服务器下架保全与复原 Runbook（2026-09-27）

> 服务器移除前的保全记录。**两层**：① 代码/文档/周快照在 git main（github.com/Zouksw/MT，远端无 Release/二进制资产，仓库保持纯代码）；② 不可再生数据核心以**服务器本地文件**形式保全（owner 决定不向 GitHub 传输数据，移除服务器前需自行取走下列文件）。

## 服务器本地的保全文件（移除前务必取走）

| 文件/目录 | 内容 | 大小 |
|---|---|---|
| `/root/server-archive-20260927/` | **精核（明文可直接用）**：`db/mt_db-20260927-slim-schema-and-tables.sql.gz`（全库 schema + 除 prediction_logs 外全部表数据——行情 63k 行、beef_cut_prices 全史含 mla/cepea 冻结 FOB 与 roujiaosuo CNY 现货、users、GACC 厂注册表、因子、资讯）+ `db/prediction_logs_verified_completed.csv.gz`（战绩行 245,402，列序见 `db/prediction_logs.columns.txt`）+ `secrets/`（两份 .env）+ `host/`（crontab/journald/logrotate）+ `legacy/` + `MANIFEST.md`（完整复原步骤） | 64M |
| `/root/mt-server-archive-20260927.tar.gz.gpg` | 上述精核的单文件打包版（tar.gz + gpg AES256；口令在旁侧 `server-archive-20260927.PASSPHRASE.txt`，600 权限） | 61M |
| `/root/backups/mt_db-FULL-final-20260927.sql.gz` | **全量 dump**（多含 prediction_logs 的 stale/unverifiable 169k 历史行） | 88M |
| `/root/backups/`（日备 ×7 + 轮次工作件） | 例行备份栈（KEEP_COUNT=7）；含 round167/136 迁移前快照（81M，低价值可弃） | ~620M |

**取舍**：`prediction_logs` 的 unverifiable/stale 行未入精核（判不了/已作废，复原用不到）；Chronos 权重 / node_modules / venv / dist / .next / Redis 缓存可再生，不保全。

## 复原步骤（新机器）

1. `git clone https://github.com/Zouksw/MT.git && cd MT`（代码/脚本/文档/周快照全在）
2. 取走上表文件后：`tar xzf` 解包版或直接用明文目录 `server-archive-20260927/`
3. PostgreSQL 14+ 建角色/库后两步还原（或直接用全量 dump 一步）：
   `zcat db/mt_db-20260927-slim-schema-and-tables.sql.gz | psql -h localhost -U mt_user -d mt_db`
   `zcat db/prediction_logs_verified_completed.csv.gz | psql -h localhost -U mt_user -d mt_db -c "\copy prediction_logs ($(cat db/prediction_logs.columns.txt)) FROM stdin CSV HEADER"`
4. `cp secrets/backend.env backend/.env && cp secrets/frontend.env.local frontend/.env.local && chmod 600 backend/.env frontend/.env.local`
5. backend/frontend 分别 `pnpm install` + `npx prisma generate` + `pnpm run build`；inference-service 建 venv 装 requirements
6. `pm2 start ecosystem.config.cjs --env production`
7. 验证：`:8000/health` / `:3000` / `:10810/health` 三端点 200

主机配置按需：`crontab host/crontab-root.txt`、journald drop-in、logrotate（详见包内 MANIFEST.md）。

## 经过记录

- 精核打包 + 加密后曾尝试经 GitHub Release 分片外传（92M 整包/30M/8M 分片均被出口链路约 90 秒掐断），owner 指示停止上传、仓库保持干净——Release 与 tag 已删除，远端无任何二进制残留。
- 数据外传通道实测受限：如后续仍需异地保全，建议从更宽上行带宽的环境取走上述文件（scp/SFTP 直连或对象存储），而非经本机 HTTPS 上传。
