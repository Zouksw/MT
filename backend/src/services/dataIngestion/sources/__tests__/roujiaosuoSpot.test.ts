/**
 * roujiaosuoSpot (round-165) — contract pins for the domestic spot LISTING
 * channel. The honesty gates are the point: canonical-term mapping only
 * (never guessed), processed products excluded, CNY/kg plausibility band,
 * first-of-day-wins idempotency, and currency isolation (CNY rows under the
 * virtual RJS-SPOT factory, never touching USD plant series).
 */
import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib";
import {
	BEEF_SPOT_TERMS,
	ingestSpotItems,
	parseListingTime,
	parseRjsListingPage,
	resolveBeefSpotCut,
	SPOT_FACTORY_CODE,
	type SpotListingItem,
} from "../roujiaosuoSpot";

// ---------------------------------------------------------------------------
// Vocabulary resolution — the 宁缺勿错 gate.
// ---------------------------------------------------------------------------
describe("resolveBeefSpotCut", () => {
	test("canonical terms map through the taxonomy (longest term wins)", () => {
		expect(resolveBeefSpotCut("牛霖411厂")).toEqual({ cutCode: "KNUCKLE", term: "牛霖" });
		expect(resolveBeefSpotCut("巴西进口牛腩")).toEqual({ cutCode: "BRISKET_NAVEL", term: "牛腩" });
		expect(resolveBeefSpotCut("澳洲西冷牛排")).toEqual({ cutCode: "STRIPLOIN", term: "西冷" });
		expect(resolveBeefSpotCut("白水牛舌")).toEqual({ cutCode: "TONGUE", term: "牛舌" });
	});

	test("species-ambiguous terms require the 牛 marker", () => {
		// 后腿/前腿 alone could be pork — no 牛 marker, no mapping.
		expect(resolveBeefSpotCut("后腿肉")).toBeNull();
		expect(resolveBeefSpotCut("乌克兰后腿肉")).toBeNull();
		// With the marker, the alias resolves.
		expect(resolveBeefSpotCut("牛后腿")).toEqual({ cutCode: "HINDSHANK", term: "后腿" });
	});

	test("non-beef species never map", () => {
		expect(resolveBeefSpotCut("预煮花肠猪杂")).toBeNull();
		expect(resolveBeefSpotCut("羔羊羊酮体")).toBeNull();
		expect(resolveBeefSpotCut("三黄鸡整箱")).toBeNull();
	});

	test("processed products are excluded even with a cut word", () => {
		expect(resolveBeefSpotCut("黑椒牛仔骨")).toBeNull();
		expect(resolveBeefSpotCut("腌制牛腩条")).toBeNull();
		expect(resolveBeefSpotCut("调理牛排片")).toBeNull();
	});

	test("beef titles with no canonical term stay unmapped (never guessed)", () => {
		expect(resolveBeefSpotCut("牛脂肪")).toBeNull();
		expect(resolveBeefSpotCut("高端牛杂")).toBeNull();
		expect(resolveBeefSpotCut("牛副产品一批")).toBeNull();
	});

	test("the term table is canonical-only, Chinese, longest-first", () => {
		expect(BEEF_SPOT_TERMS.length).toBeGreaterThan(50);
		for (const { term } of BEEF_SPOT_TERMS) {
			expect(term).toMatch(/[\u4e00-\u9fff]/);
		}
		const lengths = BEEF_SPOT_TERMS.map((t) => t.term.length);
		for (let i = 1; i < lengths.length; i++) {
			expect(lengths[i - 1]).toBeGreaterThanOrEqual(lengths[i]);
		}
	});
});

// ---------------------------------------------------------------------------
// Listing-page parsing — real column contract from the live feed.
// ---------------------------------------------------------------------------
const FIXTURE = `
<ul class="meat-list-title fl"><li><em>|</em>产品名称</li><li>价格</li></ul>
<ul class="meat-list-item fl">
<li><a href="https://www.roujiaosuo.com/sell/show/1930363/" title="牛脂肪">牛脂肪</a></li>
<li>现货</li>
<li>阿根廷</li>
<li>12.80 元/公斤</li>
<li>0公斤</li>
<li>江苏苏州市</li>
<li>20分钟前</li>
<li><a href="https://www.roujiaosuo.com/sell/show/1930363/">查看详情</a></li>
</ul>
<ul class="meat-list-item fl">
<li><a href="https://www.roujiaosuo.com/sell/show/1931001/" title="巴西牛霖">巴西牛霖</a></li>
<li>现货</li>
<li>巴西</li>
<li>33.9 元/公斤</li>
<li>1000公斤</li>
<li>山东青岛市</li>
<li>1小时前</li>
<li>查看详情</li>
</ul>
<ul class="meat-list-item fl">
<li><a href="https://www.roujiaosuo.com/sell/show/1931002/" title="牛腩面议">牛腩面议</a></li>
<li>期货</li>
<li>乌拉圭</li>
<li>电询</li>
<li>500公斤</li>
<li>上海上海市</li>
<li>3天前</li>
<li>查看详情</li>
</ul>
`;

describe("parseRjsListingPage", () => {
	test("extracts the 7-column contract per listing", () => {
		const items = parseRjsListingPage(FIXTURE);
		expect(items).toHaveLength(3);
		expect(items[0]).toMatchObject({
			listingId: "1930363",
			title: "牛脂肪",
			supplyType: "现货",
			originCountry: "阿根廷",
			priceCnyPerKg: 12.8,
			volumeKg: null, // 0公斤 → unspecified
			warehouse: "江苏苏州市",
			timeText: "20分钟前",
		});
		expect(items[1]).toMatchObject({
			listingId: "1931001",
			title: "巴西牛霖",
			originCountry: "巴西",
			priceCnyPerKg: 33.9,
			volumeKg: 1000,
		});
		// 电询 (price on inquiry) → no price, no row downstream.
		expect(items[2].priceCnyPerKg).toBeNull();
		expect(items[2].volumeKg).toBe(500);
	});

	test("a reformed page (no item blocks) parses to [] — never a guess", () => {
		expect(parseRjsListingPage("<html><body>renovated</body></html>")).toEqual([]);
	});
});

describe("parseListingTime", () => {
	const now = new Date("2026-09-19T12:00:00Z");
	test("relative offsets", () => {
		expect(parseListingTime("20分钟前", now)?.toISOString()).toBe("2026-09-19T11:40:00.000Z");
		expect(parseListingTime("3小时前", now)?.toISOString()).toBe("2026-09-19T09:00:00.000Z");
		expect(parseListingTime("2天前", now)?.toISOString()).toBe("2026-09-17T12:00:00.000Z");
	});
	test("absolute dates", () => {
		expect(parseListingTime("2026-09-18", now)?.toISOString()).toBe("2026-09-18T00:00:00.000Z");
		expect(parseListingTime("09-18", now)?.toISOString()).toBe("2026-09-18T00:00:00.000Z");
	});
	test("unparseable → null (caller falls back to fetch time)", () => {
		expect(parseListingTime("刚刚", now)).toBeNull();
		expect(parseListingTime("", now)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Ingest — idempotency + honesty gates against the test DB.
// ---------------------------------------------------------------------------
describe("ingestSpotItems (integration)", () => {
	const NOW = new Date("2026-09-19T04:00:00Z");
	const items: SpotListingItem[] = [
		{
			listingId: "rjs-test-1",
			title: "巴西牛霖",
			supplyType: "现货",
			originCountry: "巴西",
			priceCnyPerKg: 33.9,
			volumeKg: 1000,
			warehouse: "山东青岛市",
			timeText: "1小时前",
		},
		{
			listingId: "rjs-test-2",
			title: "雪花肥牛砖", // maps to BRISKET_NAVEL but 16000 CNY/kg — band reject
			supplyType: "现货",
			originCountry: "中国",
			priceCnyPerKg: 16000,
			volumeKg: null,
			warehouse: "山东济南市",
			timeText: "1小时前",
		},
		{
			listingId: "rjs-test-3",
			title: "高端牛杂", // beef marker, no canonical term — unmapped
			supplyType: "现货",
			originCountry: "中国",
			priceCnyPerKg: 27,
			volumeKg: null,
			warehouse: "山东济南市",
			timeText: "1小时前",
		},
		{
			listingId: "rjs-test-4",
			title: "牛腩面议", // maps, but no price — no row
			supplyType: "期货",
			originCountry: "乌拉圭",
			priceCnyPerKg: null,
			volumeKg: null,
			warehouse: "上海上海市",
			timeText: "3天前",
		},
	];

	afterAll(async () => {
		await prisma.beefCutPrice.deleteMany({
			where: { source: "roujiaosuo_spot", sourceRef: { startsWith: "rjs-test-" } },
		});
		await prisma.factory.deleteMany({ where: { code: SPOT_FACTORY_CODE } });
	});

	test("first run inserts the mapped row with full provenance + honesty gates", async () => {
		const report = await ingestSpotItems(items, NOW);
		expect(report.inserted).toBe(1); // only 巴西牛霖
		expect(report.rejectedPrice).toBe(1); // 16000 out of band
		expect(report.unmappedTitles).toEqual(["高端牛杂"]);
		// 面议 (no price) and non-beef neither insert nor report as unmapped.

		const row = await prisma.beefCutPrice.findFirst({
			where: { source: "roujiaosuo_spot", sourceRef: "rjs-test-1" },
		});
		expect(row).not.toBeNull();
		expect(row?.cutCode).toBe("KNUCKLE");
		expect(row?.currency).toBe("CNY");
		expect(row?.unit).toBe("CNY/kg");
		expect(Number(row?.price)).toBe(33.9);
		expect(row?.date.toISOString()).toBe("2026-09-19T00:00:00.000Z");
		expect(row?.volume).toBe(1000);
		const meta = row?.metadata as Record<string, unknown>;
		expect(meta.priceType).toBe("listing");
		expect(meta.matchedTerm).toBe("牛霖");
		expect(meta.originCountry).toBe("巴西");
		expect(meta.sourceUrl).toContain("sell/show/rjs-test-1");

		const factory = await prisma.factory.findUnique({ where: { code: SPOT_FACTORY_CODE } });
		expect(factory?.country).toBe("CN");
		expect((factory?.metadata as Record<string, unknown>)?.virtual).toBe(true);
	});

	test("re-run is a no-op (day-keyed idempotency, first-of-day wins)", async () => {
		const report = await ingestSpotItems(items, NOW);
		expect(report.inserted).toBe(0);
		expect(report.duplicates).toBe(1);
		// A competing seller's listing the same day does not overwrite.
		const rival = await ingestSpotItems(
			[
				{
					...items[0],
					listingId: "rjs-test-rival",
					priceCnyPerKg: 35.5,
				},
			],
			NOW,
		);
		expect(rival.inserted).toBe(0);
		const row = await prisma.beefCutPrice.findFirst({
			where: { source: "roujiaosuo_spot", sourceRef: "rjs-test-1" },
		});
		expect(Number(row?.price)).toBe(33.9);
		await prisma.beefCutPrice.deleteMany({
			where: { source: "roujiaosuo_spot", sourceRef: "rjs-test-rival" },
		});
	});

	test("CNY rows never touch USD plant series (factory isolation)", async () => {
		const row = await prisma.beefCutPrice.findFirst({
			where: { source: "roujiaosuo_spot", sourceRef: "rjs-test-1" },
			include: { factory: true },
		});
		expect(row?.factory.code).toBe(SPOT_FACTORY_CODE);
		// No mla_nlrs/usda row shares this factory.
		const usdCount = await prisma.beefCutPrice.count({
			where: { factoryId: row?.factoryId, currency: "USD" },
		});
		expect(usdCount).toBe(0);
	});
});
