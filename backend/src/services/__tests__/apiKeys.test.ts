/**
 * API Keys Service — Real Database + bcrypt Integration Tests
 *
 * Tests API key lifecycle against real PostgreSQL with real bcrypt hashing.
 * No mocks — verifies actual DB records and hash comparisons.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  generateApiKey,
  createApiKey,
  validateApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  updateApiKeyExpiration,
} from '@/services/apiKeys';
import { createTestContext, destroyTestContext, type TestContext } from '@/test/helpers/testContext';

describe('apiKeys service (real DB + bcrypt)', () => {
  let ctx: TestContext;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createTestContext('apiKeys');
    if (!ctx.available) return;

    // Create a real test user with a real bcrypt-hashed password
    const hash = await bcrypt.hash('TestPass123!', 4);
    const user = await ctx.prisma.user.create({
      data: {
        email: `${ctx.prefix}-user@test.com`,
        name: 'API Keys Test User',
        passwordHash: hash,
        role: 'ADMIN',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await destroyTestContext(ctx);
  });

  beforeEach(() => {
    if (!ctx?.available) vi.skip();
  });

  describe('generateApiKey', () => {
    it('should generate key with iotd_ prefix', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^iotd_[a-f0-9]{16}_/);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('createApiKey', () => {
    it('should create API key and store in DB', async () => {
      const result = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-test-key`,
      });

      expect(result.apiKey).toMatch(/^iotd_/);
      expect(result.name).toBe(`${ctx.prefix}-test-key`);
      expect(result.id).toBeDefined();

      // Verify record exists in DB
      const record = await ctx.prisma.apiKey.findUnique({ where: { id: result.id } });
      expect(record).not.toBeNull();
      expect(record!.isActive).toBe(true);

      // Verify audit log was created
      const audit = await ctx.prisma.auditLog.findFirst({
        where: { resourceId: result.id, action: 'CREATE' },
      });
      expect(audit).not.toBeNull();
    });

    it('should throw for non-existent user', async () => {
      await expect(
        createApiKey({ userId: 'nonexistent-user-id', name: 'test' })
      ).rejects.toThrow('User not found');
    });

    it('should create key with expiration', async () => {
      const result = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-expiring-key`,
        expiresIn: 3600,
      });

      expect(result.expiresAt).toBeDefined();
      expect(new Date(result.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('validateApiKey', () => {
    it('should validate a real API key with real bcrypt', async () => {
      const created = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-validate-key`,
      });

      const result = await validateApiKey(created.apiKey);

      expect(result).not.toBeNull();
      expect(result!.user.id).toBe(testUserId);
      expect(result!.user.email).toBe(`${ctx.prefix}-user@test.com`);
    });

    it('should increment usage count on validation', async () => {
      const created = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-usage-key`,
      });

      await validateApiKey(created.apiKey);
      await validateApiKey(created.apiKey);

      const record = await ctx.prisma.apiKey.findUnique({ where: { id: created.id } });
      expect(record!.usageCount).toBe(2);
      expect(record!.lastUsedAt).not.toBeNull();
    });

    it('should return null for invalid key format', async () => {
      const result = await validateApiKey('invalid-key');
      expect(result).toBeNull();
    });

    it('should return null for non-existent key', async () => {
      const result = await validateApiKey('iotd_0000000000000000_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('should list keys for user', async () => {
      await createApiKey({ userId: testUserId, name: `${ctx.prefix}-list-key-1` });
      await createApiKey({ userId: testUserId, name: `${ctx.prefix}-list-key-2` });

      const keys = await listApiKeys(testUserId);
      const testKeys = keys.filter(k => k.name.startsWith(ctx.prefix));
      expect(testKeys.length).toBeGreaterThanOrEqual(2);
      expect(testKeys[0]).toHaveProperty('name');
      expect(testKeys[0]).toHaveProperty('isActive');
    });
  });

  describe('revokeApiKey', () => {
    it('should deactivate key in DB', async () => {
      const created = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-revoke-key`,
      });

      const result = await revokeApiKey(testUserId, created.id);
      expect(result.success).toBe(true);

      const record = await ctx.prisma.apiKey.findUnique({ where: { id: created.id } });
      expect(record!.isActive).toBe(false);
    });

    it('should throw for non-existent key', async () => {
      await expect(
        revokeApiKey(testUserId, 'nonexistent-key-id')
      ).rejects.toThrow('API key not found');
    });
  });

  describe('deleteApiKey', () => {
    it('should remove key from DB', async () => {
      const created = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-delete-key`,
      });

      const result = await deleteApiKey(testUserId, created.id);
      expect(result.success).toBe(true);

      const record = await ctx.prisma.apiKey.findUnique({ where: { id: created.id } });
      expect(record).toBeNull();
    });
  });

  describe('updateApiKeyExpiration', () => {
    it('should update expiration', async () => {
      const created = await createApiKey({
        userId: testUserId,
        name: `${ctx.prefix}-update-key`,
      });

      const result = await updateApiKeyExpiration(testUserId, created.id, 7200);
      expect(result.success).toBe(true);
      expect(result.expiresAt).toBeDefined();

      const record = await ctx.prisma.apiKey.findUnique({ where: { id: created.id } });
      expect(record!.expiresAt).not.toBeNull();
    });
  });
});
