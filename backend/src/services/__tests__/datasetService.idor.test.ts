/**
 * Dataset IDOR regression test.
 *
 * Pins the fix for the insecure-direct-object-reference on GET /api/datasets/:id.
 * Before the fix, getDataset(id) ignored ownership — any authenticated user could
 * read any dataset by guessing its id (including its timeseries + owner info).
 * After the fix, getDataset(id, userId) throws NotFoundError for non-owners, so
 * a caller cannot distinguish "does not exist" from "not mine".
 *
 * Service-level test (real Prisma + real Postgres, no HTTP layer). Two real users
 * are created; user A owns the dataset, user B must NOT be able to fetch it.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { NotFoundError } from "@/middleware/errorHandler";
import { getDataset } from "@/services/datasetService";

const PREFIX = "idor-test";

// Helpers ---------------------------------------------------------------

async function createUser(email: string) {
	return prisma.user.create({
		data: {
			email,
			name: `IDOR ${email}`,
			passwordHash: "test-hash-not-real",
			role: "EDITOR",
		},
	});
}

let counter = 0;
function uniqueSlug() {
	counter += 1;
	return `${PREFIX}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

// State -----------------------------------------------------------------

let userA: { id: string };
let userB: { id: string };
let datasetId: string;
const createdUserIds: string[] = [];
const createdDatasetIds: string[] = [];

beforeEach(async () => {
	userA = await createUser(`idor-a-${Date.now()}-${counter}@test`);
	userB = await createUser(`idor-b-${Date.now()}-${counter}@test`);
	createdUserIds.push(userA.id, userB.id);

	// Create the dataset directly via Prisma (bypassing createDataset) — we
	// only want to exercise getDataset, the function under test.
	const ds = await prisma.dataset.create({
		data: {
			name: "A's private dataset",
			slug: uniqueSlug(),
			storageFormat: "CSV",
			ownerId: userA.id,
		},
	});
	datasetId = ds.id;
	createdDatasetIds.push(datasetId);
});

afterEach(async () => {
	// Delete in FK-safe order: datasets cascade timeseries → users.
	await prisma.dataset.deleteMany({ where: { id: { in: createdDatasetIds } } }).catch(() => {});
	await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
	createdUserIds.length = 0;
	createdDatasetIds.length = 0;
});

// Tests -----------------------------------------------------------------

describe("getDataset — IDOR protection", () => {
	it("owner can fetch their own dataset", async () => {
		const ds = await getDataset(datasetId, userA.id);
		expect(ds.id).toBe(datasetId);
		expect(ds.ownerId).toBe(userA.id);
	});

	it("non-owner CANNOT fetch another user's dataset (throws NotFoundError)", async () => {
		// THIS IS THE REGRESSION TEST. Before the fix, getDataset(id) ignored
		// userId entirely and returned A's dataset to B. After the fix, B gets
		// the same NotFoundError as if the dataset did not exist — no existence leak.
		await expect(getDataset(datasetId, userB.id)).rejects.toThrow(NotFoundError);
	});

	it("non-owner gets NotFound (404), not Forbidden (403) — no existence disclosure", async () => {
		// The error class must be NotFoundError so the response is 404, identical
		// to the "truly missing" case below. A 403 would leak that the id exists.
		try {
			await getDataset(datasetId, userB.id);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(NotFoundError);
		}
	});

	it("truly-missing id also throws NotFoundError (same shape as non-owner)", async () => {
		// Both "missing" and "not owned" must produce the identical error class
		// so the caller cannot distinguish the two states.
		const fakeId = "00000000-0000-4000-8000-000000000000";
		await expect(getDataset(fakeId, userA.id)).rejects.toThrow(NotFoundError);
	});

	it("omitting userId retains the original (unscoped) lookup for internal callers", async () => {
		// Backward-compat: getDataset(id) without userId is still unscoped, so
		// internal/admin paths that legitimately need cross-user reads still work.
		const ds = await getDataset(datasetId);
		expect(ds.id).toBe(datasetId);
	});
});
