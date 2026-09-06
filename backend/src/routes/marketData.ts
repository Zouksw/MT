import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { MS_PER_DAY } from "@/lib/constants";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate, authorize } from "@/middleware/auth";
import { cacheRoute } from "@/middleware/cacheDecorator";
import { asyncHandler, NotFoundError } from "@/middleware/errorHandler";
import { stalenessWindowDaysForSeries } from "@/services/cadence";
import { scraperManager } from "@/services/dataIngestion";
import { classifyIngestionStatus } from "@/services/dataIngestion/helpers";
import { HS_CODES } from "@/services/dataIngestion/sources/comtradeMirror";
import {
	getCommodityFreshness,
	getFundamentals,
	getLatestExchangeRates,
	getLatestPrice,
	getPriceHistory,
	getPricesBySource,
	getSourceFreshness,
	getTradeFlows,
	listCommodities,
} from "@/services/marketService";

const router = Router();

/**
 * How directly a data source relates to the platform's beef-only focus.
 * - direct:   source writes beef cut/carcass prices (the core asset)
 * - adjacent: source writes cattle/livestock/feed/trade data (context for beef)
 * - macro:    source writes non-beef data (FX, energy, metals, weather)
 * Surfaced on /api/market/sources so the data-sources board can tell
 * "beef data is flowing" apart from "some data is flowing".
 */
type BeefRelevance = "direct" | "adjacent" | "macro";

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

/**
 * Slugs exposed WITHOUT authentication on /public/highlights. The landing
 * page's "live data" strip consumes this — only curated public macro series
 * may appear here; user datasets/timeseries must never be listable
 * anonymously (IMPROVEMENT-PLAN batch 1a).
 */
const PUBLIC_HIGHLIGHT_SLUGS = ["beef_carcass_us"] as const;

router.get(
	"/public/highlights",
	cacheRoute("market:public-highlights", 300),
	asyncHandler(async (_req, res) => {
		const highlights = await Promise.all(
			PUBLIC_HIGHLIGHT_SLUGS.map(async (slug) => {
				try {
					const { commodity, price } = await getLatestPrice(slug);
					if (!price || price.close == null) {
						return {
							slug,
							name: commodity.name,
							unit: commodity.unit,
							status: "no_data" as const,
						};
					}
					// Interval-agnostic history: daily first, fall back to
					// monthly (the IMF beef benchmark is monthly — round-126;
					// a daily-only query returned an empty series and nulled
					// the change %).
					let { prices } = await getPriceHistory(slug, {
						interval: "daily",
						limit: 30,
					});
					if (prices.length === 0) {
						({ prices } = await getPriceHistory(slug, {
							interval: "monthly",
							limit: 30,
						}));
					}
					// Decimal(…) → number for JSON; round to 2dp for display
					// (the IMF series carries 6+ decimals from period
					// averaging); series stays chronological.
					const series = prices
						.filter((p) => p.close != null)
						.map((p) => ({ date: p.date, close: Math.round(Number(p.close) * 100) / 100 }));
					const prev = series.length >= 2 ? series[series.length - 2].close : null;
					const close = Math.round(Number(price.close) * 100) / 100;
					const dayChangePct =
						prev != null && prev > 0 ? Math.round(((close - prev) / prev) * 10000) / 100 : null;
					return {
						slug,
						name: commodity.name,
						unit: commodity.unit,
						status: "ok" as const,
						latest: { date: price.date, close, source: price.source },
						// FRED series id when present — the landing panel surfaces it so
						// the displayed value stays traceable to its source series.
						seriesId: (commodity.metadata as { seriesId?: string } | null)?.seriesId ?? null,
						dayChangePct,
						series,
					};
				} catch {
					// Unknown slug or DB hiccup — degrade to a status marker so one
					// bad entry can't break the whole public strip.
					return { slug, status: "error" as const };
				}
			}),
		);
		success(res, { highlights });
	}),
);

/**
 * Slugs exposed WITHOUT authentication on /public/digest — the public
 * Chinese market digest page (/market/digest, IMPROVEMENT-PLAN v3.3.0
 * batch 1). Same whitelist discipline as /public/highlights: curated
 * public macro/cattle/FX series only; user datasets/timeseries must never
 * appear here. Reads go through the authoritative-source filter
 * (getLatestPrice/getPriceHistory), so multi-source slugs serve their
 * declared source.
 */
const PUBLIC_DIGEST_SLUGS = [
	"beef_carcass_us",
	// Weekly US import 90CL manufacturing-beef benchmark (USDA NW_LS421,
	// round-155 批D) — the digest's cadence logic is interval-generic, so
	// weekly serves 本周=vs previous weekly point and the 21d staleness
	// window from cadence.ts, no weekly-specific branch needed.
	"beef_90cl_us",
	"live_cattle_cme",
	"feeder_cattle_cme",
	"usd_cny",
	"brl_usd",
] as const;

router.get(
	"/public/digest",
	cacheRoute("market:public-digest", 300),
	asyncHandler(async (_req, res) => {
		const series = await Promise.all(
			PUBLIC_DIGEST_SLUGS.map(async (slug) => {
				try {
					const { commodity, price } = await getLatestPrice(slug);
					if (!price || price.close == null) {
						return {
							slug,
							name: commodity.name,
							nameCn: commodity.nameCn,
							unit: commodity.unit,
							category: commodity.category,
							status: "no_data" as const,
						};
					}
					// The latest row's own cadence decides the history window
					// and the change semantics — daily series get DoD/WoW,
					// monthly get MoM (a weekly window on a monthly series
					// would be fabricated precision).
					const interval = (price.interval ?? "daily") as "daily" | "weekly" | "monthly";
					const { prices } = await getPriceHistory(slug, { interval, limit: 30 });
					const points = prices
						.filter((p) => p.close != null)
						.map((p) => ({ date: p.date, close: Math.round(Number(p.close) * 100) / 100 }));
					const close = Math.round(Number(price.close) * 100) / 100;
					const pct = (from: number) =>
						from > 0 ? Math.round(((close - from) / from) * 10000) / 100 : null;
					const prevPointChangePct =
						points.length >= 2 ? pct(points[points.length - 2].close) : null;
					// 本周变化 (the digest page's weekly-report section): for
					// daily series, vs the newest point ≥6 days older than the
					// latest (≈a 7-day window); monthly series report null and
					// the page falls back to MoM.
					const wowChangePct =
						interval === "monthly"
							? null
							: (() => {
									const cutoff = new Date(new Date(price.date).getTime() - 6 * MS_PER_DAY);
									const base = [...points].reverse().find((p) => new Date(p.date) <= cutoff);
									return base ? pct(base.close) : null;
								})();
					const ageDays = (Date.now() - new Date(price.date).getTime()) / MS_PER_DAY;
					return {
						slug,
						name: commodity.name,
						nameCn: commodity.nameCn,
						unit: commodity.unit,
						category: commodity.category,
						status: "ok" as const,
						latest: { date: price.date, close, source: price.source },
						interval,
						seriesId: (commodity.metadata as { seriesId?: string } | null)?.seriesId ?? null,
						prevPointChangePct,
						wowChangePct,
						momChangePct: interval === "monthly" ? prevPointChangePct : null,
						// Publication-rhythm aware (round-158 批C): FX H.10 rows are
						// weekly-batched, so the plain 7d daily window flagged healthy
						// FX as 数据滞后 on this surface too — same override as
						// /commodities/freshness so both faces agree.
						stale: ageDays > stalenessWindowDaysForSeries(interval, slug),
						series: points,
					};
				} catch {
					// Unknown slug or DB hiccup — degrade to a status marker so
					// one bad entry can't break the whole public digest.
					return { slug, status: "error" as const };
				}
			}),
		);
		success(res, { digest: { generatedAt: new Date().toISOString(), series } });
	}),
);

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

/**
 * Trade flows to China (V8 批4; deepened round-155 批C): per-country monthly
 * volume / unit price / MoM + per-country history series (24 periods, for
 * charting) + the Argentina all-destinations FOB context, plus the
 * China-reported annual CIF calibration table. 鉴权内起步 per D25 — the
 * 口径注记 (notes) travel with the payload and are mandatory UI on every
 * consumer. Single hs param from the mirror's pinned HS set (query-set
 * contract lives in the source module).
 */
const tradeFlowsSchema = z.object({
	hs: z.enum(HS_CODES).default("0202"),
});

router.get(
	"/trade-flows",
	authenticate,
	cacheRoute("market:trade-flows", 3600),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { hs } = tradeFlowsSchema.parse(req.query);
		success(res, await getTradeFlows(hs));
	}),
);

router.get(
	"/sources",
	authenticate,
	cacheRoute("market:sources", 300),
	asyncHandler(async (_req, res) => {
		const health = scraperManager.getHealth();

		// beefRelevance classifies each source against the platform's beef-only
		// focus (PRODUCT-SPEC §九). This exists so the data-sources board can
		// distinguish "a beef source is healthy" from "some source is healthy" —
		// without it, the 2 healthy sources (commodity_prices = FX, world_bank =
		// non-beef) make the board look like beef data is flowing when it isn't.
		// See DATA-4 in docs/reviews/2026-07-19-known-issues.md.
		const sourceLabels: Record<
			string,
			{ label: string; description: string; tier: string; beefRelevance: BeefRelevance }
		> = {
			commodity_prices: {
				label: "Multi-Source Aggregator",
				description: "Aggregated commodity prices from multiple public sources",
				tier: "1",
				beefRelevance: "macro",
			},
			weather: {
				label: "Weather Data",
				description: "Global weather data affecting commodity production",
				tier: "1",
				beefRelevance: "macro",
			},
			usda_ams: {
				label: "USDA AMS",
				description:
					"US Department of Agriculture Agricultural Marketing Service — livestock, grain, dairy prices",
				tier: "1",
				beefRelevance: "direct",
			},
			fao_prices: {
				label: "FAO",
				description:
					"UN Food and Agriculture Organization — global food price indices and commodity data",
				tier: "1",
				beefRelevance: "macro",
			},
			world_bank: {
				label: "World Bank Pink Sheet",
				description:
					"World Bank monthly commodity prices — 70+ commodities, energy, metals, agriculture",
				tier: "1",
				beefRelevance: "macro",
			},
			usda_psd: {
				label: "USDA FAS PSD",
				description:
					"USDA Foreign Agricultural Service — global production, supply, and distribution data",
				tier: "1",
				beefRelevance: "adjacent",
			},
			fred: {
				label: "FRED",
				description:
					"Federal Reserve Economic Data — CPI, PPI, interest rates, commodity indices, exchange rates",
				tier: "1",
				beefRelevance: "macro",
			},
			cme_futures: {
				label: "CME Group",
				description: "CME Group futures settlement prices — live cattle, grain, oil, metals",
				tier: "2",
				beefRelevance: "adjacent",
			},
			abares: {
				label: "ABARES",
				description:
					"Australian Bureau of Agricultural and Resource Economics — beef/lamb/grain production & exports",
				tier: "2",
				beefRelevance: "adjacent",
			},
			china_wholesale: {
				label: "China MARA",
				description:
					"中国农业农村部批发市场价格 — daily wholesale prices for meat, vegetables, fruits",
				tier: "2",
				beefRelevance: "adjacent",
			},
			comtrade_mirror: {
				label: "UN Comtrade Mirror",
				description:
					"UN Comtrade 公共预览 API — 分国别×HS×月度对华出口量价（出口国 FOB 镜像 + 中国年度 CIF 校准，V8 批0）",
				tier: "3",
				beefRelevance: "adjacent",
			},
			comext_eu: {
				label: "Eurostat Comext EU",
				description:
					"Eurostat Comext DS-045409 — 欧盟输华批准国（IE/NL/FR/PL）月度 CN8 级对华量价（FOB-EUR 口径，与美元镜像并列不合并）",
				tier: "3",
				beefRelevance: "adjacent",
			},
			cepea: {
				label: "CEPEA/B3",
				description:
					"Centro de Estudos Avançados em Economia Aplicada — Brazilian beef and commodity prices",
				tier: "2",
				beefRelevance: "direct",
			},
			argentina_exports: {
				label: "Argentina SSPM/ICA",
				description:
					"datos.gob.ar SSPM 75.3 — 阿根廷肉类及制品 FOB 出口月度序列（产品族×全球，目的国交叉为登记缺口，V8 批2）",
				tier: "2",
				beefRelevance: "direct",
			},
			inac: {
				label: "INAC Uruguay",
				description: "Instituto Nacional de Carnes — Uruguayan beef export prices and volumes",
				tier: "2",
				beefRelevance: "direct",
			},
			mla_nlrs: {
				label: "MLA Australia",
				description:
					"Meat & Livestock Australia — National Livestock Reporting Service, saleyard prices",
				tier: "2",
				beefRelevance: "direct",
			},
			usda_import_beef: {
				label: "USDA AMS NW_LS421",
				description:
					"US import manufacturing-beef trade, weekly PDF (ams_2823) — AU/NZ 90CL East Coast benchmark → beef_90cl_us",
				tier: "2",
				beefRelevance: "direct",
			},
			secex: {
				label: "SECEX Brazil",
				description:
					"Secretaria de Comércio Exterior — Brazilian beef export statistics by HS code",
				tier: "2",
				beefRelevance: "adjacent",
			},
			shipping_index: {
				label: "Shipping Indices",
				description:
					"Shanghai Container Freight Index (SCFI/CCFI) — global container shipping rates",
				tier: "3",
				beefRelevance: "macro",
			},
			dce_futures: {
				label: "DCE/CZCE",
				description:
					"大商所/郑商所期货 — domestic Chinese futures prices for soybean meal, corn, cotton, etc.",
				tier: "3",
				beefRelevance: "macro",
			},
			baltic_dry: {
				label: "Baltic Dry Index",
				description: "Baltic Exchange dry bulk shipping cost index — global freight benchmark",
				tier: "3",
				beefRelevance: "macro",
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
				// round-119: the raw scraper error string is no longer exposed —
				// this route's cacheRoute is shared across ALL users (varyByUser
				// defaults to false), so role-gating the field is not coherent,
				// and the message can carry internal hostnames/URLs. The status
				// enum above already tells the board a source failed; diagnosis
				// lives in the PM2 logs where the full error is recorded.
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

			// Shared 0-row honesty contract (helpers.classifyIngestionStatus):
			// a manual refresh that returns 0 rows is logged as "warning", not
			// "success" — matches the scheduled path so successRate reflects real
			// writes, not "the scraper didn't throw".
			const { status } = classifyIngestionStatus(result);
			await prisma.ingestionLog.create({
				data: {
					source: sourceId,
					status,
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

		// One createMany instead of ~19 sequential round-trips (round-106).
		const rows: Array<{
			source: string;
			status: string;
			errorMessage?: string;
			inserted?: number;
			updated?: number;
			durationMs: number;
		}> = [];
		for (const [source, result] of Object.entries(results)) {
			if ("error" in result) {
				rows.push({
					source,
					status: "error",
					errorMessage: result.error,
					durationMs: elapsed,
				});
			} else {
				const r = result as { inserted: number; updated: number };
				// Shared 0-row honesty contract (helpers.classifyIngestionStatus):
				// 0-row refresh-all run logs as "warning", matching the scheduled
				// path and the single-source refresh.
				const { status } = classifyIngestionStatus(r);
				rows.push({
					source,
					status,
					inserted: r.inserted,
					updated: r.updated,
					durationMs: elapsed,
				});
			}
		}
		if (rows.length > 0) {
			await prisma.ingestionLog.createMany({ data: rows });
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
// "which commodities actually have fresh price data". Stale windows are
// cadence-aware (7d daily / 21d weekly / 90d monthly, services/cadence.ts)
// plus publication-rhythm overrides for weekly-batched daily series
// (H.10 FX trio, round-158 批C).
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
