import { Router } from "express";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { authenticate } from "@/middleware/auth";
import { asyncHandler, NotFoundError } from "@/middleware/errorHandler";
import { pageFreshnessSummary, withFreshness } from "@/services/beefFreshness";

const router = Router();

// Public routes (no auth required for data viewing)

// List all factories
router.get(
	"/factories",
	asyncHandler(async (_req, res) => {
		const factories = await prisma.factory.findMany({
			where: { active: true },
			orderBy: [{ country: "asc" }, { name: "asc" }],
			take: 200,
		});
		success(res, { factories, count: factories.length });
	}),
);

// Get factory by code
router.get(
	"/factories/:code",
	asyncHandler(async (req, res) => {
		const factory = await prisma.factory.findUnique({
			where: { code: req.params.code },
		});
		if (!factory) {
			throw new NotFoundError("Factory not found");
		}
		success(res, factory);
	}),
);

// List all beef cuts (taxonomy)
router.get(
	"/cuts",
	asyncHandler(async (_req, res) => {
		const cuts = await prisma.beefCutTaxonomy.findMany({
			orderBy: [{ primal: "asc" }, { nameEn: "asc" }],
			take: 200,
		});
		success(res, { cuts, count: cuts.length });
	}),
);

// Get cuts grouped by primal
router.get(
	"/cuts/by-primal",
	asyncHandler(async (_req, res) => {
		const cuts = await prisma.beefCutTaxonomy.findMany({
			orderBy: [{ primal: "asc" }, { nameEn: "asc" }],
		});
		const grouped: Record<string, typeof cuts> = {};
		for (const cut of cuts) {
			const key = cut.primal || "Other";
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(cut);
		}
		success(res, grouped);
	}),
);

// Get cut by code
router.get(
	"/cuts/:cutCode",
	asyncHandler(async (req, res) => {
		const cut = await prisma.beefCutTaxonomy.findUnique({
			where: { cutCode: req.params.cutCode },
		});
		if (!cut) {
			throw new NotFoundError("Cut not found");
		}
		success(res, cut);
	}),
);

// Query beef cut prices with flexible filters
router.get(
	"/prices",
	asyncHandler(async (req, res) => {
		const { cutCode, factoryCode, country, source, grade, days = "30" } = req.query;

		const daysNum = Math.min(Number(days) || 30, 365);
		const since = new Date();
		since.setDate(since.getDate() - daysNum);

		const where: Record<string, unknown> = {
			date: { gte: since },
		};

		if (cutCode && typeof cutCode === "string") {
			where.cutCode = cutCode;
		}
		if (source && typeof source === "string") {
			where.source = source;
		}
		if (grade && typeof grade === "string") {
			where.grade = grade;
		}
		if (factoryCode && typeof factoryCode === "string") {
			const factory = await prisma.factory.findUnique({
				where: { code: factoryCode },
			});
			if (factory) {
				where.factoryId = factory.id;
			}
		}
		if (country && typeof country === "string" && !factoryCode) {
			const factories = await prisma.factory.findMany({
				where: { country: country as string },
				select: { id: true },
				take: 100,
			});
			where.factoryId = { in: factories.map((f) => f.id) };
		}

		const prices = await prisma.beefCutPrice.findMany({
			where,
			orderBy: { date: "desc" },
			take: 500,
			include: {
				factory: { select: { code: true, name: true, country: true } },
			},
		});

		// Attach the honesty-framework freshness tier to each row + a page-level
		// summary so the UI can show a "demo snapshot mode" banner when no live
		// data is present. See services/beefFreshness.ts.
		const pricesWithFreshness = withFreshness(prices);
		const freshness = pageFreshnessSummary(prices);

		success(res, { prices: pricesWithFreshness, count: pricesWithFreshness.length, freshness });
	}),
);

// Price summary per cut (latest price for each cut)
router.get(
	"/prices/latest",
	asyncHandler(async (req, res) => {
		const { country, source } = req.query;

		// Get the most recent date
		const latest = await prisma.beefCutPrice.findFirst({
			where: {
				...(source ? { source: source as string } : {}),
			},
			orderBy: { date: "desc" },
			select: { date: true },
		});

		if (!latest) {
			return success(res, { prices: [], date: null, freshness: null });
		}

		const factoryFilter = country ? { factory: { country: country as string } } : {};

		const prices = await prisma.beefCutPrice.findMany({
			where: {
				date: latest.date,
				...(source ? { source: source as string } : {}),
				...factoryFilter,
			},
			include: {
				factory: { select: { code: true, name: true, country: true } },
			},
			orderBy: { cutCode: "asc" },
		});

		// Attach freshness tiers + page summary (same as /prices).
		const pricesWithFreshness = withFreshness(prices);
		const freshness = pageFreshnessSummary(prices);

		success(res, {
			prices: pricesWithFreshness,
			date: latest.date,
			count: pricesWithFreshness.length,
			freshness,
		});
	}),
);

/**
 * GET /api/beef/by-country
 *
 * Origin-comparison view (PRODUCT-SPEC §四 "分析 > 产地对比"): aggregates the
 * latest BeefCutPrice rows by factory.country so the frontend can render a
 * side-by-side comparison of imported-beef prices across BR/AU/AR/UY/US/etc.
 *
 * Returns, per country: avg/min/max price, cut count, factory count, and a
 * per-cut breakdown (top priced cuts). Optional ?cuts=N limits the per-cut
 * list (default 5). Optional ?source= filters by data source.
 *
 * Public (no auth) — price data is the product's public market surface.
 */
router.get(
	"/by-country",
	asyncHandler(async (req, res) => {
		const source = req.query.source as string | undefined;
		const cutsLimit = Math.min(Number(req.query.cuts) || 5, 20);

		// Find the most recent date with data, then aggregate by country on that
		// date. Using a single date gives an apples-to-apples comparison (vs.
		// mixing dates which would skew the country averages).
		const latest = await prisma.beefCutPrice.findFirst({
			where: source ? { source } : {},
			orderBy: { date: "desc" },
			select: { date: true },
		});
		if (!latest) {
			return success(res, { countries: [], date: null });
		}

		const rows = await prisma.beefCutPrice.findMany({
			where: {
				date: latest.date,
				...(source ? { source } : {}),
			},
			include: { factory: { select: { country: true, code: true, name: true } } },
		});

		// Group by country → aggregate + per-cut breakdown.
		const byCountry = new Map<
			string,
			{
				country: string;
				prices: number[];
				cuts: Map<string, number>;
				factories: Set<string>;
			}
		>();
		for (const r of rows) {
			const country = r.factory?.country ?? "?";
			const price = typeof r.price === "number" ? r.price : Number(r.price);
			if (!Number.isFinite(price)) continue;
			let bucket = byCountry.get(country);
			if (!bucket) {
				bucket = { country, prices: [], cuts: new Map(), factories: new Set() };
				byCountry.set(country, bucket);
			}
			bucket.prices.push(price);
			// Keep the latest (highest? first?) price per cutCode within a country.
			if (!bucket.cuts.has(r.cutCode)) bucket.cuts.set(r.cutCode, price);
			if (r.factory?.code) bucket.factories.add(r.factory.code);
		}

		const countries = Array.from(byCountry.values())
			.map((b) => {
				const sum = b.prices.reduce((s, p) => s + p, 0);
				const avg = b.prices.length > 0 ? sum / b.prices.length : 0;
				const min = b.prices.length > 0 ? Math.min(...b.prices) : 0;
				const max = b.prices.length > 0 ? Math.max(...b.prices) : 0;
				const topCuts = Array.from(b.cuts.entries())
					.sort((a, z) => z[1] - a[1]) // highest price first
					.slice(0, cutsLimit)
					.map(([cutCode, price]) => ({ cutCode, price: Math.round(price * 100) / 100 }));
				return {
					country: b.country,
					avgPrice: Math.round(avg * 100) / 100,
					minPrice: Math.round(min * 100) / 100,
					maxPrice: Math.round(max * 100) / 100,
					cutCount: b.cuts.size,
					factoryCount: b.factories.size,
					topCuts,
				};
			})
			.sort((a, b) => a.country.localeCompare(b.country));

		success(res, { countries, date: latest.date, count: countries.length });
	}),
);

// Price history for a specific cut
router.get(
	"/prices/history/:cutCode",
	asyncHandler(async (req, res) => {
		const { cutCode } = req.params;
		const { days = "90", factoryCode, source } = req.query;

		const daysNum = Math.min(Number(days) || 90, 730);
		const since = new Date();
		since.setDate(since.getDate() - daysNum);

		const where: Record<string, unknown> = {
			cutCode,
			date: { gte: since },
		};

		if (source && typeof source === "string") {
			where.source = source;
		}

		if (factoryCode && typeof factoryCode === "string") {
			const factory = await prisma.factory.findUnique({
				where: { code: factoryCode },
			});
			if (factory) {
				where.factoryId = factory.id;
			}
		}

		const prices = await prisma.beefCutPrice.findMany({
			where,
			orderBy: { date: "asc" },
			include: {
				factory: { select: { code: true, name: true, country: true } },
			},
			take: 1000,
		});

		success(res, { cutCode, prices, count: prices.length });
	}),
);

// Weekly kill data
router.get(
	"/weekly-kill",
	asyncHandler(async (req, res) => {
		const { country, weeks = "12" } = req.query;

		const weeksNum = Math.min(Number(weeks) || 12, 52);
		const since = new Date();
		since.setDate(since.getDate() - weeksNum * 7);

		const where: Record<string, unknown> = {
			weekEnding: { gte: since },
		};
		if (country && typeof country === "string") {
			where.country = country;
		}

		const kills = await prisma.weeklyKill.findMany({
			where,
			orderBy: { weekEnding: "desc" },
			take: 500,
		});

		success(res, { kills, count: kills.length });
	}),
);

// Cold storage data
router.get(
	"/cold-storage",
	asyncHandler(async (req, res) => {
		const { country, months = "12" } = req.query;

		const monthsNum = Math.min(Number(months) || 12, 60);
		const since = new Date();
		since.setMonth(since.getMonth() - monthsNum);

		const where: Record<string, unknown> = {
			date: { gte: since },
			category: "beef",
		};
		if (country && typeof country === "string") {
			where.country = country;
		}

		const storage = await prisma.coldStorage.findMany({
			where,
			orderBy: { date: "desc" },
			take: 200,
		});

		success(res, { coldStorage: storage, count: storage.length });
	}),
);

// Price spread analysis (FOB vs wholesale vs retail)
router.get(
	"/spreads",
	authenticate,
	asyncHandler(async (req, res) => {
		const { cutCode, days = "30" } = req.query;

		const daysNum = Math.min(Number(days) || 30, 365);
		const since = new Date();
		since.setDate(since.getDate() - daysNum);

		const where: Record<string, unknown> = {
			date: { gte: since },
		};
		if (cutCode && typeof cutCode === "string") {
			where.cutCode = cutCode;
		}

		const prices = await prisma.beefCutPrice.findMany({
			where,
			select: {
				cutCode: true,
				price: true,
				currency: true,
				source: true,
				date: true,
				factory: { select: { country: true } },
			},
			orderBy: { date: "desc" },
			take: 1000,
		});

		// Group by (cutCode, date, source) to show spreads
		const spreads: Record<
			string,
			Record<string, { min: number; max: number; avg: number; count: number }>
		> = {};
		for (const p of prices) {
			const key = p.cutCode;
			if (!spreads[key]) spreads[key] = {};
			const sourceKey = `${p.source} (${p.factory?.country || "unknown"})`;
			if (!spreads[key][sourceKey]) {
				spreads[key][sourceKey] = {
					min: p.price,
					max: p.price,
					avg: p.price,
					count: 1,
				};
			} else {
				const s = spreads[key][sourceKey];
				s.min = Math.min(s.min, p.price);
				s.max = Math.max(s.max, p.price);
				s.avg = (s.avg * s.count + p.price) / (s.count + 1);
				s.count++;
			}
		}

		success(res, { spreads });
	}),
);

export { router as beefRouter };
