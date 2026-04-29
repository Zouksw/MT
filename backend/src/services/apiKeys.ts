/**
 * API Key Management Service
 * Handles creation, validation, revocation, and usage tracking of API keys
 */

import { prisma } from '@/lib';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';

/**
 * Generate a secure API key
 * Format: iotd_<project_id>_<random_string>
 */
export function generateApiKey(): string {
  const prefix = 'iotd_';
  const projectId = crypto.randomBytes(8).toString('hex');
  const randomString = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${projectId}_${randomString}`;
}

/**
 * Hash an API key for storage
 */
async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, 12);
}

/**
 * Verify an API key against its hash
 */
async function verifyApiKey(apiKey: string, hashedKey: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hashedKey);
}

/**
 * Extract the last 8 characters for display
 * Converts to a number using hash of the characters
 */
function getLastCharacters(apiKey: string): number {
  const lastChars = apiKey.slice(-8);
  // Convert string to numeric hash for display
  let hash = 0;
  for (let i = 0; i < lastChars.length; i++) {
    hash = ((hash << 5) - hash) + lastChars.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Create a new API key
 */
export async function createApiKey(params: {
  userId: string;
  name: string;
  expiresIn?: number; // seconds
  ipAddress?: string;
  userAgent?: string;
}) {
  const { userId, name, expiresIn, ipAddress = '', userAgent = '' } = params;

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate API key
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);
  const lastChars = getLastCharacters(apiKey);

  // Calculate expiration
  let expiresAt: Date | undefined;
  if (expiresIn) {
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  // Store in database
  const storedKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      lastCharacters: lastChars,
      expiresAt,
    },
  });

  // Log audit
  await prisma.auditLog.create({
    data: {
      userId,
      resourceType: 'API_KEY',
      resourceId: storedKey.id,
      action: 'CREATE',
      ipAddress,
      userAgent,
      success: true,
    },
  });

  return {
    id: storedKey.id,
    apiKey, // Only time the raw key is shown
    name: storedKey.name,
    lastCharacters: storedKey.lastCharacters,
    expiresAt: storedKey.expiresAt,
    createdAt: storedKey.createdAt,
  };
}

/**
 * Validate an API key and return the associated user
 */
export async function validateApiKey(apiKey: string): Promise<{
  user: { id: string; email: string; name: string; role: string };
  apiKey: { id: string; lastCharacters: number };
} | null> {
  if (!apiKey?.startsWith('iotd_')) {
    return null;
  }

  // Pre-filter by lastCharacters hash to avoid O(n) bcrypt compares
  const targetLastChars = getLastCharacters(apiKey);

  const activeKeys = await prisma.apiKey.findMany({
    where: {
      isActive: true,
      lastCharacters: targetLastChars,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
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

  for (const key of activeKeys) {
    const isValid = await verifyApiKey(apiKey, key.keyHash);
    if (isValid) {
      // Update usage count and last used
      await prisma.apiKey.update({
        where: { id: key.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      return {
        user: key.user,
        apiKey: {
          id: key.id,
          lastCharacters: key.lastCharacters,
        },
      };
    }
  }

  return null;
}

/**
 * List API keys for a user
 */
export async function listApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      lastCharacters: true,
      isActive: true,
      usageCount: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(userId: string, apiKeyId: string) {
  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  });

  if (!apiKey) {
    throw new Error('API key not found or access denied');
  }

  // Deactivate
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { isActive: false },
  });

  // Log audit
  await prisma.auditLog.create({
    data: {
      userId,
      resourceType: 'API_KEY',
      resourceId: apiKeyId,
      action: 'DELETE',
      ipAddress: '',
      userAgent: '',
      success: true,
    },
  });

  return { success: true, message: 'API key revoked' };
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(userId: string, apiKeyId: string) {
  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  });

  if (!apiKey) {
    throw new Error('API key not found or access denied');
  }

  // Delete
  await prisma.apiKey.delete({
    where: { id: apiKeyId },
  });

  // Log audit
  await prisma.auditLog.create({
    data: {
      userId,
      resourceType: 'API_KEY',
      resourceId: apiKeyId,
      action: 'DELETE',
      ipAddress: '',
      userAgent: '',
      success: true,
    },
  });

  return { success: true, message: 'API key deleted' };
}

/**
 * Update API key expiration
 */
export async function updateApiKeyExpiration(
  userId: string,
  apiKeyId: string,
  expiresIn?: number
) {
  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  });

  if (!apiKey) {
    throw new Error('API key not found or access denied');
  }

  // Calculate new expiration
  let expiresAt: Date | null = null;
  if (expiresIn) {
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  // Update
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { expiresAt },
  });

  return {
    success: true,
    message: 'API key expiration updated',
    expiresAt,
  };
}

/**
 * Validation schemas
 */
export const apiKeysSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    expiresIn: z.number().positive().optional(),
  }),

  updateExpiration: z.object({
    expiresIn: z.number().positive().optional(),
  }),
};
