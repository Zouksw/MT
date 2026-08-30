/**
 * Public trade tools (v3.2.0 批 3 — landing-cost calculator).
 *
 * GET /api/tools/landing-cost — beef import landed-cost reference.
 * Public by design (获客工具, same discipline as /api/market/public/highlights):
 * reads only whitelisted macro price series, never user datasets, and sits
 * under the global /api rate limiter (app.ts). No cacheRoute — the query is
 * user-parameterized and the underlying lookups are two indexed reads.
 */

import { Router } from "express";
import { z } from "zod";
import { success } from "@/lib/response";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import {
	getLandingCostQuote,
	LANDING_COST_BASE_SERIES,
	type LandingBaseSlug,
	ORIGIN_REF_SERIES,
	type OriginRefSlug,
} from "@/services/landingCost";

export const toolsRouter = Router();

const baseSeriesEnum = z.enum(
	Object.keys(LANDING_COST_BASE_SERIES) as [LandingBaseSlug, ...LandingBaseSlug[]],
);
const originFxEnum = z.enum(["none", ...(Object.keys(ORIGIN_REF_SERIES) as OriginRefSlug[])] as [
	"none",
	...OriginRefSlug[],
]);

const landingCostQuerySchema = z.object({
	baseSeries: baseSeriesEnum.default("beef_carcass_us"),
	originFx: originFxEnum.default("none"),
	tariffPct: z.coerce.number().min(0).max(100).default(0),
	vatPct: z.coerce.number().min(0).max(100).default(0),
	freightUsdPerKg: z.coerce.number().min(0).max(1000).default(0),
	feesUsdPerKg: z.coerce.number().min(0).max(1000).default(0),
	lossPct: z.coerce.number().min(0).max(100).default(0),
});

toolsRouter.get(
	"/landing-cost",
	asyncHandler(async (req, res) => {
		const parsed = landingCostQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			throw new BadRequestError(
				parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
			);
		}
		const q = parsed.data;
		const quote = await getLandingCostQuote({
			baseSeries: q.baseSeries,
			originFx: q.originFx,
			params: {
				tariffPct: q.tariffPct,
				vatPct: q.vatPct,
				freightUsdPerKg: q.freightUsdPerKg,
				feesUsdPerKg: q.feesUsdPerKg,
				lossPct: q.lossPct,
			},
		});
		success(res, quote);
	}),
);
