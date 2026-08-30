/**
 * Import landing-cost calculator (v3.2.0 批 3, promoted from v3.0.0 批 A).
 *
 * A transparent per-kg landed-cost reference for beef importers:
 *
 *   landedUsdPerKg = (base + freight + fees)            // CIF-like cost base
 *                      × (1 + tariffPct/100)            // duty on cost base
 *                      × … then VAT on (base + duty)    // China import VAT base
 *                      × (1 + lossPct/100)              // shrinkage allowance
 *   cnyPerKg       = landedUsdPerKg × USD/CNY
 *
 * Honesty rules baked in (PRODUCT-SPEC §九 / AGENTS §十.3):
 *   - Duty/VAT/freight/loss are USER-SUPPLIED assumptions. The platform does
 *     NOT ship per-country tariff presets — hardcoding "AU 关税 X%" would be
 *     fabricating data. The only live inputs are whitelisted price series
 *     and the USD/CNY rate, each returned with its date + staleness flag.
 *   - Unknown unit dimensions are refused (null), never guessed.
 *   - The low/high band re-runs the same formula on the base series' recent
 *     window (daily → last 30 points, monthly → last 3), so the "区间" is
 *     data-driven, not an invented ±%.
 */

import { stalenessWindowDays } from "@/services/cadence";
import { getLatestPrice, getPriceHistory } from "@/services/marketService";

/** Base series whitelist — public macro series only, same discipline as
 * PUBLIC_HIGHLIGHT_SLUGS (marketData.ts): nothing user-private may appear. */
export const LANDING_COST_BASE_SERIES = {
	beef_90cl_us: { label: "美国进口 90CL 周度到岸基准（USDA NW_LS421）", unit: "USD/cwt" },
	beef_carcass_us: { label: "全球牛肉月度基准（IMF via FRED）", unit: "USC/lb" },
	live_cattle_cme: { label: "活牛期货（CME）", unit: "USD/cwt" },
	feeder_cattle_cme: { label: "架子牛期货（CME）", unit: "USD/cwt" },
} as const;

export type LandingBaseSlug = keyof typeof LANDING_COST_BASE_SERIES;

/** Origin FX shown for reference only (prices here are USD-denominated, so
 * origin currency is informational context, not an input to the math). */
export const ORIGIN_REF_SERIES = {
	aud_usd: "AUD/USD（澳元）",
	brl_usd: "BRL/USD（雷亚尔）",
} as const;

export type OriginRefSlug = keyof typeof ORIGIN_REF_SERIES;

const LB_PER_KG = 2.20462262185;

/**
 * Convert a whitelisted series' native quote to USD/kg.
 * USC/lb: US cents per lb → ÷100 = USD/lb → × 2.2046 = USD/kg.
 * USD/cwt: USD per 100 lb → ÷100 = USD/lb → × 2.2046 = USD/kg.
 * Unknown dimension → null (caller degrades honestly instead of guessing).
 */
export function toUsdPerKg(close: number, unit: string | null | undefined): number | null {
	if (!Number.isFinite(close)) return null;
	if (unit === "USC/lb" || unit === "USD/cwt") return (close / 100) * LB_PER_KG;
	if (unit === "USD/kg") return close;
	return null;
}

export interface LandedCostParams {
	tariffPct: number;
	vatPct: number;
	freightUsdPerKg: number;
	feesUsdPerKg: number;
	lossPct: number;
}

export interface LandedCostBreakdown {
	baseUsdPerKg: number;
	freightUsdPerKg: number;
	feesUsdPerKg: number;
	costBaseUsdPerKg: number;
	dutyUsdPerKg: number;
	vatUsdPerKg: number;
	landedUsdPerKg: number;
	cnyPerKg: number | null;
}

/** Pure formula (VAT base = cost base + duty, the China import convention;
 * loss applies multiplicatively on the fully-taxed figure). */
export function computeLandedCost(
	baseUsdPerKg: number,
	p: LandedCostParams,
	usdCny: number | null,
): LandedCostBreakdown {
	const costBase = baseUsdPerKg + p.freightUsdPerKg + p.feesUsdPerKg;
	const duty = costBase * (p.tariffPct / 100);
	const vat = (costBase + duty) * (p.vatPct / 100);
	const landed = (costBase + duty + vat) * (1 + p.lossPct / 100);
	return {
		baseUsdPerKg,
		freightUsdPerKg: p.freightUsdPerKg,
		feesUsdPerKg: p.feesUsdPerKg,
		costBaseUsdPerKg: costBase,
		dutyUsdPerKg: duty,
		vatUsdPerKg: vat,
		landedUsdPerKg: landed,
		cnyPerKg: usdCny != null ? landed * usdCny : null,
	};
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface LandingCostQuote {
	status: "ok" | "insufficient_data";
	reason?: string;
	params: LandedCostParams & { baseSeries: LandingBaseSlug; originFx: OriginRefSlug | "none" };
	base?: {
		slug: LandingBaseSlug;
		label: string;
		unit: string;
		latestClose: number;
		latestDate: string;
		interval: string;
		source: string;
		stale: boolean;
		daysOld: number;
		usdPerKg: number;
		window: { points: number; description: string; lowClose: number; highClose: number };
	};
	fx?: {
		usdCny: { rate: number; date: string; stale: boolean } | null;
		originRef: { slug: string; label: string; rate: number; date: string } | null;
	};
	landed?: {
		low: LandedCostBreakdown;
		mid: LandedCostBreakdown;
		high: LandedCostBreakdown;
	};
	notes: string[];
	timestamp: string;
}

function daysOld(d: Date): number {
	return (Date.now() - d.getTime()) / 86_400_000;
}

async function latestUsdCny(): Promise<{ rate: number; date: string; stale: boolean } | null> {
	try {
		const { price } = await getLatestPrice("usd_cny");
		if (!price || price.close == null) return null;
		const rate = Number(price.close);
		if (!Number.isFinite(rate) || rate <= 0) return null;
		return {
			rate: r4(rate),
			date: price.date.toISOString(),
			stale: daysOld(price.date) > stalenessWindowDays(price.interval ?? "daily"),
		};
	} catch {
		return null;
	}
}

export async function getLandingCostQuote(input: {
	baseSeries: LandingBaseSlug;
	originFx: OriginRefSlug | "none";
	params: LandedCostParams;
}): Promise<LandingCostQuote> {
	const notes: string[] = [];
	const { commodity, price } = await getLatestPrice(input.baseSeries);

	if (!price || price.close == null) {
		return {
			status: "insufficient_data",
			reason: `基准序列 ${input.baseSeries} 暂无价格数据`,
			params: { ...input.params, baseSeries: input.baseSeries, originFx: input.originFx },
			notes: baseNotes(),
			timestamp: new Date().toISOString(),
		};
	}

	// Normalize the DB interval to the cadence union ('' legacy rows → daily,
	// same convention as mapeTracking's COALESCE normalization).
	const rawInterval = price.interval ?? "";
	const interval: "daily" | "weekly" | "monthly" =
		rawInterval === "monthly" || rawInterval === "weekly" ? rawInterval : "daily";
	const close = Number(price.close);
	const usdPerKg = toUsdPerKg(close, commodity.unit);
	if (usdPerKg == null) {
		return {
			status: "insufficient_data",
			reason: `基准序列量纲未识别（unit=${commodity.unit ?? "null"}），拒绝换算`,
			params: { ...input.params, baseSeries: input.baseSeries, originFx: input.originFx },
			notes: baseNotes(),
			timestamp: new Date().toISOString(),
		};
	}

	const age = daysOld(price.date);
	const stale = age > stalenessWindowDays(interval);
	if (stale) {
		notes.push(
			`基准价已 ${Math.floor(age)} 天未更新（超出 ${interval} 序列新鲜度窗口）——数字仍给出，请注意时效。`,
		);
	}

	// Recent-window band scaled to cadence: daily → last 30 closes, weekly →
	// last 12 (~a quarter), monthly → last 3 (a quarter).
	const limit = interval === "monthly" ? 3 : interval === "weekly" ? 12 : 30;
	const { prices } = await getPriceHistory(input.baseSeries, { interval, limit });
	const closes = prices
		.filter((p) => p.close != null)
		.map((p) => Number(p.close))
		.filter(Number.isFinite);
	const lowClose = closes.length > 0 ? Math.min(...closes) : close;
	const highClose = closes.length > 0 ? Math.max(...closes) : close;
	if (closes.length < 2) {
		notes.push("基准价近窗点数不足，区间退化为最新单点。");
	}
	const windowDescription =
		interval === "monthly"
			? "近 3 个月度点"
			: interval === "weekly"
				? `近 ${Math.max(closes.length, 1)} 个周度点`
				: `近 ${Math.max(closes.length, 1)} 个日度点`;

	const fxRate = await latestUsdCny();
	if (!fxRate) {
		notes.push("USD/CNY 汇率暂不可用——人民币到岸价本轮不显示（不猜汇率）。");
	}

	let originRef: {
		slug: string;
		label: string;
		rate: number;
		date: string;
	} | null = null;
	if (input.originFx !== "none") {
		try {
			const { price: op } = await getLatestPrice(input.originFx);
			if (op && op.close != null && Number.isFinite(Number(op.close))) {
				originRef = {
					slug: input.originFx,
					label: ORIGIN_REF_SERIES[input.originFx],
					rate: r4(Number(op.close)),
					date: op.date.toISOString(),
				};
			}
		} catch {
			originRef = null;
		}
	}

	const lowUsd = toUsdPerKg(lowClose, commodity.unit) ?? usdPerKg;
	const highUsd = toUsdPerKg(highClose, commodity.unit) ?? usdPerKg;

	const round = (b: LandedCostBreakdown): LandedCostBreakdown => ({
		...b,
		baseUsdPerKg: r4(b.baseUsdPerKg),
		freightUsdPerKg: r4(b.freightUsdPerKg),
		feesUsdPerKg: r4(b.feesUsdPerKg),
		costBaseUsdPerKg: r4(b.costBaseUsdPerKg),
		dutyUsdPerKg: r4(b.dutyUsdPerKg),
		vatUsdPerKg: r4(b.vatUsdPerKg),
		landedUsdPerKg: r4(b.landedUsdPerKg),
		cnyPerKg: b.cnyPerKg != null ? r2(b.cnyPerKg) : null,
	});

	const lowB = round(computeLandedCost(lowUsd, input.params, fxRate?.rate ?? null));
	const midB = round(computeLandedCost(usdPerKg, input.params, fxRate?.rate ?? null));
	const highB = round(computeLandedCost(highUsd, input.params, fxRate?.rate ?? null));
	if (fxRate?.stale) notes.push("USD/CNY 汇率已超出新鲜度窗口，注意时效。");

	return {
		status: "ok",
		params: { ...input.params, baseSeries: input.baseSeries, originFx: input.originFx },
		base: {
			slug: input.baseSeries,
			label: LANDING_COST_BASE_SERIES[input.baseSeries].label,
			unit: commodity.unit ?? "",
			latestClose: r2(close),
			latestDate: price.date.toISOString(),
			interval,
			source: price.source,
			stale,
			daysOld: Math.floor(age),
			usdPerKg: r4(usdPerKg),
			window: {
				points: closes.length,
				description: windowDescription,
				lowClose: r2(lowClose),
				highClose: r2(highClose),
			},
		},
		fx: { usdCny: fxRate, originRef },
		landed: { low: lowB, mid: midB, high: highB },
		notes: [...baseNotes(), ...notes],
		timestamp: new Date().toISOString(),
	};
}

function baseNotes(): string[] {
	return [
		"关税 / 增值税 / 运费 / 杂费 / 损耗为你输入的假设参数——平台不内置各国税率（不造虚构数据）。",
		"增值税按（成本基数 + 关税）计算（中国进口环节口径）；损耗在完税后乘算。",
		"参考估算工具，非报关或采购依据；基准价与汇率均标注来源日期。",
	];
}
