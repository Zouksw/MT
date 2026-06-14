import { logger, prisma } from "@/lib";

const DEFAULT_COMMISSION_RATE = 0.001; // 0.1%
const DEFAULT_SLIPPAGE = 0.0005; // 0.05%

interface ExecutionResult {
	orderId: string;
	filledPrice: number;
	filledQuantity: number;
	commission: number;
	tradeId?: string;
}

export async function executeMarketOrder(
	orderId: string,
): Promise<ExecutionResult> {
	const order = await prisma.simulationOrder.findUnique({
		where: { id: orderId },
		include: { commodity: true, account: true },
	});

	if (!order || order.status !== "PENDING") {
		throw new Error("Order not found or not pending");
	}

	// Get latest price
	const latestPrice = await prisma.commodityPrice.findFirst({
		where: { commodityId: order.commodityId, interval: "daily" },
		orderBy: { date: "desc" },
	});

	if (!latestPrice) {
		throw new Error(`No price data for commodity ${order.commodity.slug}`);
	}

	const basePrice = Number(latestPrice.close);
	const slippage = basePrice * DEFAULT_SLIPPAGE;
	const filledPrice =
		order.side === "BUY" ? basePrice + slippage : basePrice - slippage;

	const quantity = Number(order.quantity);
	const commission = filledPrice * quantity * DEFAULT_COMMISSION_RATE;

	// Execute in transaction
	const result = await prisma.$transaction(async (tx) => {
		// Update order
		const updatedOrder = await tx.simulationOrder.update({
			where: { id: orderId },
			data: {
				status: "FILLED",
				filledPrice,
				filledQuantity: quantity,
				commission,
				filledAt: new Date(),
			},
		});

		// Calculate balance change
		const tradeValue = filledPrice * quantity;
		const balanceChange =
			order.side === "BUY"
				? -(tradeValue + commission)
				: tradeValue - commission;

		// For BUY: verify balance stays non-negative
		if (order.side === "BUY") {
			const account = await tx.simulationAccount.findUnique({
				where: { id: order.accountId },
				select: { currentBalance: true },
			});
			const newBalance = Number(account?.currentBalance) + balanceChange;
			if (newBalance < 0) {
				// Roll back order to rejected
				await tx.simulationOrder.update({
					where: { id: orderId },
					data: { status: "REJECTED" },
				});
				throw new Error("Insufficient balance");
			}
		}

		// For SELL: verify the account holds enough of this commodity across all
		// open BUY positions, then close (proportionally) the corresponding BUY
		// trades with realized PnL. Previously this only checked that *some* open
		// BUY existed, never bounded the SELL quantity, and never closed anything —
		// which let a single BUY position be sold repeatedly, printing balance.
		if (order.side === "SELL") {
			const openTrades = await tx.simulationTrade.findMany({
				where: {
					accountId: order.accountId,
					commodityId: order.commodityId,
					side: "BUY",
					closedAt: null,
				},
				orderBy: { openedAt: "asc" },
			});
			const openQuantity = openTrades.reduce(
				(sum, t) => sum + Number(t.quantity),
				0,
			);
			if (openQuantity <= 0) {
				await tx.simulationOrder.update({
					where: { id: orderId },
					data: { status: "REJECTED" },
				});
				throw new Error("No open position to sell");
			}
			if (quantity > openQuantity) {
				await tx.simulationOrder.update({
					where: { id: orderId },
					data: { status: "REJECTED" },
				});
				throw new Error(
					`Insufficient position: trying to sell ${quantity} but only ${openQuantity} held`,
				);
			}
			// Close open BUY trades FIFO, reducing each until the SELL quantity is
			// fully covered. A trade is fully closed when its remaining qty hits 0.
			let remainingToSell = quantity;
			const now = new Date();
			for (const buy of openTrades) {
				if (remainingToSell <= 0) break;
				const buyQty = Number(buy.quantity);
				const closeQty = Math.min(buyQty, remainingToSell);
				remainingToSell -= closeQty;
				const realizedPnl =
					(filledPrice - Number(buy.entryPrice)) * closeQty;
				const fullyClosed = closeQty >= buyQty;
				await tx.simulationTrade.update({
					where: { id: buy.id },
					data: {
						// Reduce the position; fully-close if exhausted.
						quantity: buyQty - closeQty,
						exitPrice: filledPrice,
						realizedPnl:
							(Number(buy.realizedPnl ?? 0) + realizedPnl),
						closedAt: fullyClosed ? now : buy.closedAt,
					},
				});
			}
		}

		// Update account balance
		await tx.simulationAccount.update({
			where: { id: order.accountId },
			data: { currentBalance: { increment: balanceChange } },
		});

		// Create trade record
		const trade = await tx.simulationTrade.create({
			data: {
				accountId: order.accountId,
				commodityId: order.commodityId,
				orderId,
				side: order.side,
				quantity,
				entryPrice: filledPrice,
				commission,
			},
		});

		return { order: updatedOrder, trade };
	});

	logger.info(
		`[SimEngine] Executed ${order.side} order ${orderId}: ${quantity} ${order.commodity.slug} @ ${filledPrice.toFixed(2)} (commission: ${commission.toFixed(2)})`,
	);

	return {
		orderId,
		filledPrice,
		filledQuantity: quantity,
		commission,
		tradeId: result.trade.id,
	};
}

export async function checkLimitOrders(): Promise<number> {
	const pendingOrders = await prisma.simulationOrder.findMany({
		where: {
			status: "PENDING",
			type: { in: ["LIMIT", "STOP"] },
		},
		include: { commodity: true },
	});

	let executed = 0;

	for (const order of pendingOrders) {
		const latestPrice = await prisma.commodityPrice.findFirst({
			where: { commodityId: order.commodityId, interval: "daily" },
			orderBy: { date: "desc" },
		});

		if (!latestPrice) continue;

		const currentPrice = Number(latestPrice.close);
		const targetPrice = Number(order.price);
		const stopPrice = order.stopPrice ? Number(order.stopPrice) : null;

		let shouldExecute = false;

		if (order.type === "LIMIT") {
			if (order.side === "BUY" && currentPrice <= targetPrice)
				shouldExecute = true;
			if (order.side === "SELL" && currentPrice >= targetPrice)
				shouldExecute = true;
		} else if (order.type === "STOP" && stopPrice != null) {
			if (order.side === "BUY" && currentPrice >= stopPrice)
				shouldExecute = true;
			if (order.side === "SELL" && currentPrice <= stopPrice)
				shouldExecute = true;
		}

		if (shouldExecute) {
			try {
				await executeMarketOrder(order.id);
				executed++;
			} catch (err) {
				logger.error(`[SimEngine] Failed to execute order ${order.id}: ${err}`);
			}
		}
	}

	return executed;
}

export async function getAccountSummary(accountId: string) {
	const account = await prisma.simulationAccount.findUnique({
		where: { id: accountId },
		include: {
			orders: {
				orderBy: { placedAt: "desc" },
				take: 50,
			},
			trades: {
				orderBy: { openedAt: "desc" },
				take: 50,
				include: {
					commodity: { select: { slug: true, name: true, unit: true } },
				},
			},
		},
	});

	if (!account) throw new Error("Account not found");

	const openTrades = account.trades.filter((t) => !t.closedAt);
	const closedTrades = account.trades.filter((t) => t.closedAt);

	const totalRealizedPnl = closedTrades.reduce(
		(sum, t) => sum + (t.realizedPnl ? Number(t.realizedPnl) : 0),
		0,
	);

	const pendingOrders = await prisma.simulationOrder.count({
		where: { accountId, status: "PENDING" },
	});

	return {
		id: account.id,
		name: account.name,
		initialBalance: Number(account.initialBalance),
		currentBalance: Number(account.currentBalance),
		totalPnl: Number(account.currentBalance) - Number(account.initialBalance),
		totalRealizedPnl,
		openTradeCount: openTrades.length,
		closedTradeCount: closedTrades.length,
		pendingOrderCount: pendingOrders,
		isActive: account.isActive,
		recentTrades: account.trades.slice(0, 20),
		recentOrders: account.orders.slice(0, 20),
	};
}
