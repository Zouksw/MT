import { Router } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '@/middleware/auth';
import { asyncHandler, NotFoundError, BadRequestError } from '@/middleware/errorHandler';
import { success } from '@/lib/response';
import { prisma } from '@/lib';
import { computePortfolioPnL } from '@/services/portfolioService';

const router = Router();

const createPortfolioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const createPositionSchema = z.object({
  commodityId: z.string().uuid(),
  side: z.enum(['LONG', 'SHORT']),
  quantity: z.number().positive(),
  avgEntryPrice: z.number().positive(),
  notes: z.string().max(500).optional(),
});

const updatePositionSchema = z.object({
  quantity: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

// GET /api/portfolios — list user's portfolios
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.userId },
      include: {
        positions: {
          where: { closedAt: null },
          include: {
            commodity: { select: { slug: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = portfolios.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isDefault: p.isDefault,
      positionCount: p.positions.length,
      positions: p.positions.map((pos) => ({
        id: pos.id,
        commodity: pos.commodity,
        side: pos.side,
        quantity: Number(pos.quantity),
        avgEntryPrice: Number(pos.avgEntryPrice),
        currentPrice: pos.currentPrice ? Number(pos.currentPrice) : null,
        unrealizedPnl: pos.unrealizedPnl ? Number(pos.unrealizedPnl) : null,
      })),
      createdAt: p.createdAt,
    }));

    success(res, { portfolios: result });
  }),
);

// POST /api/portfolios — create portfolio
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, description } = createPortfolioSchema.parse(req.body);

    const existing = await prisma.portfolio.findUnique({
      where: { userId_name: { userId: req.userId!, name } },
    });
    if (existing) {
      throw new BadRequestError(`Analysis group '${name}' already exists`);
    }

    const portfolio = await prisma.portfolio.create({
      data: { userId: req.userId!, name, description },
    });

    success(res, { portfolio }, 201);
  }),
);

// GET /api/portfolios/:id — portfolio detail with positions
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: req.params.id },
      include: {
        positions: {
          include: {
            commodity: { select: { slug: true, name: true, nameCn: true, unit: true, category: true } },
          },
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    if (!portfolio || portfolio.userId !== req.userId) {
      throw new NotFoundError('Portfolio');
    }

    success(res, { portfolio });
  }),
);

// GET /api/portfolios/:id/performance — P&L summary
router.get(
  '/:id/performance',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: req.params.id },
    });

    if (!portfolio || portfolio.userId !== req.userId) {
      throw new NotFoundError('Portfolio');
    }

    const pnl = await computePortfolioPnL(req.params.id);
    success(res, { performance: pnl });
  }),
);

// POST /api/portfolios/:id/positions — open position
router.post(
  '/:id/positions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: req.params.id } });
    if (!portfolio || portfolio.userId !== req.userId) {
      throw new NotFoundError('Portfolio');
    }

    const { commodityId, side, quantity, avgEntryPrice, notes } = createPositionSchema.parse(req.body);

    const commodity = await prisma.commodity.findUnique({ where: { id: commodityId } });
    if (!commodity) {
      throw new NotFoundError('Commodity');
    }

    const position = await prisma.position.create({
      data: {
        portfolioId: req.params.id,
        commodityId,
        side,
        quantity,
        avgEntryPrice,
        notes,
      },
      include: {
        commodity: { select: { slug: true, name: true, unit: true } },
      },
    });

    success(res, { position }, 201);
  }),
);

// PATCH /api/portfolios/:id/positions/:positionId — update position
router.patch(
  '/:id/positions/:positionId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: req.params.id } });
    if (!portfolio || portfolio.userId !== req.userId) {
      throw new NotFoundError('Portfolio');
    }

    const position = await prisma.position.findUnique({ where: { id: req.params.positionId } });
    if (!position || position.portfolioId !== req.params.id) {
      throw new NotFoundError('Position');
    }

    const data = updatePositionSchema.parse(req.body);
    const updated = await prisma.position.update({
      where: { id: req.params.positionId },
      data,
    });

    success(res, { position: updated });
  }),
);

// DELETE /api/portfolios/:id/positions/:positionId — close position
router.delete(
  '/:id/positions/:positionId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: req.params.id } });
    if (!portfolio || portfolio.userId !== req.userId) {
      throw new NotFoundError('Portfolio');
    }

    const position = await prisma.position.findUnique({ where: { id: req.params.positionId } });
    if (!position || position.portfolioId !== req.params.id) {
      throw new NotFoundError('Position');
    }

    const closed = await prisma.position.update({
      where: { id: req.params.positionId },
      data: {
        closedAt: new Date(),
        realizedPnl: position.unrealizedPnl,
        unrealizedPnl: 0,
      },
    });

    success(res, { position: closed });
  }),
);

// DELETE /api/portfolios/:id — delete portfolio
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: req.params.id } });
    if (!portfolio || portfolio.userId !== req.userId) {
      throw new NotFoundError('Portfolio');
    }

    if (portfolio.isDefault) {
      throw new BadRequestError('Cannot delete default analysis group');
    }

    await prisma.portfolio.delete({ where: { id: req.params.id } });
    success(res, { deleted: true });
  }),
);

export { router as portfolioRouter };
