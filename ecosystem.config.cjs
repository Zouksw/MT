/**
 * IoTDB Enhanced - PM2 Ecosystem Configuration
 *
 * Description: Process management configuration for production deployment
 * Usage:
 *   - Start all: pm2 start ecosystem.config.cjs
 *   - Start specific: pm2 start ecosystem.config.cjs --only backend
 *   - Start in dev: pm2 start ecosystem.config.cjs --env development
 *   - Save: pm2 save
 *   - Startup: pm2 startup
 *
 * Configuration:
 *   - Set PROJECT_ROOT environment variable to override default path
 *   - Set PM2_USER environment variable to override default user (default: node)
 *   - Set IOTDB_ENCRYPTION_KEY for encrypted .env files
 *
 * Author: IoTDB Enhanced Team
 * Version: 1.4.0
 *
 * Security:
 *   - Automatically decrypts .env.gpg files before starting services
 *   - Requires IOTDB_ENCRYPTION_KEY environment variable
 *   - Falls back to plaintext .env if .env.gpg not found
 *
 * AI Node Setup:
 *   AI Node is managed separately via scripts/start-ainode.sh and scripts/stop-ainode.sh
 *   For PM2 management, use: pm2 start scripts/start-ainode.sh --name iotdb-ainode
 */

const path = require('path');

// Get project root from environment or use current directory
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname);
// Get user from environment or default to 'node' (NOT root for security)
const PM2_USER = process.env.PM2_USER || 'node';

module.exports = {
  apps: [
    {
      name: 'iotdb-backend',
      script: 'npm',
      args: 'run dev',
      cwd: path.join(PROJECT_ROOT, 'backend'),
      instances: 1, // Use single instance (cluster mode has issues with CommonJS)
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Pre-start script to decrypt .env files
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 8000,
        // Database
        DATABASE_URL: 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced?schema=public',
        // Redis
        REDIS_URL: 'redis://localhost:6379',
        // JWT Secrets
        JWT_SECRET: 'dev-jwt-secret-key-minimum-32-chars-for-development-only',
        JWT_EXPIRES_IN: '1h',
        REFRESH_TOKEN_EXPIRES_IN: '7d',
        // Session
        SESSION_SECRET: 'dev-session-secret-minimum-32-chars-for-development-only',
        // IoTDB
        IOTDB_HOST: 'localhost',
        IOTDB_PORT: '6667',
        IOTDB_USERNAME: 'root',
        IOTDB_PASSWORD: 'root',
        IOTDB_REST_URL: 'http://localhost:18080',
        // AI Node
        AI_NODE_HOST: 'localhost',
        AI_NODE_PORT: '10810',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8000,
        DATABASE_URL: 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'dev-jwt-secret-key-minimum-32-chars-for-development-only',
        JWT_EXPIRES_IN: '1h',
        REFRESH_TOKEN_EXPIRES_IN: '7d',
        SESSION_SECRET: 'dev-session-secret-minimum-32-chars-for-development-only',
        IOTDB_HOST: 'localhost',
        IOTDB_PORT: '6667',
        IOTDB_USERNAME: 'root',
        IOTDB_PASSWORD: 'root',
        IOTDB_REST_URL: 'http://localhost:18080',
        AI_NODE_HOST: 'localhost',
        AI_NODE_PORT: '10810',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8000,
        // All secrets MUST come from environment variables in staging/production
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
        REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        SESSION_SECRET: process.env.SESSION_SECRET,
        IOTDB_HOST: process.env.IOTDB_HOST || 'localhost',
        IOTDB_PORT: process.env.IOTDB_PORT || '6667',
        IOTDB_USERNAME: process.env.IOTDB_USERNAME,
        IOTDB_PASSWORD: process.env.IOTDB_PASSWORD,
        IOTDB_REST_URL: process.env.IOTDB_REST_URL || 'http://localhost:18080',
        AI_NODE_HOST: process.env.AI_NODE_HOST || 'localhost',
        AI_NODE_PORT: process.env.AI_NODE_PORT || '10810',
      },
      // Logging
      error_file: path.join(PROJECT_ROOT, './logs/backend-error.log'),
      out_file: path.join(PROJECT_ROOT, './logs/backend-out.log'),
      log_file: path.join(PROJECT_ROOT, './logs/backend-combined.log'),
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Health check
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 1000,
      // Additional options
      pmx: true, // Enable PM2 monitoring
      automation: false, // Disable auto-deployment
      treekill: true, // Kill process tree
    },
    {
      name: 'iotdb-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: path.join(PROJECT_ROOT, 'frontend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Logging
      error_file: path.join(PROJECT_ROOT, './logs/frontend-error.log'),
      out_file: path.join(PROJECT_ROOT, './logs/frontend-out.log'),
      log_file: path.join(PROJECT_ROOT, './logs/frontend-combined.log'),
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Health check
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 1000,
      // Additional options
      pmx: true,
      automation: false,
      treekill: true,
    },
    // AI Node (Python service) - Optional PM2 management
    // Note: AI Node is typically started/stopped via scripts/start-ainode.sh
    // To enable PM2 management, uncomment the following and run:
    // pm2 start ecosystem.config.cjs --only iotdb-ainode
    {
      name: 'iotdb-ainode',
      script: './scripts/start-ainode.sh',
      cwd: PROJECT_ROOT,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false, // AI Node has its own restart logic
      watch: false,
      max_memory_restart: '1G',
      // AI Node specific environment
      env: {
        AINODE_HOME: '/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin',
        AINODE_PORT: 10810,
      },
      // Logging
      error_file: path.join(PROJECT_ROOT, './logs/ainode-error.log'),
      out_file: path.join(PROJECT_ROOT, './logs/ainode-out.log'),
      log_file: path.join(PROJECT_ROOT, './logs/ainode-combined.log'),
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown - use custom stop script
      kill_timeout: 10000,
      listen_timeout: 15000,
      stop_script: './scripts/stop-ainode.sh',
      // Health check
      min_uptime: '10s',
      max_restarts: 3, // AI Node has complex dependencies
      restart_delay: 5000,
      // Additional options
      pmx: true,
      automation: false,
      treekill: true,
      // Interpreter
      interpreter: '/bin/bash',
    },
  ],

  deploy: {
    production: {
      // SECURITY: Don't run as root user
      user: PM2_USER,
      host: process.env.DEPLOY_HOST || 'your-server.com',
      ref: 'origin/main',
      repo: process.env.GIT_REPO || 'git@github.com:your-org/iotdb-enhanced.git',
      path: PROJECT_ROOT,
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && cd backend && pnpm install && pnpm run build && cd ../frontend && pnpm install && pnpm run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
    },
    staging: {
      user: PM2_USER,
      host: process.env.DEPLOY_STAGING_HOST || 'staging.your-server.com',
      ref: 'origin/develop',
      repo: process.env.GIT_REPO || 'git@github.com:your-org/iotdb-enhanced.git',
      path: PROJECT_ROOT,
      'post-deploy': 'pnpm install && cd backend && pnpm install && pnpm run build && cd ../frontend && pnpm install && pnpm run build && pm2 reload ecosystem.config.cjs --env staging',
    },
  },

  // Additional PM2 modules
  modules: {
    // PM2 Plus monitoring (optional)
    // 'pm2-plus': {
    //   publicKey: 'YOUR_PUBLIC_KEY',
    //   secretKey: 'YOUR_SECRET_KEY',
    // },
  },
};
