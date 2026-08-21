# deploy/attic — 归档的部署描述（未启用，已漂移）

> TD-15 处置（2026-08-21，round-114）：从仓库根归档至此。**这些文件不描述
> 本项目的实际运行方式**，且与实际环境已互相漂移。新人/AI 代理请勿依据它们
> 理解架构。

## 实际拓扑（唯一事实）

- **PM2 三进程**：mt-backend / mt-frontend / mt-inference（`ecosystem.config.cjs`）
- **数据库/缓存**：宿主机 systemd 的 PostgreSQL 14.23 与 Redis 6.0.16
  （`docker ps -a` 零容器；compose 栈声明的 PG15/Redis7 从未在本机运行）
- **CI/CD**：GitHub Actions `appleboy/ssh-action` → `scripts/deploy.sh`（PM2 路径；
  ci.yml 与 deploy.sh 中 helm/kubectl/docker 引用数为 0）
- **日志轮转**：`/etc/logrotate.d/trademind`（系统 logrotate）
- **开机自愈**：`systemd mt.service`（`pm2 resurrect`，2026-08-21 已安装启用）

## 归档清单与漂移证据（2026-08-20 实测）

| 文件 | 状态 |
|---|---|
| `docker-compose.yml` | 从未运行；compose 声明的 DB 用户 `mt` 与实际 `.env` 的 `mt_user` 不符 |
| `helm/`（11 文件） | 无任何流水线引用 |
| `docker/`（2 个 Dockerfile） | 仅被 compose build 引用 |
| `nginx/` | 仅被 compose 的 nginx 服务挂载；宿主机 80 端口无 nginx |

## 恢复方法

若未来决定真正容器化或上 k8s：`git mv` 回原位并按当时的实际拓扑重写——
归档物与 2026-08 的现实（systemd PG14/Redis6、无容器）不一致，直接启用会失败。
