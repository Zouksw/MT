/**
 * newsRssIngest — unit tests for the M3 RSS → market_news pipeline.
 *
 * scraperFetch and prisma are mocked; slugifyTitle is the REAL one (imported
 * through newsRssIngest → marketNewsService) so slug derivation is exercised,
 * not re-implemented in the test.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	userFindFirst: vi.fn(),
	newsFindFirst: vi.fn(),
	newsCreate: vi.fn(),
	scraperFetch: vi.fn(),
}));

vi.mock("@/lib", () => ({
	prisma: {
		user: { findFirst: mocks.userFindFirst },
		marketNews: { findFirst: mocks.newsFindFirst, create: mocks.newsCreate },
	},
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/services/dataIngestion/http", () => ({
	scraperFetch: mocks.scraperFetch,
}));

import { ingestNewsFromRss } from "@/services/newsRssIngest";

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Beef Central</title>
  <item>
    <title>Cattle prices rise on strong export demand</title>
    <link>https://example.com/news/1</link>
    <pubDate>Fri, 21 Aug 2026 06:00:00 GMT</pubDate>
    <description><![CDATA[<p>Export demand lifted <b>cattle</b> prices&nbsp;this week.</p>]]></description>
    <content:encoded><![CDATA[<p>Full story body with more words.</p>]]></content:encoded>
  </item>
  <item>
    <title>Second headline</title>
    <link>https://example.com/news/2</link>
    <pubDate>not-a-date</pubDate>
    <description>Plain description</description>
  </item>
  <item>
    <title>No link item</title>
    <pubDate>Fri, 21 Aug 2026 07:00:00 GMT</pubDate>
    <description>Should be skipped</description>
  </item>
</channel>
</rss>`;

function okResponse(xml: string) {
	return { ok: true, status: 200, text: async () => xml };
}

/** Route scraperFetch by URL so each feed gets its own fixture/failure. */
function stubFeeds(overrides: Record<string, unknown> = {}) {
	mocks.scraperFetch.mockImplementation(async (url: string) => {
		if (url in overrides) return overrides[url];
		if (url.includes("beefcentral")) return okResponse(FEED_XML);
		throw new Error("connection refused");
	});
}

describe("ingestNewsFromRss", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.userFindFirst.mockResolvedValue({ id: "admin-1" });
		mocks.newsFindFirst.mockResolvedValue(null);
		mocks.newsCreate.mockResolvedValue({});
		stubFeeds();
	});

	it("ingests items with stripped HTML, mapped category, and admin attribution", async () => {
		const results = await ingestNewsFromRss();

		// beefcentral: 3 items, 1 has no link → fetched 3, inserted 2.
		// usda-federal-register: fetch throws → all zeros, run continues.
		expect(results).toEqual([
			{ key: "beefcentral", fetched: 3, inserted: 2, skipped: 1 },
			{ key: "usda-federal-register", fetched: 0, inserted: 0, skipped: 0 },
		]);

		const first = mocks.newsCreate.mock.calls[0][0].data;
		expect(first.title).toBe("Cattle prices rise on strong export demand");
		expect(first.summary).toBe("Export demand lifted cattle prices this week.");
		expect(first.body).toBe("Full story body with more words.");
		expect(first.source).toBe("Beef Central");
		expect(first.sourceUrl).toBe("https://example.com/news/1");
		expect(first.category).toBe("MARKET_INSIGHT");
		expect(first.status).toBe("published");
		expect(first.tags).toEqual(["rss", "beefcentral"]);
		expect(first.authorId).toBe("admin-1");
		expect(first.slug).toBe("cattle-prices-rise-on-strong-export-demand");
		expect(first.publishedAt).toEqual(new Date("2026-08-21T06:00:00.000Z"));
	});

	it("falls back to now() for an unparseable pubDate", async () => {
		const before = Date.now();
		await ingestNewsFromRss();

		const second = mocks.newsCreate.mock.calls[1][0].data;
		expect(second.publishedAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(second.publishedAt.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("skips items whose sourceUrl already exists", async () => {
		mocks.newsFindFirst.mockImplementation(async ({ where }: { where: { sourceUrl: string } }) =>
			where.sourceUrl === "https://example.com/news/1" ? { id: "existing" } : null,
		);

		const results = await ingestNewsFromRss();

		expect(results[0]).toEqual({ key: "beefcentral", fetched: 3, inserted: 1, skipped: 2 });
		expect(mocks.newsCreate).toHaveBeenCalledTimes(1);
	});

	it("counts a slug-collision create failure as a skip, not a crash", async () => {
		mocks.newsCreate.mockRejectedValue(new Error("Unique constraint failed on slug"));

		const results = await ingestNewsFromRss();

		expect(results[0]).toEqual({ key: "beefcentral", fetched: 3, inserted: 0, skipped: 3 });
	});

	it("returns [] without touching market_news when no ADMIN user exists", async () => {
		mocks.userFindFirst.mockResolvedValue(null);

		const results = await ingestNewsFromRss();

		expect(results).toEqual([]);
		expect(mocks.newsCreate).not.toHaveBeenCalled();
	});

	it("reports zeros for a feed whose XML has no RSS channel", async () => {
		stubFeeds({ "https://www.beefcentral.com/feed/": okResponse("<html>not a feed</html>") });

		const results = await ingestNewsFromRss();

		expect(results[0]).toEqual({ key: "beefcentral", fetched: 0, inserted: 0, skipped: 0 });
	});

	it("reports zeros for a non-2xx feed response", async () => {
		stubFeeds({ "https://www.beefcentral.com/feed/": { ok: false, status: 503 } });

		const results = await ingestNewsFromRss();

		expect(results[0]).toEqual({ key: "beefcentral", fetched: 0, inserted: 0, skipped: 0 });
	});

	it("caps items per feed at maxItems (flood guard)", async () => {
		const items = Array.from(
			{ length: 8 },
			(_, i) => `<item>
        <title>Headline ${i}</title>
        <link>https://example.com/fr/${i}</link>
        <pubDate>Fri, 21 Aug 2026 06:00:00 GMT</pubDate>
        <description>d</description>
      </item>`,
		).join("");
		const frUrl =
			"https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=usda&order=newest";
		stubFeeds({ [frUrl]: okResponse(`<rss version="2.0"><channel>${items}</channel></rss>`) });

		const results = await ingestNewsFromRss();

		// federalregister is registered with maxItems: 5 — the 8-item fixture
		// must be truncated, not ingested whole.
		expect(results[1]).toEqual({
			key: "usda-federal-register",
			fetched: 5,
			inserted: 5,
			skipped: 0,
		});
		const frCreates = mocks.newsCreate.mock.calls.filter(
			(c) => c[0].data.source === "USDA — Federal Register",
		);
		expect(frCreates).toHaveLength(5);
		expect(frCreates.every((c) => c[0].data.category === "TRADE_POLICY")).toBe(true);
	});
});
