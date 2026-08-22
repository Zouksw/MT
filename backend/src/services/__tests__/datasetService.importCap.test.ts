/**
 * importDatasetData — value-column cap (round-119).
 *
 * valueColumns was unbounded: a CSV with thousands of columns fanned out
 * into that many timeseries upserts (self-harm DoS surface). The cap (50)
 * rejects pathological imports BEFORE any timeseries is created.
 *
 * Service-level test against real Prisma; both cases use one owned dataset.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { BadRequestError } from "@/middleware/errorHandler";
import { importDatasetData } from "@/services/datasetService";

describe("importDatasetData — value column cap", () => {
	let userId = "";
	let datasetId = "";

	beforeAll(async () => {
		const user = await prisma.user.create({
			data: {
				email: `importcap-${Date.now()}@test.local`,
				name: "Import Cap",
				passwordHash: "x",
				role: "VIEWER",
			},
		});
		userId = user.id;
		const ds = await prisma.dataset.create({
			data: {
				name: "cap-ds",
				slug: `cap-ds-${Date.now()}`,
				storageFormat: "CSV",
				ownerId: userId,
			},
		});
		datasetId = ds.id;
	});

	afterAll(async () => {
		// Dataset cascade removes timeseries + datapoints; then the user.
		await prisma.dataset.deleteMany({ where: { ownerId: userId } });
		await prisma.user.delete({ where: { id: userId } });
	});

	it("rejects a CSV with more than 50 value columns with a 400-type error", async () => {
		const cols = Array.from({ length: 51 }, (_, i) => `v${i}`);
		const csv = `date,${cols.join(",")}\n2026-01-01,${cols.map(() => "1").join(",")}`;

		await expect(importDatasetData(datasetId, userId, "csv", csv)).rejects.toThrow(BadRequestError);
		await expect(importDatasetData(datasetId, userId, "csv", csv)).rejects.toThrow(
			/50 value columns/,
		);
	});

	it("still accepts a normal multi-column CSV within the cap", async () => {
		const csv = "date,temp,humidity\n2026-01-01,10,20";
		const result = await importDatasetData(datasetId, userId, "csv", csv);
		expect(result.importStats.timeseriesCreated).toBe(2);
		expect(result.importStats.datapointsImported).toBe(2);
	});
});
