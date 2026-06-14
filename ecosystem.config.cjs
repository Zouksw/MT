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
      dotenv_config_path: path.join(ROOT, 'backend/.env'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
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
  ],
};
