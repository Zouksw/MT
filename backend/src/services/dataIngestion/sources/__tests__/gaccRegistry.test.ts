import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib";
import {
	parseRegistryPage,
	persistRegistryEntries,
	promoteVerifiedFactories,
	type RegistryEntry,
	registryFactoryCode,
} from "../gaccRegistry";

// ---------------------------------------------------------------------------
// approvalNo → factoryCode normalization — format-observed, never invented.
// ---------------------------------------------------------------------------
describe("registryFactoryCode", () => {
	test("Brazil keeps the SIF prefix (bare/spaced digits = the same federal plant id)", () => {
		expect(registryFactoryCode("BR", "SIF1")).toBe("BR-SIF1");
		expect(registryFactoryCode("BR", "SIF2543")).toBe("BR-SIF2543");
		expect(registryFactoryCode("BR", "2543")).toBe("BR-SIF2543");
		expect(registryFactoryCode("BR", "sif18")).toBe("BR-SIF18");
		expect(registryFactoryCode("BR", "SIF 1184")).toBe("BR-SIF1184"); // observed spaced form
	});

	test("New Zealand strips the ME prefix to the title-attribution shape", () => {
		expect(registryFactoryCode("NZ", "ME9")).toBe("NZ-9");
		expect(registryFactoryCode("NZ", "ME30")).toBe("NZ-30");
		expect(registryFactoryCode("NZ", "30")).toBe("NZ-30");
	});

	test("US/AU/UY/AR publish bare establishment numbers", () => {
		expect(registryFactoryCode("US", "3")).toBe("US-3");
		expect(registryFactoryCode("AU", "4")).toBe("AU-4");
		expect(registryFactoryCode("UY", "2")).toBe("UY-2");
		expect(registryFactoryCode("AR", "13")).toBe("AR-13");
	});

	test("unrecognized formats → null (宁缺勿错), never an invented code", () => {
		expect(registryFactoryCode("US", "EST17")).toBeNull();
		expect(registryFactoryCode("BR", "EST5")).toBeNull();
		expect(registryFactoryCode("NZ", "MEX")).toBeNull();
		expect(registryFactoryCode("AR", "13-A")).toBeNull();
		expect(registryFactoryCode("UY", "")).toBeNull();
		expect(registryFactoryCode("US", "  ")).toBeNull();
		// Observed id spaces that must NOT collapse onto the numeric
		// convention (244C is a different establishment than 244).
		expect(registryFactoryCode("US", "244C")).toBeNull();
		expect(registryFactoryCode("US", "P244")).toBeNull();
		expect(registryFactoryCode("US", "V45")).toBeNull();
		expect(registryFactoryCode("NZ", "S105")).toBeNull();
		expect(registryFactoryCode("NZ", "PH21")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// getlist page parsing — live-verified response shape.
// ---------------------------------------------------------------------------
describe("parseRegistryPage", () => {
	test("normalizes a live-shaped getlist page", () => {
		const json = {
			code: 0,
			msg: "",
			count: 100,
			data: [
				{
					id: 17858,
					pname: "Meat",
					gid: "Brazil",
					approvalno: "SIF1",
					qiyename: "BRF S.A.",
					activities: "屠宰,分割、冷藏Slaughter, Cutting, Coldstore",
					address: "RUA SENADOR … CONCÓRDIA - SANTA CATARINA",
					laiyuan: "http://jckspj.customs.gov.cn/spj/…",
					type: "Update",
					status: 1,
					updatetime: "1635400956",
				},
			],
		};
		const entries = parseRegistryPage(json, "BR");
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			country: "BR",
			approvalNo: "SIF1",
			factoryCode: "BR-SIF1",
			name: "BRF S.A.",
			entryType: "Update",
			registryId: 17858,
			status: 1,
			mirrorCountry: "Brazil",
			mirrorUpdateTime: "1635400956",
		});
	});

	test("blank approvalNo rows are skipped (no unique key to store under)", () => {
		const json = {
			code: 0,
			data: [
				{ id: 1, approvalno: "  ", qiyename: "X" },
				{ id: 2, approvalno: "13" },
			],
		};
		const entries = parseRegistryPage(json, "AR");
		expect(entries).toHaveLength(1);
		expect(entries[0].approvalNo).toBe("13");
	});

	test("error/empty payloads → [] (caller decides stop-vs-abort)", () => {
		expect(parseRegistryPage({ code: 1, msg: "err", data: [] }, "US")).toEqual([]);
		expect(parseRegistryPage(null, "US")).toEqual([]);
		expect(parseRegistryPage({ code: 0 }, "US")).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Persistence + promotion — integration against mt_test.
// ---------------------------------------------------------------------------
const REGISTRY_APPROVALS = ["99001", "SIF99011", "ME99012", "EST99002"];
const FACTORY_CODES = ["US-99001", "BR-SIF99011", "NZ-99012"];

function entry(
	country: string,
	approvalNo: string,
	over: Partial<RegistryEntry> = {},
): RegistryEntry {
	return {
		country,
		approvalNo,
		factoryCode: registryFactoryCode(country, approvalNo),
		name: `Plant ${approvalNo}`,
		activities: "Slaughter, Cutting",
		address: "Test address",
		sourceUrl: "http://jckspj.customs.gov.cn/test",
		entryType: "Update",
		registryId: 990000 + Number(approvalNo.replace(/\D/g, "")),
		status: 1,
		mirrorCountry: null,
		mirrorUpdateTime: null,
		...over,
	};
}

afterAll(async () => {
	await prisma.factoryRegistryEntry.deleteMany({
		where: { approvalNo: { in: REGISTRY_APPROVALS } },
	});
	await prisma.factory.deleteMany({ where: { code: { in: FACTORY_CODES } } });
});

describe("persistRegistryEntries", () => {
	test("first snapshot inserts; re-scan is unchanged-but-touched; a field change updates", async () => {
		const first = await persistRegistryEntries(
			[entry("US", "99001")],
			new Date("2026-09-19T00:00:00Z"),
		);
		expect(first).toMatchObject({ inserted: 1, updated: 0, unchanged: 0 });

		const before = await prisma.factoryRegistryEntry.findUniqueOrThrow({
			where: { country_approvalNo: { country: "US", approvalNo: "99001" } },
			select: { lastSeenAt: true },
		});

		const second = await persistRegistryEntries(
			[entry("US", "99001")],
			new Date("2026-09-19T06:00:00Z"),
		);
		expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
		const touched = await prisma.factoryRegistryEntry.findUniqueOrThrow({
			where: { country_approvalNo: { country: "US", approvalNo: "99001" } },
			select: { lastSeenAt: true },
		});
		// The unchanged touch still advances lastSeenAt — the weekly gate's
		// freshness signal (a static registry must not re-scan daily).
		expect(touched.lastSeenAt.getTime()).toBeGreaterThan(before.lastSeenAt.getTime());

		const third = await persistRegistryEntries(
			[entry("US", "99001", { name: "Renamed Plant" })],
			new Date("2026-09-19T12:00:00Z"),
		);
		expect(third).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 });
		const renamed = await prisma.factoryRegistryEntry.findUniqueOrThrow({
			where: { country_approvalNo: { country: "US", approvalNo: "99001" } },
			select: { name: true },
		});
		expect(renamed.name).toBe("Renamed Plant");
	});

	test("unmapped approvalNo formats count as unmappedFactoryCode but still store", async () => {
		const report = await persistRegistryEntries([entry("US", "EST99002")], new Date());
		expect(report).toMatchObject({ inserted: 1, unmappedFactoryCode: 1 });
		const stored = await prisma.factoryRegistryEntry.findUniqueOrThrow({
			where: { country_approvalNo: { country: "US", approvalNo: "EST99002" } },
			select: { factoryCode: true },
		});
		expect(stored.factoryCode).toBeNull();
	});
});

describe("promoteVerifiedFactories", () => {
	test("registry-matched plant is promoted with name attached; unmatched stays unverified", async () => {
		await prisma.factoryRegistryEntry.create({
			data: {
				country: "BR",
				approvalNo: "SIF99011",
				factoryCode: "BR-SIF99011",
				name: "Frigorífico Test 99011",
				status: 1,
				lastSeenAt: new Date(),
			},
		});
		// NZ-99012 deliberately gets NO registry row (unmatched path).
		for (const [code, country, plant] of [
			["BR-SIF99011", "BR", "99011"],
			["NZ-99012", "NZ", "99012"],
		] as const) {
			await prisma.factory.upsert({
				where: { code },
				update: {},
				create: {
					code,
					name: `Plant ${plant}`,
					country,
					metadata: {
						kind: "gacc-plant-unverified",
						source: "roujiaosuo-title",
						plantNumber: plant,
						note: "unverified",
					},
				},
			});
		}

		const report = await promoteVerifiedFactories();
		// Global counts can only be lower-bounded: vitest runs files in
		// parallel and roujiaosuoSpot.test.ts also creates (and cleans up)
		// gacc-plant-unverified factories — those can never match THIS file's
		// registry rows, so promoted is exact and stillUnverified is ≥ ours.
		expect(report.promoted).toBe(1);
		expect(report.stillUnverified).toBeGreaterThanOrEqual(1);

		const promoted = await prisma.factory.findUniqueOrThrow({
			where: { code: "BR-SIF99011" },
		});
		const meta = promoted.metadata as Record<string, unknown>;
		expect(meta.kind).toBe("gacc-plant-verified");
		expect(meta.registryName).toBe("Frigorífico Test 99011");
		expect(meta.plantNumber).toBe("99011"); // round-168 metadata preserved

		const stuck = await prisma.factory.findUniqueOrThrow({ where: { code: "NZ-99012" } });
		expect((stuck.metadata as Record<string, unknown>).kind).toBe("gacc-plant-unverified");
	});
});
