/**
 * Global search — the topbar search box (PRODUCT-SPEC §四 顶栏: 搜索).
 *
 * One endpoint, three whitelisted sources only (部位 / 商品 / 资讯), each
 * capped so a noisy source can't flood the dropdown. Contains-match,
 * case-insensitive via PostgreSQL `mode: "insensitive"`; CJK matches are
 * inherently caseless. Empty or oversized q returns empty sets (200, not
 * 4xx) so the debounced UI never trips over its own requests.
 *
 * Auth required: this is an in-app navigation surface, and the news titles /
 * commodity catalog shouldn't be enumerable by anonymous crawlers.
 */

import { Router } from "express";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { authenticate } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/errorHandler";

const router = Router();

const PER_SOURCE_LIMIT = 5;
const MAX_QUERY_LENGTH = 100;

router.get(
	"/",
	authenticate,
	asyncHandler(async (req, res) => {
		const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
		const empty = {
			query: raw,
			cuts: [] as unknown[],
			commodities: [] as unknown[],
			news: [] as unknown[],
		};
		if (raw.length === 0 || raw.length > MAX_QUERY_LENGTH) {
			success(res, empty);
			return;
		}
		const needle = raw.toLowerCase();

		const [cuts, commodities, news] = await Promise.all([
			prisma.beefCutTaxonomy.findMany({
				where: {
					OR: [
						{ cutCode: { contains: needle, mode: "insensitive" } },
						{ nameEn: { contains: needle, mode: "insensitive" } },
						{ nameZh: { contains: needle } },
						{ nameEs: { contains: needle, mode: "insensitive" } },
						{ namePt: { contains: needle, mode: "insensitive" } },
					],
				},
				select: { cutCode: true, nameEn: true, nameZh: true, primal: true },
				orderBy: { cutCode: "asc" },
				take: PER_SOURCE_LIMIT,
			}),
			prisma.commodity.findMany({
				where: {
					OR: [
						{ slug: { contains: needle, mode: "insensitive" } },
						{ name: { contains: needle, mode: "insensitive" } },
						{ nameCn: { contains: needle } },
					],
				},
				select: { slug: true, name: true, nameCn: true, category: true },
				orderBy: { slug: "asc" },
				take: PER_SOURCE_LIMIT,
			}),
			prisma.marketNews.findMany({
				where: {
					status: "published",
					OR: [
						{ title: { contains: needle, mode: "insensitive" } },
						{ summary: { contains: needle, mode: "insensitive" } },
					],
				},
				select: { id: true, title: true, source: true, publishedAt: true },
				orderBy: { publishedAt: "desc" },
				take: PER_SOURCE_LIMIT,
			}),
		]);

		success(res, {
			query: raw,
			cuts,
			commodities,
			news: news.map((n) => ({
				id: n.id,
				title: n.title,
				source: n.source,
				publishedAt: n.publishedAt,
			})),
		});
	}),
);

export default router;
