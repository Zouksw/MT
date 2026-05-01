/**
 * Shared test helpers for Vitest.
 *
 * Export factory functions that return mock objects for use inside
 * vi.mock() factories. These are safe to call inside hoisted vi.mock()
 * because they don't call vi.mock() themselves — they just create data.
 */
import { vi } from 'vitest';

/**
 * @deprecated Use `createTestContext()` from `@/test/helpers/testContext` instead.
 * Proxy-based mocks provide false confidence — tests pass regardless of schema changes.
 * For real integration tests, connect to actual PostgreSQL via TestContext.
 */
export function createPrismaProxy() {
  const fns = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({}),
    groupBy: vi.fn().mockResolvedValue([]),
  });
  return new Proxy({} as Record<string, ReturnType<typeof fns>>, {
    get: (target, prop: string) => {
      if (!target[prop]) target[prop] = fns();
      return target[prop];
    },
  });
}

/** Standard mock logger */
export function createLoggerMock() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

/** Standard mock jwtUtils for auth-dependent routes */
export function createJwtUtilsMock() {
  return {
    generateToken: vi.fn().mockReturnValue('test-token'),
    generateRefreshToken: vi.fn().mockReturnValue('test-refresh-token'),
    verifyToken: vi.fn().mockReturnValue({ userId: 'test-user-id', exp: Date.now() + 3600000 }),
    verifyRefreshToken: vi.fn().mockReturnValue({ userId: 'test-user-id' }),
  };
}

/** Standard mock config */
export function createConfigMock() {
  return {
    jwt: { secret: 'test-secret-key-for-jwt-testing-purposes-only-32chars', expiresIn: '1h' },
    session: { expiresDays: 7 },
    server: { port: 8000, nodeEnv: 'test' },
  };
}

/** Mock authenticate middleware that sets a test user */
export const mockAuthenticate = (req: any, _res: any, next: any) => {
  req.userId = 'test-user-id';
  req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test', role: 'user' };
  next();
};

/** Mock cacheRoute middleware — passes through */
export const mockCacheRoute = () => (_req: any, _res: any, next: any) => next();

/** Mock asyncHandler — catches errors and forwards to error handler */
export const mockAsyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Mock errorHandler — returns JSON error responses */
export const mockErrorHandler = (err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
};

/** Standard error classes for route tests */
export const MockNotFoundError = class extends Error { statusCode = 404; };
export const MockBadRequestError = class extends Error { statusCode = 400; };
export const MockForbiddenError = class extends Error { statusCode = 403; };
export const MockUnauthorizedError = class extends Error { statusCode = 401; };
export const MockConflictError = class extends Error { statusCode = 409; };

/** Pass-through rate limiter */
export const passThrough = (_req: any, _res: any, next: any) => next();
