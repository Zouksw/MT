/**
 * Shared test helper for datasets route tests
 *
 * Consolidates mock setup, test app creation, and common fixtures
 * used across datasets.route.test.ts and datasets-import.test.ts
 */

import express, { type Express } from "express";
import { vi } from "vitest";

const jest = vi;

/** Creates the standard mock setup for datasets route tests */
export function setupDatasetsMocks() {
	jest.mock("@/lib", () => {
		const mockPrisma = {
			dataset: {
				findMany: jest.fn(),
				count: jest.fn(),
				findUnique: jest.fn(),
				findFirst: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				delete: jest.fn(),
			},
			timeseries: {
				findMany: jest.fn(),
				count: jest.fn(),
				create: jest.fn(),
				upsert: jest.fn(),
			},
			datapoint: {
				findMany: jest.fn(),
				create: jest.fn(),
				createMany: jest.fn(),
			},
			organizations: {
				findFirst: jest.fn(),
				create: jest.fn(),
			},
			$transaction: jest.fn(),
		};

		return {
			prisma: mockPrisma,
			logger: {
				info: jest.fn(),
				error: jest.fn(),
				warn: jest.fn(),
				debug: jest.fn(),
			},
			getPagination: jest.fn(() => ({ skip: 0, take: 20 })),
		};
	});

	jest.mock("@/utils/logger", () => ({
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		},
	}));

	jest.mock("@/middleware/cacheDecorator", () => ({
		cacheRoute: () => (_req: unknown, _res: unknown, next: () => void) =>
			next(),
		invalidateCache: jest.fn((): Promise<number> => Promise.resolve(0)),
	}));

	jest.mock("@/middleware/auth", () => ({
		authenticate: (
			req: Record<string, unknown>,
			_res: unknown,
			next: () => void,
		) => {
			req.user = {
				id: "test-user-id",
				role: "admin",
				name: "Test User",
				email: "test@example.com",
			};
			req.userId = "test-user-id";
			next();
		},
		AuthRequest: class AuthRequest {},
	}));
}

/** Creates a fresh Express app with datasets router and error handler */
export function createTestApp(): Express {
	const { datasetsRouter } = require("@/routes/datasets");
	const { errorHandler } = require("@/middleware/errorHandler");
	const app = express();
	app.use(express.json());
	app.use("/datasets", datasetsRouter);
	app.use(errorHandler);
	return app;
}

/** Standard mock dataset fixture */
export const mockDataset = {
	id: "dataset-123",
	name: "Test Dataset",
	slug: "test-dataset",
	storageFormat: "CSV",
	ownerId: "test-user-id",
	owner: {
		id: "test-user-id",
		name: "Test User",
		email: "test@example.com",
	},
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
	sizeBytes: BigInt(1000),
	rowsCount: BigInt(100),
	timeseries: [],
	_count: { timeseries: 0 },
};

/** Dataset owned by a different user (for ownership tests) */
export const otherOwnerDataset = {
	...mockDataset,
	id: "dataset-456",
	ownerId: "different-user-id",
	owner: {
		id: "different-user-id",
		name: "Other User",
		email: "other@example.com",
	},
};

/** Sets default mock return values for all Prisma methods */
export function setDefaultMockReturns(prisma: {
	dataset: Record<string, ReturnType<typeof jest.fn>>;
	timeseries: Record<string, ReturnType<typeof jest.fn>>;
	datapoint: Record<string, ReturnType<typeof jest.fn>>;
	organizations: Record<string, ReturnType<typeof jest.fn>>;
	$transaction: ReturnType<typeof jest.fn>;
}) {
	prisma.dataset.findMany.mockResolvedValue([]);
	prisma.dataset.count.mockResolvedValue(0);
	prisma.dataset.findUnique.mockResolvedValue(null);
	prisma.dataset.findFirst.mockResolvedValue(null);
	prisma.dataset.create.mockResolvedValue(mockDataset);
	prisma.dataset.update.mockResolvedValue(mockDataset);
	prisma.dataset.delete.mockResolvedValue(mockDataset);
	prisma.timeseries.upsert.mockResolvedValue({
		id: "ts-1",
		name: "temperature",
		slug: "temperature",
	});
	prisma.datapoint.createMany.mockResolvedValue({ count: 0 });
	prisma.organizations.findFirst.mockResolvedValue({
		id: "default-org-id",
		name: "Default",
		slug: "default",
	});
	prisma.$transaction.mockImplementation(async (cb: (p: unknown) => unknown) =>
		cb(prisma),
	);
}
