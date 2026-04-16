import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

// Mock auth middleware
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const userId = req.get('X-User-Id');
    const userRole = req.get('X-User-Role');
    if (userId) {
      req.userId = userId;
      req.user = { id: userId, email: 'test@test.com', name: 'Test', role: userRole || 'VIEWER' };
    }
    next();
  },
  AuthRequest: Object,
}));

// Mock @/lib before importing security route (which now imports from @/lib)
const mockPrisma = {
  securityAuditLog: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/lib', () => ({
  prisma: mockPrisma,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import securityRouter from '@/routes/security';
import { logger } from '@/lib';

// prisma reference for tests (same object as the mock)
const prisma = mockPrisma;

describe('Security Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock auth middleware to populate req.user from headers
    app.use('/api/security', (req, res, next) => {
      const userId = req.get('X-User-Id');
      const userRole = req.get('X-User-Role');
      if (userId && userRole) {
        (req as any).user = {
          id: userId,
          role: userRole,
        };
      }
      next();
    });

    app.use('/api/security', securityRouter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/security/audit', () => {
    const validLogs = [
      {
        event: 'LOGIN_SUCCESS',
        sessionId: 'session-123',
        severity: 'low',
        userAgent: 'test-agent',
        url: '/login',
      },
    ];

    test('should accept valid audit logs', async () => {
      (prisma.securityAuditLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: validLogs })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: { count: 1 },
      });
      expect(prisma.securityAuditLog.createMany).toHaveBeenCalled();
    });

    test('should reject request without logs array', async () => {
      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: 'not-an-array' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    test('should reject request with empty logs array', async () => {
      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: [] })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    test('should reject invalid event type', async () => {
      const invalidLogs = [
        {
          event: 'INVALID_EVENT',
          sessionId: 'session-123',
          severity: 'low',
        },
      ];

      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: invalidLogs })
        .expect(400);

      expect(response.body.error.message).toContain('Invalid event');
    });

    test('should reject missing sessionId', async () => {
      const invalidLogs = [
        {
          event: 'LOGIN_SUCCESS',
          severity: 'low',
        },
      ];

      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: invalidLogs })
        .expect(400);

      expect(response.body.error.message).toContain('sessionId');
    });

    test('should reject invalid severity', async () => {
      const invalidLogs = [
        {
          event: 'LOGIN_SUCCESS',
          sessionId: 'session-123',
          severity: 'invalid',
        },
      ];

      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: invalidLogs })
        .expect(400);

      expect(response.body.error.message).toContain('Invalid severity');
    });

    test('should reject invalid details type', async () => {
      const invalidLogs = [
        {
          event: 'LOGIN_SUCCESS',
          sessionId: 'session-123',
          severity: 'low',
          details: 'not-an-object',
        },
      ];

      const response = await request(app)
        .post('/api/security/audit')
        .send({ logs: invalidLogs })
        .expect(400);

      expect(response.body.error.message).toContain('details must be an object');
    });

    test('should handle logs with timestamp', async () => {
      (prisma.securityAuditLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const logsWithTimestamp = [
        {
          event: 'LOGIN_SUCCESS',
          sessionId: 'session-123',
          severity: 'low',
          timestamp: '2026-03-13T10:00:00Z',
        },
      ];

      await request(app)
        .post('/api/security/audit')
        .send({ logs: logsWithTimestamp })
        .expect(200);

      expect(prisma.securityAuditLog.createMany).toHaveBeenCalled();
    });

    test('should accept all valid event types', async () => {
      (prisma.securityAuditLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const validEvents = [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOGOUT',
        'TOKEN_EXPIRED',
        'TOKEN_REFRESHED',
        'CSRF_VIOLATION',
        'XSS_ATTEMPT',
        'RATE_LIMIT_EXCEEDED',
        'PERMISSION_DENIED',
        'SUSPICIOUS_ACTIVITY',
        'INVALID_INPUT',
        'API_ERROR',
        'NETWORK_ERROR',
      ];

      for (const event of validEvents) {
        const logs = [
          {
            event,
            sessionId: 'session-123',
            severity: 'low',
          },
        ];

        await request(app)
          .post('/api/security/audit')
          .send({ logs });
      }

      expect(prisma.securityAuditLog.createMany).toHaveBeenCalledTimes(validEvents.length);
    });

    test('should accept all valid severities', async () => {
      (prisma.securityAuditLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const validSeverities = ['low', 'medium', 'high', 'critical'];

      for (const severity of validSeverities) {
        const logs = [
          {
            event: 'LOGIN_SUCCESS',
            sessionId: 'session-123',
            severity,
          },
        ];

        await request(app)
          .post('/api/security/audit')
          .send({ logs });
      }

      expect(prisma.securityAuditLog.createMany).toHaveBeenCalledTimes(validSeverities.length);
    });
  });

  describe('GET /api/security/audit', () => {
    // Mock authenticated admin user
    const mockAdmin = {
      id: 'admin-123',
      role: 'ADMIN',
      email: 'admin@test.com',
    };

    test('should return audit logs for admin', async () => {
      const mockLogs = [
        { id: '1', event: 'LOGIN_SUCCESS', timestamp: new Date() },
      ];
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/security/audit')
        .set('X-User-Id', mockAdmin.id)
        .set('X-User-Role', mockAdmin.role)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toBeInstanceOf(Array);
      expect(response.body.data.logs).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('should filter by userId', async () => {
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/security/audit?userId=user-123')
        .set('X-User-Id', mockAdmin.id)
        .set('X-User-Role', mockAdmin.role)
        .expect(200);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });

    test('should filter by event', async () => {
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/security/audit?event=LOGIN_SUCCESS')
        .set('X-User-Id', mockAdmin.id)
        .set('X-User-Role', mockAdmin.role)
        .expect(200);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            event: 'LOGIN_SUCCESS',
          }),
        })
      );
    });

    test('should filter by severity', async () => {
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/security/audit?severity=critical')
        .set('X-User-Id', mockAdmin.id)
        .set('X-User-Role', mockAdmin.role)
        .expect(200);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: 'critical',
          }),
        })
      );
    });

    test('should filter by date range', async () => {
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/security/audit?startDate=2026-03-01&endDate=2026-03-31')
        .set('X-User-Id', mockAdmin.id)
        .set('X-User-Role', mockAdmin.role)
        .expect(200);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    test('should paginate results', async () => {
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(100);

      await request(app)
        .get('/api/security/audit?page=2&limit=20')
        .set('X-User-Id', mockAdmin.id)
        .set('X-User-Role', mockAdmin.role)
        .expect(200);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 20, // (2 - 1) * 20
        })
      );
    });

    test('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/security/audit')
        .set('X-User-Id', 'viewer-123')
        .set('X-User-Role', 'VIEWER');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/security/audit/stats', () => {
    test('should return statistics for admin', async () => {
      const mockLogs = [
        { event: 'LOGIN_SUCCESS', severity: 'low', timestamp: new Date(), details: {} },
        { event: 'LOGIN_SUCCESS', severity: 'low', timestamp: new Date(), details: {} },
        { event: 'LOGIN_FAILURE', severity: 'medium', timestamp: new Date(), details: {} },
      ];

      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(3);
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/security/audit/stats')
        .set('X-User-Id', 'admin-123')
        .set('X-User-Role', 'ADMIN')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          total: 3,
          byEvent: expect.any(Object),
          bySeverity: expect.any(Object),
          recentCritical: expect.any(Array),
        },
      });
    });

    test('should aggregate by event type', async () => {
      const mockLogs = [
        { event: 'LOGIN_SUCCESS', severity: 'low', timestamp: new Date(), details: {} },
        { event: 'LOGIN_SUCCESS', severity: 'low', timestamp: new Date(), details: {} },
        { event: 'LOGIN_FAILURE', severity: 'medium', timestamp: new Date(), details: {} },
      ];

      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(3);
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/security/audit/stats')
        .set('X-User-Id', 'admin-123')
        .set('X-User-Role', 'ADMIN')
        .expect(200);

      expect(response.body.data.byEvent).toMatchObject({
        LOGIN_SUCCESS: 2,
        LOGIN_FAILURE: 1,
      });
    });

    test('should aggregate by severity', async () => {
      const mockLogs = [
        { event: 'LOGIN_SUCCESS', severity: 'low', timestamp: new Date(), details: {} },
        { event: 'LOGIN_SUCCESS', severity: 'low', timestamp: new Date(), details: {} },
        { event: 'LOGIN_FAILURE', severity: 'medium', timestamp: new Date(), details: {} },
      ];

      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(3);
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/security/audit/stats')
        .set('X-User-Id', 'admin-123')
        .set('X-User-Role', 'ADMIN')
        .expect(200);

      expect(response.body.data.bySeverity).toMatchObject({
        low: 2,
        medium: 1,
      });
    });

    test('should filter stats by date range', async () => {
      (prisma.securityAuditLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.securityAuditLog.findMany as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/security/audit/stats?startDate=2026-03-01&endDate=2026-03-31')
        .set('X-User-Id', 'admin-123')
        .set('X-User-Role', 'ADMIN')
        .expect(200);

      expect(prisma.securityAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });
});
