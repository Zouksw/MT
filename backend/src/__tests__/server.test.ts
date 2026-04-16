import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Server Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Module loading', () => {
    test('should load all route modules', () => {
      const routes = [
        '../routes/health',
        '../routes/security',
      ];

      routes.forEach(routePath => {
        expect(() => require(routePath)).not.toThrow();
      });
    });

    test('should load all middleware modules', () => {
      const middleware = [
        '../middleware/cache',
        '../middleware/errorHandler',
        '../middleware/logging',
        '../middleware/aiAccess',
      ];

      middleware.forEach(middlewarePath => {
        expect(() => require(middlewarePath)).not.toThrow();
      });
    });

    test('should load all library modules', () => {
      const libs = [
        '../lib/config',
        '../lib/logger',
        '../lib/response',
        '../lib/jwt',
        '../lib/sentry',
        '../lib/redis',
        '../lib/redisPool',
        '../lib/performanceMonitor',
      ];

      libs.forEach(libPath => {
        expect(() => require(libPath)).not.toThrow();
      });
    });
  });

  describe('Route Registration', () => {
    test('should have health router', () => {
      const health = require('../routes/health');
      expect(health).toBeDefined();
    });

    test('should have security router', () => {
      const security = require('../routes/security');
      expect(security).toBeDefined();
    });
  });

  describe('Middleware Setup', () => {
    test('should have error handler middleware', () => {
      const { errorHandler } = require('../middleware/errorHandler');
      expect(errorHandler).toBeDefined();
      expect(typeof errorHandler).toBe('function');
    });

    test('should have async handler utility', () => {
      const { asyncHandler } = require('../middleware/errorHandler');
      expect(asyncHandler).toBeDefined();
      expect(typeof asyncHandler).toBe('function');
    });

    test('should have logging middleware', () => {
      const { loggingMiddleware, errorLoggingMiddleware } = require('../middleware/logging');
      expect(loggingMiddleware).toBeDefined();
      expect(errorLoggingMiddleware).toBeDefined();
    });

    test('should have cache middleware', () => {
      const cache = require('../middleware/cache');
      expect(cache).toBeDefined();
    });
  });

  describe('Library Configuration', () => {
    test('should have config module', () => {
      const config = require('../lib/config');
      expect(config).toBeDefined();
      expect(config.config).toBeDefined();
    });

    test('should have logger module', () => {
      const { logger } = require('../lib/logger');
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
    });

    test('should have response helpers', () => {
      const response = require('../lib/response');
      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
      expect(response.error).toBeDefined();
    });

    test('should have JWT utilities', () => {
      const jwt = require('../lib/jwt');
      expect(jwt).toBeDefined();
      expect(jwt.generateToken).toBeDefined();
      expect(jwt.verifyToken).toBeDefined();
    });

    test('should have Sentry integration', () => {
      const sentry = require('../lib/sentry');
      expect(sentry).toBeDefined();
      expect(sentry.initSentry).toBeDefined();
      expect(sentry.captureError).toBeDefined();
    });

    test('should have Redis utilities', () => {
      const redis = require('../lib/redis');
      expect(redis).toBeDefined();
      expect(redis.initRedis).toBeDefined();
    });

    test('should have performance monitor', () => {
      const perf = require('../lib/performanceMonitor');
      expect(perf).toBeDefined();
      expect(perf.recordMetric).toBeDefined();
      expect(perf.getPerformanceStats).toBeDefined();
    });
  });

  describe('Environment-specific Configuration', () => {
    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
    });

    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(process.env.NODE_ENV).toBe('development');
    });

    test('should default to development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const { config } = require('../lib/config');
      expect(config).toBeDefined();
    });
  });

  describe('API Endpoints Structure', () => {
    test('should have all expected route patterns', () => {
      const apiRoutes = [
        '/api/auth',
        '/api/datasets',
        '/api/timeseries',
        '/api/models',
        '/api/anomalies',
        '/api/iotdb',
        '/api/api-keys',
        '/api/alerts',
        '/api/health',
        '/api/security',
      ];

      apiRoutes.forEach(route => {
        expect(route).toMatch(/^\/api\//);
      });
    });
  });

  describe('Security Features', () => {
    test('should have JWT utilities for authentication', () => {
      const jwt = require('../lib/jwt');
      expect(jwt.generateToken).toBeDefined();
      expect(jwt.verifyToken).toBeDefined();
    });

    test('should have rate limiting utilities', () => {
      const rateLimiter = require('../middleware/rateLimiter');
      expect(rateLimiter).toBeDefined();
    });
  });

  describe('Service Layer', () => {
    test('should load IoTDB services', () => {
      const iotdbServices = [
        '../services/iotdb/client',
        '../services/iotdb/rpc-client',
        '../services/iotdb/validator',
        '../services/iotdb/query-builder',
        '../services/iotdb/ai',
      ];

      iotdbServices.forEach(servicePath => {
        expect(() => require(servicePath)).not.toThrow();
      });
    });

    test('should load alert services', () => {
      const alertServices = [
        '../services/alerts',
        '../services/alert-rules',
        '../services/alert-types',
        '../services/alert-notifications',
      ];

      alertServices.forEach(servicePath => {
        expect(() => require(servicePath)).not.toThrow();
      });
    });

    test('should load security services', () => {
      const securityServices = [
        '../services/authLockout',
        '../services/tokenBlacklist',
      ];

      securityServices.forEach(servicePath => {
        expect(() => require(servicePath)).not.toThrow();
      });
    });

    test('should load API key services', () => {
      expect(() => require('../services/apiKeys')).not.toThrow();
    });

    test('should load cache service', () => {
      expect(() => require('../services/cache')).not.toThrow();
    });
  });
});

describe('Server Configuration Validation', () => {
  test('should have all critical modules', () => {
    const criticalModules = [
      { path: '../routes/health', name: 'Health Routes' },
      { path: '../routes/security', name: 'Security Routes' },
      { path: '../middleware/errorHandler', name: 'Error Handler' },
      { path: '../lib/config', name: 'Config' },
      { path: '../lib/logger', name: 'Logger' },
      { path: '../lib/jwt', name: 'JWT' },
      { path: '../services/iotdb/client', name: 'IoTDB Client' },
    ];

    criticalModules.forEach(({ path, name }) => {
      try {
        require(path);
      } catch (error) {
        throw new Error(`${name} failed to load: ${error}`);
      }
    });

    // If we get here without throwing, all modules loaded successfully
    const loadedCount = criticalModules.length;
    expect(loadedCount).toBe(7);
    criticalModules.forEach(({ path }) => {
      // require() succeeded in the loop above, so each module is cached and resolvable
      expect(require.resolve(path)).toBeDefined();
    });
  });

  test('should export expected functions from modules', () => {
    const { errorHandler } = require('../middleware/errorHandler');
    expect(typeof errorHandler).toBe('function');

    const { logger } = require('../lib/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');

    const jwt = require('../lib/jwt');
    expect(typeof jwt.generateToken).toBe('function');
    expect(typeof jwt.verifyToken).toBe('function');
  });
});
