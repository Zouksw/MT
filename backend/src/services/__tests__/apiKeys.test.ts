/**
 * Tests for API Keys service
 * Security-critical service that handles API key generation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateApiKey,
  createApiKey,
  validateApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  updateApiKeyExpiration,
} from '@/services/apiKeys';
import { prisma } from '@/lib';

// Mock Prisma
vi.mock('@/lib', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock bcryptjs for API key validation tests
vi.mock('bcryptjs', () => {
  const mockHash = vi.fn().mockResolvedValue('$2b$12$hashedpassword');
  const mockCompare = vi.fn().mockResolvedValue(true);
  const mockGenSalt = vi.fn().mockResolvedValue('$2b$12$salt');
  return {
    default: { hash: mockHash, compare: mockCompare, genSalt: mockGenSalt },
    hash: mockHash,
    compare: mockCompare,
    genSalt: mockGenSalt,
  };
});

const mockPrisma = prisma as any;

// Helper to create mock User
const createMockUser = (overrides: any = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date(),
  passwordHash: 'hash',
  avatarUrl: null,
  preferences: {},
  lastLoginAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock ApiKey
const createMockApiKey = (overrides: any = {}) => ({
  id: 'key-123',
  name: 'Test Key',
  keyHash: '$2a$12$hash',
  lastCharacters: 12345678,
  isActive: true,
  usageCount: 0,
  expiresAt: null,
  lastUsedAt: null,
  createdAt: new Date(),
  userId: 'user-123',
  ...overrides,
});

describe('API Keys Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateApiKey', () => {
    it('should generate a key with correct prefix', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^iotd_/);
    });

    it('should generate a key with correct format', () => {
      const key = generateApiKey();
      // Format: iotd_<16 hex chars>_<base64url random string>
      // base64url can contain _ so we check the first two segments
      expect(key).toMatch(/^iotd_[0-9a-f]{16}_/);
      // Total key should be reasonably long (prefix + 16 hex + separator + base64url)
      expect(key.length).toBeGreaterThan(30);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate keys of reasonable length', () => {
      const key = generateApiKey();
      expect(key.length).toBeGreaterThan(40);
      expect(key.length).toBeLessThan(100);
    });
  });

  describe('createApiKey', () => {
    const mockUser = createMockUser();
    const mockApiKey = createMockApiKey();

    it('should create an API key successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.apiKey.create.mockResolvedValue(mockApiKey);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await createApiKey({
        userId: 'user-123',
        name: 'Test Key',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('name', 'Test Key');
      expect(result).toHaveProperty('lastCharacters');
      expect(result.apiKey).toMatch(/^iotd_/);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          resourceType: 'API_KEY',
          action: 'CREATE',
          success: true,
        }),
      });
    });

    it('should create an API key with expiration', async () => {
      const expiresAt = new Date();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.apiKey.create.mockResolvedValue({
        ...mockApiKey,
        expiresAt,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await createApiKey({
        userId: 'user-123',
        name: 'Test Key',
        expiresIn: 3600, // 1 hour
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should throw error when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        createApiKey({
          userId: 'nonexistent',
          name: 'Test Key',
        })
      ).rejects.toThrow('User not found');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        createApiKey({
          userId: 'user-123',
          name: 'Test Key',
        })
      ).rejects.toThrow();
    });
  });

  describe('validateApiKey', () => {
    it('should return null for empty key', async () => {
      const result = await validateApiKey('');
      expect(result).toBeNull();
    });

    it('should return null for key without correct prefix', async () => {
      const result = await validateApiKey('invalid_key');
      expect(result).toBeNull();
    });

    it('should return null when no keys match', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await validateApiKey('iotd_invalid_key');
      expect(result).toBeNull();
    });

    it('should query active non-expired keys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      await validateApiKey('iotd_test_key');

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          lastCharacters: expect.any(Number),
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: expect.any(Date) } },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      });
    });

    it('should return null when bcrypt comparison fails', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const mockUser = createMockUser();

      const mockApiKey = createMockApiKey({
        user: mockUser,
      });

      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKey]);

      // Mock bcrypt.compare to return false for this test
      (bcrypt.compare as vi.Mock).mockImplementationOnce(() => Promise.resolve(false));

      const result = await validateApiKey('iotd_invalid_key');
      expect(result).toBeNull();
    });

    it('should update usage count and last used when validation succeeds', async () => {
      const mockUser = createMockUser();

      const bcrypt = (await import('bcryptjs')).default;
      const testApiKey = 'iotd_test_key_valid';
      const keyHash = await bcrypt.hash(testApiKey, 12);
      (bcrypt.compare as vi.Mock).mockResolvedValue(true);

      const mockApiKey = createMockApiKey({
        user: mockUser,
        lastCharacters: 12345678,
        keyHash,
      });

      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKey]);
      mockPrisma.apiKey.update.mockResolvedValue({
        ...mockApiKey,
        usageCount: 1,
        lastUsedAt: new Date(),
      });

      const result = await validateApiKey(testApiKey);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('apiKey');
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });
  });

  describe('listApiKeys', () => {
    const mockKeys = [
      createMockApiKey({
        id: 'key-1',
        name: 'Key 1',
        lastCharacters: 12345678,
        usageCount: 10,
        lastUsedAt: new Date(),
      }),
      createMockApiKey({
        id: 'key-2',
        name: 'Key 2',
        lastCharacters: 87654321,
        isActive: false,
        usageCount: 5,
        lastUsedAt: null,
        expiresAt: new Date(),
      }),
    ];

    it('should list all API keys for a user', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue(mockKeys);

      const result = await listApiKeys('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'key-1');
      expect(result[1]).toHaveProperty('id', 'key-2');
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });

    it('should return empty array when user has no keys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await listApiKeys('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('revokeApiKey', () => {
    const mockApiKey = createMockApiKey();

    it('should revoke an API key successfully', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await revokeApiKey('user-123', 'key-123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'API key revoked');
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { isActive: false },
      });
    });

    it('should throw error when key not found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        revokeApiKey('user-123', 'nonexistent-key')
      ).rejects.toThrow('API key not found or access denied');
    });

    it('should throw error when user does not own the key', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        revokeApiKey('different-user', 'key-123')
      ).rejects.toThrow('API key not found or access denied');
    });

    it('should create audit log on revoke', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await revokeApiKey('user-123', 'key-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          resourceType: 'API_KEY',
          resourceId: 'key-123',
          action: 'DELETE',
          success: true,
        }),
      });
    });
  });

  describe('deleteApiKey', () => {
    const mockApiKey = createMockApiKey();

    it('should delete an API key successfully', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await deleteApiKey('user-123', 'key-123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'API key deleted');
      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
    });

    it('should throw error when key not found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        deleteApiKey('user-123', 'nonexistent-key')
      ).rejects.toThrow('API key not found or access denied');
    });

    it('should create audit log on delete', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await deleteApiKey('user-123', 'key-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          resourceType: 'API_KEY',
          resourceId: 'key-123',
          action: 'DELETE',
          success: true,
        }),
      });
    });
  });

  describe('updateApiKeyExpiration', () => {
    const mockApiKey = createMockApiKey();

    it('should update API key expiration successfully', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue({} as any);

      const result = await updateApiKeyExpiration('user-123', 'key-123', 3600);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { expiresAt: expect.any(Date) },
      });
    });

    it('should remove expiration when expiresIn is undefined', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue({} as any);

      const result = await updateApiKeyExpiration('user-123', 'key-123', undefined);

      expect(result).toHaveProperty('success', true);
      expect(result.expiresAt).toBeNull();
    });

    it('should throw error when key not found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        updateApiKeyExpiration('user-123', 'nonexistent-key', 3600)
      ).rejects.toThrow('API key not found or access denied');
    });
  });
});
