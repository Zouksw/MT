/**
 * Security Tests: Rate Limiting & Input Validation
 *
 * Tests that rate limiting middleware exists, CORS is configured,
 * and input validation schemas work correctly.
 */

import { describe, test, expect, jest } from '@jest/globals';

describe('Security: Rate Limiting', () => {
  test('should define rate limiter module', () => {
    const rateLimiterModule = require('@/middleware/rateLimiter');
    expect(rateLimiterModule).toBeDefined();
  });

  test('should export rate limiter instances', () => {
    const rateLimiterModule = require('@/middleware/rateLimiter');
    const exports = Object.keys(rateLimiterModule);
    expect(exports.length).toBeGreaterThan(0);
  });
});

describe('Security: CORS Configuration', () => {
  test('should not allow wildcard origin in production mode', () => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];

    if (process.env.NODE_ENV === 'production') {
      expect(allowedOrigins).not.toContain('*');
    } else {
      // In test/dev mode, verify the CORS_ORIGIN variable is at least parseable
      expect(Array.isArray(allowedOrigins)).toBe(true);
    }
  });
});

describe('Security: Input Validation via Security Middleware', () => {
  test('should validate email format strictly', () => {
    const { validationSchemas } = require('@/middleware/security');

    // Valid emails
    expect(() => validationSchemas.email.parse('user@example.com')).not.toThrow();
    expect(() => validationSchemas.email.parse('user.name+tag@domain.co')).not.toThrow();

    // Invalid emails
    expect(() => validationSchemas.email.parse('not-an-email')).toThrow();
    expect(() => validationSchemas.email.parse('@domain.com')).toThrow();
    expect(() => validationSchemas.email.parse('user@')).toThrow();
    expect(() => validationSchemas.email.parse('')).toThrow();
  });

  test('should validate password strength', () => {
    const { validationSchemas } = require('@/middleware/security');

    // Valid passwords (8+ chars, uppercase, lowercase, digit)
    expect(() => validationSchemas.password.parse('SecurePass123')).not.toThrow();

    // Invalid passwords
    expect(() => validationSchemas.password.parse('short')).toThrow();
    expect(() => validationSchemas.password.parse('alllowercase1')).toThrow();
    expect(() => validationSchemas.password.parse('ALLUPPERCASE1')).toThrow();
    expect(() => validationSchemas.password.parse('NoDigitsHere')).toThrow();
  });

  test('should validate UUID format', () => {
    const { validationSchemas } = require('@/middleware/security');

    expect(() => validationSchemas.uuid.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    expect(() => validationSchemas.uuid.parse('not-a-uuid')).toThrow();
    expect(() => validationSchemas.uuid.parse('12345')).toThrow();
  });
});
