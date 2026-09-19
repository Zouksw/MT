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
	extractLeadingPlantNumber,
	ingestSpotItems,
	parseListingTime,
	parseRjsListingPage,
	plantFactoryCode,
	resolveBeefSpotCut,
	SPOT_FACTORY_CODE,
	type SpotListingItem,
} from "../roujiaosuoSpot";

// ---------------------------------------------------------------------------
// Plant-number extraction — leading-position only (round-168, 宁缺勿错).
// ---------------------------------------------------------------------------
describe("extractLeadingPlantNumber", () => {
	test("captures leading 2-5 digit plant prefixes", () => {
		expect(extractLeadingPlantNumber("2543牛腩肋条")).toBe("2543");
		expect(extractLeadingPlantNumber("30和牛碎肉65")).toBe("30"); // trailing 65 is a lean spec
	});

	test("mid-title numbers are honest misses (specs, not plants)", () => {
		expect(extractLeadingPlantNumber("谷饲4302小排肥牛")).toBeNull();
	});

	test("quantity words and alphanumeric specs are excluded", () => {
		expect(extractLeadingPlantNumber("150箱牛腩")).toBeNull();
		expect(extractLeadingPlantNumber("80VL牛碎肉")).toBeNull();
		expect(extractLeadingPlantNumber("5A雪花牛排")).toBeNull(); // single digit + letter
	});

	test("plain titles carry no plant number", () => {
		expect(extractLeadingPlantNumber("全去骨牛蹄")).toBeNull();
		expect(extractLeadingPlantNumber("巴西进口牛腩")).toBeNull();
	});
});

describe("plantFactoryCode", () => {
	test("Brazil keeps the seed SIF convention, others are plain ISO2-n", () => {
		expect(plantFactoryCode("BR", "2543")).toBe("BR-SIF2543");
		expect(plantFactoryCode("NZ", "30")).toBe("NZ-30");
		expect(plantFactoryCode("AU", "235")).toBe("AU-235");
	});
});

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

describe("plant attribution (round-168 integration)", () => {
	const NOW = new Date("2026-09-19T04:00:00Z");

	afterAll(async () => {
		await prisma.beefCutPrice.deleteMany({
			where: { source: "roujiaosuo_spot", sourceRef: { startsWith: "rjs-plant-" } },
		});
		// Test plant factories only — 99xx numbers cannot collide with the
		// seed's real establishments.
		await prisma.factory.deleteMany({
			where: { code: { in: ["BR-SIF9901", "NZ-9903"] } },
		});
	});

	test("leading 厂号 + mapped origin attributes to a real plant factory", async () => {
		const report = await ingestSpotItems(
			[
				{
					listingId: "rjs-plant-1",
					title: "9901牛腩肋条",
					supplyType: "现货",
					originCountry: "巴西",
					priceCnyPerKg: 52,
					volumeKg: 500,
					warehouse: "上海上海市",
					timeText: "2小时前",
				},
			],
			NOW,
		);
		expect(report.inserted).toBe(1);
		expect(report.plantAttributed).toBe(1);

		const plant = await prisma.factory.findUnique({ where: { code: "BR-SIF9901" } });
		expect(plant?.country).toBe("BR");
		expect(plant?.nameLocal).toBe("巴西9901厂");
		expect(plant?.metadata?.kind).toBe("gacc-plant-unverified");

		const row = await prisma.beefCutPrice.findFirst({
			where: { source: "roujiaosuo_spot", sourceRef: "rjs-plant-1" },
			include: { factory: true },
		});
		expect(row?.factory.code).toBe("BR-SIF9901");
		expect(row?.metadata?.plantNumber).toBe("9901");
		expect(row?.metadata?.plantFactoryCode).toBe("BR-SIF9901");
		expect(row?.currency).toBe("CNY");
	});

	test("CN origin and unmapped origins stay on the virtual factory (number kept in metadata)", async () => {
		const report = await ingestSpotItems(
			[
				{
					listingId: "rjs-plant-2",
					title: "99和牛碎肉70", // leading 99, but CN domestic
					supplyType: "现货",
					originCountry: "中国",
					priceCnyPerKg: 50,
					volumeKg: null,
					warehouse: "北京北京市",
					timeText: "1小时前",
				},
				{
					listingId: "rjs-plant-3",
					title: "9902牛霖", // leading number, origin not in the map
					supplyType: "现货",
					originCountry: "火星",
					priceCnyPerKg: 59,
					volumeKg: null,
					warehouse: "上海上海市",
					timeText: "1小时前",
				},
			],
			NOW,
		);
		expect(report.inserted).toBe(2);
		expect(report.plantAttributed).toBe(0);

		for (const ref of ["rjs-plant-2", "rjs-plant-3"]) {
			const row = await prisma.beefCutPrice.findFirst({
				where: { source: "roujiaosuo_spot", sourceRef: ref },
				include: { factory: true },
			});
			expect(row?.factory.code).toBe(SPOT_FACTORY_CODE);
			expect(row?.metadata?.plantFactoryCode).toBeUndefined();
		}
		// The detected number is preserved for the vocabulary batch either way.
		const cn = await prisma.beefCutPrice.findFirst({ where: { sourceRef: "rjs-plant-2" } });
		expect(cn?.metadata?.plantNumber).toBe("99");
	});

	test("a code collision with a factory of another country skips attribution", async () => {
		// Pre-create NZ-9903 with the WRONG country — the resolver must detect
		// the mismatch and keep the row virtual instead of adopting/overwriting.
		await prisma.factory.create({
			data: {
				code: "NZ-9903",
				name: "collision guard fixture",
				country: "AU",
				metadata: { testFixture: true },
			},
		});
		const report = await ingestSpotItems(
			[
				{
					listingId: "rjs-plant-4",
					title: "9903牛腩", // different cut — KNUCKLE's 09-19 virtual slot is taken above
					supplyType: "现货",
					originCountry: "新西兰",
					priceCnyPerKg: 60,
					volumeKg: null,
					warehouse: "上海上海市",
					timeText: "1小时前",
				},
			],
			NOW,
		);
		expect(report.inserted).toBe(1);
		expect(report.plantAttributed).toBe(0);

		const row = await prisma.beefCutPrice.findFirst({
			where: { source: "roujiaosuo_spot", sourceRef: "rjs-plant-4" },
			include: { factory: true },
		});
		expect(row?.factory.code).toBe(SPOT_FACTORY_CODE);
		// The fixture factory was NOT overwritten.
		const fixture = await prisma.factory.findUnique({ where: { code: "NZ-9903" } });
		expect(fixture?.name).toBe("collision guard fixture");
		expect(fixture?.country).toBe("AU");
	});
});
