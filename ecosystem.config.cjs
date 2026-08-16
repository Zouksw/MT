/**
 * MT — PM2 Ecosystem (Production)
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 start ecosystem.config.cjs --only backend
 *   pm2 save
 *   pm2 startup   (generates system startup command)
 */

const path = require('path');
const ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'mt-backend',
      script: 'node',
      // Load backend/.env (real secrets) before entry, mirroring the dev script
      // which runs `tsx watch -r dotenv/config`. dotenv is a backend dependency.
      args: '-r dotenv/config dist/server.js',
      // dotenv/config reads cwd/.env, so cwd must be the backend dir
      cwd: path.join(ROOT, 'backend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        // cme_futures scrapes Yahoo Finance, whose edge is IP-blocked direct
        // from this host (bare fetch → ETIMEDOUT; verified 2026-08-14). The
        // local mihomo proxy (systemd, 127.0.0.1:7890) provides egress. Only
        // the Yahoo fetcher reads this — native fetch elsewhere stays direct.
        SCRAPER_PROXY_URL: 'http://127.0.0.1:7890',
      },
      // Logging
      error_file: path.join(ROOT, '.logs/backend-error.log'),
      out_file: path.join(ROOT, '.logs/backend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 15000,
      // Crash recovery
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'mt-frontend',
      script: 'pnpm',
      args: 'start',
      cwd: path.join(ROOT, 'frontend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Internal backend origin the Next server proxies /api/* to
        // (next.config.mjs rewrites). Browser requests stay same-origin.
        API_PROXY_TARGET: 'http://localhost:8000',
      },
      // Logging
      error_file: path.join(ROOT, '.logs/frontend-error.log'),
      out_file: path.join(ROOT, '.logs/frontend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 30000,
      // Crash recovery
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'mt-inference',
      // Python FastAPI inference service — torch/sktime/statsmodels/chronos models
      // for predictions + anomaly detection. Heavy imports; expect ~10s cold start.
      script: path.join(ROOT, 'inference-service/venv/bin/python'),
      args: '-m uvicorn main:app --host 0.0.0.0 --port 10810',
      cwd: path.join(ROOT, 'inference-service'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // 3 Chronos pipelines idle at ~560MB RSS, but each 30-min prediction
      // refresh burst (now 17 commodities × 3 models ≈ 51 POST /predict
      // after the cme revival) pushes CPU-inference buffers past 3.5G at the
      // peak (2026-08-15 05:25: WORKER kill at 3769MB vs 3584M cap, once in
      // 15h — previously the 2G cap killed it every cycle). 4096M covers the
      // larger burst; MALLOC_ARENA_MAX=2 + per-request gc.collect()
      // (routers/predict.py) address the glibc-arena/cycle-retention growth.
      // PM2's size regex rejects decimals — use integer M values.
      max_memory_restart: '4096M',
      env_production: {
        INFERENCE_HOST: '0.0.0.0',
        // Cap glibc malloc arenas — multithreaded torch fragments across the
        // default 8×cores arenas, inflating RSS without real usage.
        MALLOC_ARENA_MAX: '2',
        INFERENCE_PORT: '10810',
        INFERENCE_LOG_LEVEL: 'info',
        // Chronos foundation-model weights. huggingface.co is network-blocked
        // in this env, but the hf-mirror.com mirror is reachable — route all HF
        // downloads through it. HF_HOME pins the cache location so cached
        // weights survive restarts and the availability probe finds them.
        HF_ENDPOINT: 'https://hf-mirror.com',
        HF_HOME: '/root/.cache/huggingface',
      },
      // Logging
      error_file: path.join(ROOT, '.logs/inference-error.log'),
      out_file: path.join(ROOT, '.logs/inference-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown — torch model teardown can be slow
      kill_timeout: 10000,
      listen_timeout: 30000,
      // Crash recovery
      min_uptime: '15s',
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
