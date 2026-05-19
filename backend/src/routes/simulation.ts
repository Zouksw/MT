import { Router } from "express";
import { z } from "zod";
import { logger, prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { executeMarketOrder, getAccountSummary } from "@/services/simulationEngine";

const router = Router();

const createAccountSchema = z.object({
	name: z.string().min(1).max(100),
	initialBalance: z.number().positive().default(100000),
});

const placeOrderSchema = z.object({
	commodityId: z.string().uuid(),
	side: z.enum(["BUY", "SELL"]),
	type: z.enum(["MARKET", "LIMIT", "STOP"]),
	quantity: z.number().positive(),
	price: z.number().positive().optional(),
	stopPrice: z.number().positive().optional(),
});

// GET /api/sim/accounts
router.get(
	"/accounts",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const accounts = await prisma.simulationAccount.findMany({
			where: { userId: req.userId },
			orderBy: { createdAt: "desc" },
			include: {
				_count: { select: { orders: true, trades: true } },
			},
		});

		const result = accounts.map((a) => ({
			id: a.id,
			name: a.name,
			initialBalance: Number(a.initialBalance),
			currentBalance: Number(a.currentBalance),
			pnl: Number(a.currentBalance) - Number(a.initialBalance),
			orderCount: a._count.orders,
			tradeCount: a._count.trades,
			isActive: a.isActive,
			createdAt: a.createdAt,
		}));

		success(res, { accounts: result });
	}),
);

// POST /api/sim/accounts
router.post(
	"/accounts",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { name, initialBalance } = createAccountSchema.parse(req.body);

		const account = await prisma.simulationAccount.create({
			data: {
				userId: req.userId,
				name,
				initialBalance,
				currentBalance: initialBalance,
			},
		});

		success(res, { account }, 201);
	}),
);

// GET /api/sim/accounts/:id
router.get(
	"/accounts/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const account = await prisma.simulationAccount.findUnique({
			where: { id: req.params.id },
		});

		if (!account || account.userId !== req.userId) {
			throw new NotFoundError("Backtest account");
		}

		const summary = await getAccountSummary(req.params.id);
		success(res, { account: summary });
	}),
);

// POST /api/sim/accounts/:id/orders
router.post(
	"/accounts/:id/orders",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const account = await prisma.simulationAccount.findUnique({
			where: { id: req.params.id },
		});

		if (!account || account.userId !== req.userId) {
			throw new NotFoundError("Backtest account");
		}

		if (!account.isActive) {
			throw new BadRequestError("Account is not active");
		}

		const { commodityId, side, type, quantity, price, stopPrice } = placeOrderSchema.parse(
			req.body,
		);

		const commodity = await prisma.commodity.findUnique({
			where: { id: commodityId },
		});
		if (!commodity) {
			throw new NotFoundError("Commodity");
		}

		// Validate balance for BUY orders
		if (side === "BUY") {
			const latestPrice = await prisma.commodityPrice.findFirst({
				where: { commodityId, interval: "daily" },
				orderBy: { date: "desc" },
			});
			if (latestPrice) {
				const estCost = Number(latestPrice.close) * quantity * 1.002; // + commission + slippage
				if (estCost > Number(account.currentBalance)) {
					throw new BadRequestError("Insufficient balance");
				}
			}
		}

		const order = await prisma.simulationOrder.create({
			data: {
				accountId: account.id,
				commodityId,
				side,
				type,
				quantity,
				price,
				stopPrice,
			},
		});

		// Execute market orders immediately
		if (type === "MARKET") {
			try {
				const result = await executeMarketOrder(order.id);
				const updatedOrder = await prisma.simulationOrder.findUnique({
					where: { id: order.id },
				});
				return success(res, { order: updatedOrder, execution: result }, 201);
			} catch (err) {
				// Order created but execution failed — return as pending
				logger.warn(`[Sim] Market order ${order.id} created but execution failed: ${err}`);
			}
		}

		success(res, { order }, 201);
	}),
);

// GET /api/sim/accounts/:id/orders
router.get(
	"/accounts/:id/orders",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const account = await prisma.simulationAccount.findUnique({
			where: { id: req.params.id },
		});
		if (!account || account.userId !== req.userId) {
			throw new NotFoundError("Backtest account");
		}

		const status = req.query.status as string | undefined;
		const orders = await prisma.simulationOrder.findMany({
			where: {
				accountId: req.params.id,
				...(status ? { status } : {}),
			},
			include: {
				commodity: { select: { slug: true, name: true, unit: true } },
			},
			orderBy: { placedAt: "desc" },
			take: 100,
		});

		success(res, { orders });
	}),
);

// PATCH /api/sim/accounts/:id/orders/:orderId — cancel order
router.patch(
	"/accounts/:id/orders/:orderId",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const account = await prisma.simulationAccount.findUnique({
			where: { id: req.params.id },
		});
		if (!account || account.userId !== req.userId) {
			throw new NotFoundError("Backtest account");
		}

		const order = await prisma.simulationOrder.findUnique({
			where: { id: req.params.orderId },
		});
		if (!order || order.accountId !== req.params.id) {
			throw new NotFoundError("Prediction order");
		}

		if (order.status !== "PENDING") {
			throw new BadRequestError("Only pending orders can be cancelled");
		}

		const updated = await prisma.simulationOrder.update({
			where: { id: req.params.orderId },
			data: { status: "CANCELLED" },
		});

		success(res, { order: updated });
	}),
);

// GET /api/sim/accounts/:id/trades
router.get(
	"/accounts/:id/trades",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const account = await prisma.simulationAccount.findUnique({
			where: { id: req.params.id },
		});
		if (!account || account.userId !== req.userId) {
			throw new NotFoundError("Backtest account");
		}

		const trades = await prisma.simulationTrade.findMany({
			where: { accountId: req.params.id },
			include: {
				commodity: { select: { slug: true, name: true, unit: true } },
			},
			orderBy: { openedAt: "desc" },
			take: 100,
		});

		success(res, { trades });
	}),
);

export { router as simulationRouter };
