import { describe, expect, it } from "vitest";
import {
	buildDigestText,
	type IngestionErrorSummary,
	shouldSendDigest,
} from "@/services/dataDigest";
import type { DataHealthSnapshot } from "@/services/dataHealth";

const snapshot = (over: Partial<DataHealthSnapshot> = {}): DataHealthSnapshot => ({
	asOf: new Date("2026-08-21T04:00:00Z"),
	windowDays: 1,
	sources: [
		{
			source: "fred",
			commodityPriceRows: 42,
			beefCutPriceRows: 0,
			latestDate: new Date("2026-08-20"),
			scraperStatus: "healthy",
		},
		{
			source: "usda_ams",
			commodityPriceRows: 0,
			beefCutPriceRows: 0,
			latestDate: null,
			scraperStatus: "empty",
		},
	],
	freshSourceCount: 1,
	registeredSourceCount: 18,
	anyDataFlowing: true,
	predictionBacklog: 100,
	predictionVerified: 200,
	predictionStale: 50,
	predictionUnverifiable: 86000,
	verificationRatio: 200 / 300,
	hasVerificationDebt: false,
	...over,
});

describe("shouldSendDigest (round-115)", () => {
	it("sends when no source wrote anything in 24h (data layer dead, infra may be green)", () => {
		const d = shouldSendDigest(snapshot({ anyDataFlowing: false, freshSourceCount: 0 }), 0);
		expect(d.send).toBe(true);
		expect(d.reason).toContain("no source wrote");
	});

	it("sends when ingestion errors occurred in 24h", () => {
		const d = shouldSendDigest(snapshot(), 3);
		expect(d.send).toBe(true);
		expect(d.reason).toContain("3 ingestion error");
	});

	it("skips a healthy state (steady dormancy alone must not spam daily)", () => {
		const d = shouldSendDigest(snapshot(), 0);
		expect(d.send).toBe(false);
		expect(d.reason).toContain("1/18 sources fresh");
	});
});

describe("buildDigestText (round-115)", () => {
	it("includes trigger, fresh-source list, verification stats and error detail", () => {
		const errors: IngestionErrorSummary[] = [
			{ source: "fred", runs: 19, lastMessage: "connect ETIMEDOUT" },
		];
		const decision = shouldSendDigest(snapshot(), 19);
		const text = buildDigestText(snapshot(), errors, decision);
		expect(text).toContain("Trigger: 19 ingestion error run(s)");
		expect(text).toContain("fred");
		expect(text).toContain("connect ETIMEDOUT");
		expect(text).toContain("1/18");
		expect(text).toContain("200 verified / 100 backlog");
		expect(text).toContain("/api/market/sources/freshness");
	});
});
