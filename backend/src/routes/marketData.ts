import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { MS_PER_DAY } from "@/lib/constants";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate, authorize } from "@/middleware/auth";
import { cacheRoute } from "@/middleware/cacheDecorator";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { scraperManager } from "@/services/dataIngestion";
import { detectFieldMapping, type FieldMapping } from "@/services/dataIngestion/normalizer";
import { importRows, parseCSV } from "@/services/dataIngestion/sources/manualImport";
import {
	getCommodityFreshness,
	getFundamentals,
	getLatestExchangeRates,
	getLatestPrice,
	getPriceHistory,
	getPricesBySource,
	getSourceFreshness,
	listCommodities,
	requireCommodity,
} from "@/services/marketService";

const router = Router();

/** Shape of a multer-augmented request (file property added by multer). */
interface MulterFile {
	buffer: Buffer;
}

const priceHistorySchema = z.object({
	interval: z.enum(["daily", "weekly", "monthly"]).default("daily"),
	from: z
		.string()
		.optional()
		.transform((v) => (v ? new Date(v) : undefined)),
	to: z
		.string()
		.optional()
		.transform((v) => (v ? new Date(v) : undefined)),
	limit: z.coerce.number().min(1).max(10000).default(365),
});

const _importSchema = z.object({
	commodityId: z.string().uuid(),
	interval: z.enum(["daily", "weekly", "monthly"]).default("daily"),
	delimiter: z.string().max(1).optional(),
});

router.get(
	"/commodities",
	authenticate,
	cacheRoute("market:commodities", 300),
	asyncHandler(async (_req, res) => {
		const result = await listCommodities();
		success(res, { commodities: result, count: result.length });
	}),
);

router.get(
	"/commodities/:slug/latest",
	authenticate,
	cacheRoute("market:latest", 60),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { commodity, price } = await getLatestPrice(req.params.slug);
		if (!price) return success(res, { commodity, price: null });
		success(res, {
			commodity: {
				id: commodity.id,
				slug: commodity.slug,
				name: commodity.name,
				unit: commodity.unit,
			},
			price: {
				date: price.date,
				open: price.open,
				high: price.high,
				low: price.low,
				close: price.close,
				volume: price.volume,
				source: price.source,
			},
		});
	}),
);

router.get(
	"/commodities/:slug/price",
	authenticate,
	cacheRoute("market:prices", 120),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const params = priceHistorySchema.parse(req.query);
		const { commodity, prices } = await getPriceHistory(req.params.slug, params);

		success(res, {
			commodity: {
				id: commodity.id,
				slug: commodity.slug,
				name: commodity.name,
				unit: commodity.unit,
			},
			interval: params.interval,
			prices,
			count: prices.length,
		});
	}),
);

router.get(
	"/commodities/:slug/price-multi",
	authenticate,
	cacheRoute("market:prices-multi", 120),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const interval = (req.query.interval as string) || "daily";
		const limit = Math.min(Number(req.query.limit) || 365, 10000);
		const result = await getPricesBySource(req.params.slug, interval, limit);
		success(res, result);
	}),
);

router.get(
	"/commodities/:slug/fundamentals",
	authenticate,
	cacheRoute("market:fundamentals", 600),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const result = await getFundamentals(req.params.slug);
		success(res, { ...result, count: result.factors.length });
	}),
);

router.get(
	"/factors/exchange-rates",
	authenticate,
	cacheRoute("market:exchange-rates", 300),
	asyncHandler(async (_req, res) => {
		const rates = await getLatestExchangeRates();
		success(res, { rates, count: rates.length });
	}),
);

router.get(
	"/sources",
	authenticate,
	cacheRoute("market:sources", 300),
	asyncHandler(async (_req, res) => {
		const health = scraperManager.getHealth();

		const sourceLabels: Record<string, { label: string; description: string; tier: string }> = {
			commodity_prices: {
				label: "Multi-Source Aggregator",
				description: "Aggregated commodity prices from multiple public sources",
				tier: "1",
			},
			weather: {
				label: "Weather Data",
				description: "Global weather data affecting commodity production",
				tier: "1",
			},
			usda_ams: {
				label: "USDA AMS",
				description:
					"US Department of Agriculture Agricultural Marketing Service — livestock, grain, dairy prices",
				tier: "1",
			},
			fao_prices: {
				label: "FAO",
				description:
					"UN Food and Agriculture Organization — global food price indices and commodity data",
				tier: "1",
			},
			world_bank: {
				label: "World Bank Pink Sheet",
				description:
					"World Bank monthly commodity prices — 70+ commodities, energy, metals, agriculture",
				tier: "1",
			},
			usda_psd: {
				label: "USDA FAS PSD",
				description:
					"USDA Foreign Agricultural Service — global production, supply, and distribution data",
				tier: "1",
			},
			fred: {
				label: "FRED",
				description:
					"Federal Reserve Economic Data — CPI, PPI, interest rates, commodity indices, exchange rates",
				tier: "1",
			},
			cme_futures: {
				label: "CME Group",
				description: "CME Group futures settlement prices — live cattle, grain, oil, metals",
				tier: "2",
			},
			abares: {
				label: "ABARES",
				description:
					"Australian Bureau of Agricultural and Resource Economics — beef/lamb/grain production & exports",
				tier: "2",
			},
			china_wholesale: {
				label: "China MARA",
				description:
					"中国农业农村部批发市场价格 — daily wholesale prices for meat, vegetables, fruits",
				tier: "2",
			},
			china_customs_stats: {
				label: "China Customs",
				description: "中国海关总署 — monthly import/export statistics by commodity and country",
				tier: "3",
			},
			cepea: {
				label: "CEPEA/B3",
				description:
					"Centro de Estudos Avançados em Economia Aplicada — Brazilian beef and commodity prices",
				tier: "2",
			},
			inac: {
				label: "INAC Uruguay",
				description: "Instituto Nacional de Carnes — Uruguayan beef export prices and volumes",
				tier: "2",
			},
			mla_nlrs: {
				label: "MLA Australia",
				description:
					"Meat & Livestock Australia — National Livestock Reporting Service, saleyard prices",
				tier: "2",
			},
			secex: {
				label: "SECEX Brazil",
				description:
					"Secretaria de Comércio Exterior — Brazilian beef export statistics by HS code",
				tier: "2",
			},
			argentina: {
				label: "INDEC Argentina",
				description:
					"Instituto Nacional de Estadística — Argentine agricultural production and export data",
				tier: "3",
			},
			shipping_index: {
				label: "Shipping Indices",
				description:
					"Shanghai Container Freight Index (SCFI/CCFI) — global container shipping rates",
				tier: "3",
			},
			dce_futures: {
				label: "DCE/CZCE",
				description:
					"大商所/郑商所期货 — domestic Chinese futures prices for soybean meal, corn, cotton, etc.",
				tier: "3",
			},
			baltic_dry: {
				label: "Baltic Dry Index",
				description: "Baltic Exchange dry bulk shipping cost index — global freight benchmark",
				tier: "3",
			},
		};

		const sources = Object.entries(sourceLabels).map(([key, info]) => {
			const h = health[key];
			// Status precedence (most informative first):
			//   skipped_no_key — gated, never ran this cycle
			//   empty          — ran but wrote 0 rows (silent failure: block/reformat/empty)
			//   healthy        — ran and wrote ≥1 row
			//   error          — ran and threw
			//   pending        — never ran
			// The `empty` state exists so the freshness board stops reporting
			// silently-failing sources (CEPEA behind Cloudflare, INAC network-
			// blocked) as `healthy`. See DATA-2 in docs/reviews/2026-07-19-known-issues.md.
			const status = h?.skippedNoKey
				? "skipped_no_key"
				: h?.emptyAfterRun
					? "empty"
					: h?.success
						? "healthy"
						: h?.lastRun
							? "error"
							: "pending";
			return {
				id: key,
				...info,
				status,
				lastRun: h?.lastRun ?? null,
				error: h?.error ?? null,
				lastResult: h?.lastResult ?? null,
			};
		});

		success(res, { sources, count: sources.length });
	}),
);

router.get(
	"/commodities/:slug/sources",
	authenticate,
	cacheRoute("market:commodity-sources", 300),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { slug } = req.params;

		const commodity = await prisma.commodity.findUnique({ where: { slug } });
		if (!commodity) {
			throw new NotFoundError(`Commodity '${slug}'`);
		}

		// Get distinct sources and their data coverage
		const sourceStats = await prisma.commodityPrice.groupBy({
			by: ["source"],
			where: { commodityId: commodity.id },
			_count: { id: true },
			_min: { date: true },
			_max: { date: true },
		});

		const factorStats = await prisma.marketFactor.groupBy({
			by: ["source", "type"],
			where: {
				date: { gte: new Date(Date.now() - 90 * MS_PER_DAY) },
			},
			_count: { id: true },
		});

		const sourceLabels: Record<string, string> = {
			usda_ams: "USDA AMS",
			fao: "FAO",
			world_bank: "World Bank",
			cme: "CME Group",
			fred: "FRED",
			usda_psd: "USDA PSD",
			commodity_prices: "Aggregated",
			china_mara: "China MARA",
			china_customs: "China Customs",
			manual: "Manual Import",
		};

		const priceSources = sourceStats.map((s) => ({
			id: s.source,
			label: sourceLabels[s.source] || s.source,
			priceCount: s._count.id,
			dateRange: { from: s._min.date, to: s._max.date },
		}));

		const factorSources = factorStats.map((f) => ({
			source: f.source,
			type: f.type,
			label: sourceLabels[f.source] || f.source,
			count: f._count.id,
		}));

		success(res, {
			commodity: {
				id: commodity.id,
				slug: commodity.slug,
				name: commodity.name,
				unit: commodity.unit,
			},
			priceSources,
			factorSources,
		});
	}),
);

router.post(
	"/import/preview",
	authenticate,
	authorize("ADMIN"),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		if (!req.is("multipart/form-data")) {
			throw new BadRequestError("Content-Type must be multipart/form-data");
		}

		// Lazy-load multer only when needed
		const multer = await import("multer");
		const upload = multer.default({
			storage: multer.default.memoryStorage(),
			limits: { fileSize: 10 * 1024 * 1024 },
		});

		await new Promise<void>((resolve, reject) => {
			upload.single("file")(
				req as Parameters<ReturnType<typeof upload.single>>[0],
				res as Parameters<ReturnType<typeof upload.single>>[1],
				(err) => {
					if (err) reject(new BadRequestError(err.message));
					else resolve();
				},
			);
		});

		const file = (req as unknown as { file?: MulterFile }).file;
		if (!file) {
			throw new BadRequestError("No file uploaded");
		}

		const rows = parseCSV(file.buffer);
		if (rows.length === 0) {
			throw new BadRequestError("CSV file is empty");
		}

		const headers = Object.keys(rows[0]);
		const mapping = detectFieldMapping(headers);
		const sample = rows.slice(0, 5);

		success(res, {
			headers,
			detectedMapping: mapping,
			rowCount: rows.length,
			sample,
		});
	}),
);

router.post(
	"/import",
	authenticate,
	authorize("ADMIN"),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		if (!req.is("multipart/form-data")) {
			throw new BadRequestError("Content-Type must be multipart/form-data");
		}

		const multer = await import("multer");
		const upload = multer.default({
			storage: multer.default.memoryStorage(),
			limits: { fileSize: 10 * 1024 * 1024 },
		});

		await new Promise<void>((resolve, reject) => {
			upload.single("file")(
				req as Parameters<ReturnType<typeof upload.single>>[0],
				res as Parameters<ReturnType<typeof upload.single>>[1],
				(err) => {
					if (err) reject(new BadRequestError(err.message));
					else resolve();
				},
			);
		});

		const file = (req as unknown as { file?: MulterFile }).file;
		if (!file) {
			throw new BadRequestError("No file uploaded");
		}

		const bodySchema = z.object({
			commodityId: z.string().min(1),
			interval: z.enum(["daily", "weekly", "monthly"]).default("daily"),
			delimiter: z.string().max(1).optional(),
			mapping: z.record(z.string()).optional(),
		});

		const params = bodySchema.parse(req.body);
		const rows = parseCSV(file.buffer, { delimiter: params.delimiter });

		if (rows.length === 0) {
			throw new BadRequestError("CSV file is empty");
		}

		let mapping: FieldMapping | undefined;
		if (params.mapping) {
			const m = params.mapping;
			mapping = {
				date: m.date,
				close: m.close,
				open: m.open,
				high: m.high,
				low: m.low,
				volume: m.volume,
			};
		} else {
			const headers = Object.keys(rows[0]);
			mapping = detectFieldMapping(headers);
		}

		// biome-ignore lint/style/noNonNullAssertion: mapping is set in all branches above
		const result = await importRows(params.commodityId, rows, mapping!, params.interval);

		success(res, {
			imported: result.inserted + result.updated,
			...result,
		});
	}),
);

// Manual scraper trigger — run a single source
router.post(
	"/sources/:sourceId/refresh",
	authenticate,
	authorize("ADMIN"),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { sourceId } = req.params;
		const health = scraperManager.getHealth();

		if (!health[sourceId] && !scraperManager.getHealth()[sourceId]) {
			throw new NotFoundError(`Data source '${sourceId}'`);
		}

		const startTime = Date.now();
		try {
			const result = await scraperManager.runSource(sourceId);
			const elapsed = Date.now() - startTime;

			await prisma.ingestionLog.create({
				data: {
					source: sourceId,
					status: "success",
					inserted: result.inserted,
					updated: result.updated,
					durationMs: elapsed,
				},
			});

			success(res, { source: sourceId, ...result, elapsedMs: elapsed });
		} catch (err) {
			const elapsed = Date.now() - startTime;
			await prisma.ingestionLog.create({
				data: {
					source: sourceId,
					status: "error",
					errorMessage: err instanceof Error ? err.message : String(err),
					durationMs: elapsed,
				},
			});
			throw err;
		}
	}),
);

// Refresh all sources — admin only
router.post(
	"/sources/refresh-all",
	authenticate,
	authorize("ADMIN"),
	asyncHandler(async (_req, res) => {
		const startTime = Date.now();
		const results = await scraperManager.runAll();
		const elapsed = Date.now() - startTime;

		for (const [source, result] of Object.entries(results)) {
			if ("error" in result) {
				await prisma.ingestionLog.create({
					data: {
						source,
						status: "error",
						errorMessage: result.error,
						durationMs: elapsed,
					},
				});
			} else {
				const r = result as { inserted: number; updated: number };
				await prisma.ingestionLog.create({
					data: {
						source,
						status: "success",
						inserted: r.inserted,
						updated: r.updated,
						durationMs: elapsed,
					},
				});
			}
		}

		success(res, { results, elapsedMs: elapsed });
	}),
);

// Data freshness monitoring
router.get(
	"/sources/freshness",
	authenticate,
	asyncHandler(async (_req, res) => {
		const result = await getSourceFreshness();
		success(res, result);
	}),
);

// Per-commodity data freshness — last price date for each commodity.
// Complements /sources/freshness (which tracks scraper runs) by answering
// "which commodities actually have fresh price data". Stale threshold is one
// week (price data is daily, so a week gap signals a stalled source).
router.get(
	"/commodities/freshness",
	authenticate,
	asyncHandler(async (_req, res) => {
		const result = await getCommodityFreshness();
		success(res, result);
	}),
);

// Ingestion history for a specific source
router.get(
	"/sources/:sourceId/history",
	authenticate,
	asyncHandler(async (req, res) => {
		const { sourceId } = req.params;
		const limit = Math.min(Number(req.query.limit) || 20, 100);

		const logs = await prisma.ingestionLog.findMany({
			where: { source: sourceId },
			orderBy: { createdAt: "desc" },
			take: limit,
		});

		success(res, { source: sourceId, logs, count: logs.length });
	}),
);

export { router as marketDataRouter };
