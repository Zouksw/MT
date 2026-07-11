/**
 * Dataset management service.
 *
 * Pure functions for listing, creating, updating, deleting, and importing
 * data into datasets. Routes in `routes/datasets.ts` own the HTTP boundary
 * (auth, caching, response shaping); this service owns the Prisma queries
 * and the CSV/JSON import pipeline.
 */

import type { Prisma, StorageFormat } from "@prisma/client";
import Papa from "papaparse";
import { prisma } from "@/lib";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/middleware/errorHandler";

type DatasetRow = {
	sizeBytes?: bigint | null;
	rowsCount?: number | null;
	owner?: Record<string, unknown>;
	[key: string]: unknown;
};

/** Serialize BigInt fields for JSON responses. */
export function serializeDataset(dataset: DatasetRow) {
	const serialized: DatasetRow = { ...dataset };
	if (serialized.sizeBytes)
		serialized.sizeBytes = serialized.sizeBytes.toString() as unknown as bigint;
	if (serialized.owner) serialized.owner = { ...serialized.owner };
	return serialized;
}

/** List datasets with optional search + pagination. */
export async function listDatasets(options: { search?: string; skip: number; take: number }) {
	const where: Prisma.DatasetWhereInput = {};
	if (options.search) {
		where.OR = [
			{ name: { contains: options.search, mode: "insensitive" } },
			{ description: { contains: options.search, mode: "insensitive" } },
		];
	}

	const [datasets, total] = await Promise.all([
		prisma.dataset.findMany({
			where,
			skip: options.skip,
			take: options.take,
			include: {
				owner: { select: { id: true, name: true, email: true } },
				_count: { select: { timeseries: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.dataset.count({ where }),
	]);

	const serialized = datasets.map(
		(ds: { sizeBytes?: bigint | null; rowsCount?: number | null; [key: string]: unknown }) => ({
			...ds,
			sizeBytes: ds.sizeBytes?.toString() || null,
			rowsCount: ds.rowsCount || null,
		}),
	);

	return { datasets: serialized, total };
}

/** Get a single dataset with timeseries + owner.
 *  When `userId` is provided, scope by ownership and throw NotFoundError for
 *  non-owners — so a caller cannot distinguish "does not exist" from "not mine"
 *  (prevents existence-leak / IDOR on the read path). */
export async function getDataset(id: string, userId?: string) {
	const dataset = await prisma.dataset.findUnique({
		where: { id },
		include: {
			owner: { select: { id: true, name: true, email: true } },
			timeseries: { include: { _count: { select: { dataPoints: true } } } },
			_count: { select: { timeseries: true } },
		},
	});
	// Same response for "missing" and "not owned" — no existence disclosure.
	if (!dataset || (userId !== undefined && dataset.ownerId !== userId)) {
		throw new NotFoundError("Dataset");
	}
	return dataset;
}

/** Create a dataset. Throws BadRequestError on duplicate slug. */
export async function createDataset(
	input: {
		name: string;
		slug: string;
		description?: string;
		storageFormat: StorageFormat;
	},
	userId: string,
) {
	const existing = await prisma.dataset.findFirst({
		where: { slug: input.slug },
	});
	if (existing) throw new BadRequestError("Slug already exists");

	// Get or create default organization for the user
	const defaultOrgId = "default-org-id";
	const organization = await prisma.organizations.upsert({
		where: { id: defaultOrgId },
		update: {},
		create: { id: defaultOrgId, owner_id: userId, name: "Default", slug: "default" },
	});

	const dataset = await prisma.dataset.create({
		data: {
			name: input.name,
			slug: input.slug,
			description: input.description,
			storageFormat: input.storageFormat,
			ownerId: userId,
			organization_id: organization.id,
		},
		include: { owner: { select: { id: true, name: true, email: true } } },
	});

	return dataset;
}

/** Load a dataset and verify ownership. Throws 404/403 on failure. */
export async function requireOwnedDataset(datasetId: string, userId: string) {
	const dataset = await prisma.dataset.findUnique({
		where: { id: datasetId },
	});
	if (!dataset) throw new NotFoundError("Dataset");
	if (dataset.ownerId !== userId) throw new ForbiddenError();
	return dataset;
}

/** Update a dataset (owner only). */
export async function updateDataset(
	datasetId: string,
	userId: string,
	data: Prisma.DatasetUpdateInput,
) {
	await requireOwnedDataset(datasetId, userId);

	return prisma.dataset.update({
		where: { id: datasetId },
		data: { ...data, lastAccessedAt: new Date() },
		include: { owner: { select: { id: true, name: true, email: true } } },
	});
}

/** Delete a dataset (owner only). */
export async function deleteDataset(datasetId: string, userId: string): Promise<void> {
	await requireOwnedDataset(datasetId, userId);
	await prisma.dataset.delete({ where: { id: datasetId } });
}

/**
 * Import CSV/JSON data into a dataset. Parses the payload, creates a
 * timeseries per value column, and batch-inserts datapoints. Returns the
 * updated dataset + import statistics.
 */
export async function importDatasetData(
	datasetId: string,
	userId: string,
	format: string,
	data: unknown,
) {
	if (!format || !data) throw new BadRequestError("Format and data are required");

	const dataset = await requireOwnedDataset(datasetId, userId);

	let parsedData: Record<string, unknown>[] = [];
	let timestampColumn = "timestamp";
	let valueColumns: string[] = [];

	if (format === "csv") {
		const parseResult = Papa.parse(data as string, {
			header: true,
			dynamicTyping: true,
			skipEmptyLines: true,
		});
		if (parseResult.errors.length > 0) throw new BadRequestError("CSV parsing failed");

		parsedData = parseResult.data as Record<string, unknown>[];
		const columns = Object.keys(parsedData[0] || {});
		timestampColumn =
			columns.find((col) =>
				["timestamp", "time", "datetime", "date", "ts"].includes(col.toLowerCase()),
			) || columns[0];
		valueColumns = columns.filter((col) => col !== timestampColumn);
	} else if (format === "json") {
		parsedData = Array.isArray(data)
			? (data as Record<string, unknown>[])
			: [data as Record<string, unknown>];
		const columns = Object.keys(parsedData[0] || {});
		timestampColumn =
			columns.find((col) =>
				["timestamp", "time", "datetime", "date", "ts"].includes(col.toLowerCase()),
			) || columns[0];
		valueColumns = columns.filter((col) => col !== timestampColumn);
	} else {
		throw new BadRequestError('Unsupported format. Use "csv" or "json"');
	}

	if (parsedData.length === 0) throw new BadRequestError("No data found");

	// Create timeseries for each value column
	const timeseries = await Promise.all(
		valueColumns.map(async (column) => {
			const slug = column
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");
			return prisma.timeseries.upsert({
				where: { datasetId_slug: { datasetId: dataset.id, slug } },
				update: {},
				create: { datasetId: dataset.id, name: column, slug, unit: "" },
			});
		}),
	);

	// Batch insert datapoints (1000 at a time)
	const batchSize = 1000;
	let totalDatapoints = 0;

	for (let i = 0; i < parsedData.length; i += batchSize) {
		const batch = parsedData.slice(i, i + batchSize);
		const datapoints: {
			timeseriesId: string;
			timestamp: Date;
			valueJson: string;
		}[] = [];

		for (const row of batch) {
			const timestamp = new Date(row[timestampColumn] as string | number | Date);
			if (Number.isNaN(timestamp.getTime())) continue;

			for (const ts of timeseries) {
				const value = row[ts.name];
				if (value !== null && value !== undefined) {
					datapoints.push({
						timeseriesId: ts.id,
						timestamp,
						valueJson: JSON.stringify(value),
					});
				}
			}
		}

		if (datapoints.length > 0) {
			await prisma.datapoint.createMany({ data: datapoints, skipDuplicates: true });
			totalDatapoints += datapoints.length;
		}
	}

	const updatedDataset = await prisma.dataset.update({
		where: { id: datasetId },
		data: { isImported: true, rowsCount: totalDatapoints, lastAccessedAt: new Date() },
	});

	return {
		dataset: updatedDataset,
		importStats: {
			timeseriesCreated: timeseries.length,
			datapointsImported: totalDatapoints,
			columns: valueColumns,
		},
	};
}
