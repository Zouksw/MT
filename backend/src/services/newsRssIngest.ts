/**
 * RSS news ingestion — the external feed side of the M3 资讯 module
 * (PRODUCT-SPEC §八: "资讯模块 RSS 源接入，model/route/service/页已建，
 * 缺外部数据抓取源").
 *
 * Pulls registered RSS 2.0 feeds into market_news on the scheduler
 * (server.ts "news-rss-ingest", every 6h). Design constraints:
 *
 * - Reuses scraperFetch (dataIngestion/http.ts) so timeouts/retries/proxy
 *   policy live in the one shared client, like every other external fetch.
 * - Dedupe by sourceUrl: a feed item already ingested is skipped, so re-runs
 *   and overlapping schedules are free of side effects.
 * - Items are stored honestly: title/summary carry the feed's own text with
 *   HTML stripped, and the article link is preserved in sourceUrl for the
 *   detail page to link out. We do NOT fabricate a body the feed didn't send.
 * - Rows are attributed to the first ADMIN user (a feed has no human author;
 *   the `source` column carries the real provenance, e.g. "Beef Central").
 * - Failures isolate per feed and per item: a dead host or a malformed item
 *   logs a warning and the run continues — never throws (scheduler also
 *   catches, but per-feed isolation keeps the other feeds on schedule).
 */

import { createHash } from "node:crypto";
import type { NewsCategory } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import { logger, prisma } from "@/lib";
import { scraperFetch } from "@/services/dataIngestion/http";
import { slugifyTitle } from "@/services/marketNewsService";

interface RssFeedConfig {
	/** Stable key for logs and the tags column. */
	key: string;
	url: string;
	/** Display name stored in MarketNews.source (schema caps at 100 chars). */
	source: string;
	category: NewsCategory;
	/** Per-run cap so a prolific feed can't flood the table. Default 10. */
	maxItems?: number;
}

// Feed registry. Candidates were live-probed 2026-08-22 (HTTP 200 + fresh
// content): Beef Central is a WordPress RSS 2.0 feed updated hourly; the
// Federal Register USDA feed carries official US trade-policy documents.
// globalagmedia.com/rss was probed and rejected (empty channel metadata,
// last build 2026-04 — stale).
const RSS_FEEDS: RssFeedConfig[] = [
	{
		key: "beefcentral",
		url: "https://www.beefcentral.com/feed/",
		source: "Beef Central",
		category: "MARKET_INSIGHT",
	},
	{
		key: "usda-federal-register",
		url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=usda&order=newest",
		source: "USDA — Federal Register",
		category: "TRADE_POLICY",
		maxItems: 5,
	},
];

interface ParsedRssItem {
	title: string;
	link: string;
	publishedAt: Date;
	description: string;
	content: string;
}

export interface RssIngestFeedResult {
	key: string;
	fetched: number;
	inserted: number;
	skipped: number;
}

/** Pull every registered feed. Never throws — per-feed isolation. */
export async function ingestNewsFromRss(): Promise<RssIngestFeedResult[]> {
	// Feed items have no human author; attribute to the system admin so the
	// authorId FK stays honest instead of inventing a ghost account.
	const systemAuthor = await prisma.user.findFirst({
		where: { role: "ADMIN" },
		select: { id: true },
		orderBy: { createdAt: "asc" },
	});
	if (!systemAuthor) {
		logger.warn("[rss] no ADMIN user found to attribute feed items — run skipped");
		return [];
	}

	const results: RssIngestFeedResult[] = [];
	for (const feed of RSS_FEEDS) {
		results.push(await ingestFeed(feed, systemAuthor.id));
	}
	return results;
}

async function ingestFeed(feed: RssFeedConfig, authorId: string): Promise<RssIngestFeedResult> {
	const result: RssIngestFeedResult = { key: feed.key, fetched: 0, inserted: 0, skipped: 0 };

	let xml: string;
	try {
		const res = await scraperFetch(feed.url, { timeoutMs: 20_000, retries: 1 });
		if (!res.ok) {
			logger.warn(`[rss] ${feed.key} returned HTTP ${res.status} — feed skipped`);
			return result;
		}
		xml = await res.text();
	} catch (err) {
		logger.warn(`[rss] ${feed.key} fetch failed: ${err instanceof Error ? err.message : err}`);
		return result;
	}

	const items = parseRssItems(xml).slice(0, feed.maxItems ?? 10);
	result.fetched = items.length;

	for (const item of items) {
		// A row without a link can't be traced to its origin — skip rather
		// than store an unattributable headline.
		if (!item.title || !item.link) {
			result.skipped++;
			continue;
		}
		const existing = await prisma.marketNews.findFirst({
			where: { sourceUrl: item.link },
			select: { id: true },
		});
		if (existing) {
			result.skipped++;
			continue;
		}
		try {
			await prisma.marketNews.create({
				data: {
					title: truncate(item.title, 200),
					slug: slugifyTitle(item.title),
					summary: truncate(stripHtml(item.description), 500),
					body: stripHtml(item.content || item.description),
					category: feed.category,
					source: feed.source,
					sourceUrl: item.link,
					tags: ["rss", feed.key],
					status: "published",
					publishedAt: item.publishedAt,
					authorId,
				},
			});
			result.inserted++;
		} catch (err) {
			// round-119: dedupe key is sourceUrl but the UNIQUE constraint is
			// on slug. A second, DIFFERENT article whose title slugifies the
			// same (weekly roundup titles) used to be dropped here on every
			// 6h cycle — permanently, because the sourceUrl row never landed
			// so the dedupe check could never match. Retry once with a stable
			// sourceUrl hash suffix (deterministic → idempotent across runs).
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
				const suffixed = `${slugifyTitle(item.title)}-${createHash("sha1")
					.update(item.link)
					.digest("hex")
					.slice(0, 8)}`;
				try {
					await prisma.marketNews.create({
						data: {
							title: truncate(item.title, 200),
							slug: suffixed,
							summary: truncate(stripHtml(item.description), 500),
							body: stripHtml(item.content || item.description),
							category: feed.category,
							source: feed.source,
							sourceUrl: item.link,
							tags: ["rss", feed.key],
							status: "published",
							publishedAt: item.publishedAt,
							authorId,
						},
					});
					result.inserted++;
					continue;
				} catch (err2) {
					logger.warn(
						`[rss] ${feed.key} item skipped even with disambiguated slug: ${
							err2 instanceof Error ? err2.message : err2
						}`,
					);
					result.skipped++;
					continue;
				}
			}
			result.skipped++;
			logger.warn(
				`[rss] ${feed.key} item skipped on create: ${err instanceof Error ? err.message : err}`,
			);
		}
	}
	return result;
}

/**
 * Parse an RSS 2.0 document into items. Both registered feeds are RSS 2.0
 * (verified); anything else parses to [] and the feed reports fetched=0.
 */
function parseRssItems(xml: string): ParsedRssItem[] {
	let doc: unknown;
	try {
		doc = new XMLParser({ parseTagValue: false }).parse(xml);
	} catch {
		return [];
	}

	const channel = (doc as { rss?: { channel?: { item?: unknown } } })?.rss?.channel;
	if (!channel) return [];
	const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

	return (rawItems as Record<string, unknown>[]).map((raw) => ({
		title: asText(raw.title),
		link: asText(raw.link),
		publishedAt: parseDate(asText(raw.pubDate)),
		description: asText(raw.description),
		content: asText(raw["content:encoded"]),
	}));
}

/** XML text nodes can arrive as string | number | object — normalize. */
function asText(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number") return String(value);
	return "";
}

function parseDate(value: string): Date {
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Strip tags + collapse whitespace so feed HTML never reaches the UI raw. */
function stripHtml(text: string): string {
	return text
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
