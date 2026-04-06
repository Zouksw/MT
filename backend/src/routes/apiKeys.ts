/**
 * API Keys Routes
 * Endpoints for managing API keys
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { apiKeyCreationLimiter } from '@/middleware/rateLimiter';
import { asyncHandler, UnauthorizedError } from '@/middleware/errorHandler';
import {
  createApiKey,
  validateApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  updateApiKeyExpiration,
  apiKeysSchemas,
} from '@/services/apiKeys';
import { validate } from '@/middleware/security';
import { success } from '@/lib/response';

const router = Router();

/**
 * @openapi
 * /api/api-keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Create a new API key
 *     description: Generates a new API key for the authenticated user. Rate limited to prevent abuse.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Descriptive name for the API key
 *                 example: My Production Key
 *               expiresIn:
 *                 type: integer
 *                 description: Expiration time in seconds
 *                 example: 2592000
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     key: { type: string, description: The API key (shown only once) }
 *                     expiresAt: { type: string, format: date-time, nullable: true }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Rate limit exceeded
 */
/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post(
  '/',
  authenticate,
  apiKeyCreationLimiter,
  validate(apiKeysSchemas.create),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
      throw new UnauthorizedError();
    }

    const { name, expiresIn } = req.body;

    const result = await createApiKey({
      userId: req.userId,
      name,
      expiresIn,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    return success(res, result, 201);
  })
);

/**
 * @openapi
 * /api/api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List all API keys
 *     description: Retrieves all API keys for the authenticated user. Key values are not returned for security.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiKeys:
 *                       type: array
 *                       items: { type: object }
 *                     total: { type: integer }
 *       401:
 *         description: Not authenticated
 */
/**
 * GET /api/api-keys
 * List all API keys for the authenticated user
 */
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new UnauthorizedError();
  }

  const apiKeys = await listApiKeys(req.userId);

  return success(res, {
    apiKeys,
    total: apiKeys.length,
  });
}));

/**
 * @openapi
 * /api/api-keys/{id}/revoke:
 *   delete:
 *     tags: [API Keys]
 *     summary: Revoke an API key
 *     description: Deactivates an API key without deleting it. The key will no longer be usable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: API key not found
 */
/**
 * DELETE /api/api-keys/:id/revoke
 * Revoke (deactivate) an API key
 */
router.delete('/:id/revoke', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new UnauthorizedError();
  }

  const { id } = req.params;

  const result = await revokeApiKey(req.userId, id);

  return success(res, result);
}));

/**
 * @openapi
 * /api/api-keys/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Delete an API key
 *     description: Permanently deletes an API key.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: API key not found
 */
/**
 * DELETE /api/api-keys/:id
 * Permanently delete an API key
 */
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new UnauthorizedError();
  }

  const { id } = req.params;

  const result = await deleteApiKey(req.userId, id);

  return success(res, result);
}));

/**
 * @openapi
 * /api/api-keys/{id}/expiration:
 *   patch:
 *     tags: [API Keys]
 *     summary: Update API key expiration
 *     description: Updates the expiration time of an existing API key.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: API key ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresIn:
 *                 type: integer
 *                 description: New expiration time in seconds
 *                 example: 604800
 *     responses:
 *       200:
 *         description: Expiration updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: API key not found
 */
/**
 * PATCH /api/api-keys/:id/expiration
 * Update API key expiration
 */
router.patch(
  '/:id/expiration',
  authenticate,
  validate(apiKeysSchemas.updateExpiration),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;
    const { expiresIn } = req.body;

    const result = await updateApiKeyExpiration(req.userId, id, expiresIn);

    return success(res, result);
  })
);

export default router;
