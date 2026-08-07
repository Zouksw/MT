/**
 * Beef aggregation service — extracted from routes/beef.ts (TD-6).
 *
 * Holds the business logic that was previously inlined in the
 * `GET /api/beef/by-country` handler (beef.ts:280-355). Extracted so the
 * origin-comparison aggregation is unit/integration-testable independent of
 * the Express layer (the route had zero test coverage — see
 * routes/__tests__/beef.test.ts).
 *
 * Behaviour is preserved byte-for-byte from the original inline handler:
 * single latest-date snapshot, group by factory.country, per-country
 * avg/min/max + top-priced-cuts breakdown, deterministic sort by country.
 */

import { prisma } from "@/lib";

export interface CountryAggregate {
	country: string;
	avgPrice: number;
	minPrice: number;
	maxPrice: number;
	cutCount: number;
	factoryCount: number;
	topCuts: Array<{ cutCode: string; price: number }>;
}

export interface BeefByCountryResult {
	countries: CountryAggregate[];
	date: Date | null;
	count: number;
}

/**
 * Aggregate the latest BeefCutPrice snapshot by factory country.
 *
 * Picks the single most-recent date with data (apples-to-apples across
 * countries — mixing dates would skew the averages), then groups rows by
 * country and computes per-country avg/min/max price, unique cut count,
 * factory count, and a per-cut breakdown (top priced cuts, capped).
 *
 * @param source    Optional source filter (restricts both the latest-date
 *                  lookup and the row fetch to one data source).
 * @param cutsLimit Max number of per-cut entries per country (default 5,
 *                  capped at 20). Mirrors the `?cuts=` query param.
 */
export async function aggregateBeefByCountry(
	source?: string,
	cutsLimit: number = 5,
): Promise<BeefByCountryResult> {
	const limit = Math.min(cutsLimit, 20);

	// Find the most recent date with data, then aggregate on that date.
	const latest = await prisma.beefCutPrice.findFirst({
		where: source ? { source } : {},
		orderBy: { date: "desc" },
		select: { date: true },
	});
	if (!latest) {
		return { countries: [], date: null, count: 0 };
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
		// Keep the first price per cutCode within a country.
		if (!bucket.cuts.has(r.cutCode)) bucket.cuts.set(r.cutCode, price);
		if (r.factory?.code) bucket.factories.add(r.factory.code);
	}

	const countries: CountryAggregate[] = Array.from(byCountry.values())
		.map((b) => {
			const sum = b.prices.reduce((s, p) => s + p, 0);
			const avg = b.prices.length > 0 ? sum / b.prices.length : 0;
			const min = b.prices.length > 0 ? Math.min(...b.prices) : 0;
			const max = b.prices.length > 0 ? Math.max(...b.prices) : 0;
			const topCuts = Array.from(b.cuts.entries())
				.sort((a, z) => z[1] - a[1]) // highest price first
				.slice(0, limit)
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

	return { countries, date: latest.date, count: countries.length };
}
