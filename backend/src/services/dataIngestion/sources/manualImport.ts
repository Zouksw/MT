import type { Prisma } from "@prisma/client";
import Papa from "papaparse";
import { logger, prisma } from "@/lib";
import type { FieldMapping, NormalizedPrice } from "../normalizer";
import { normalizePriceEntry } from "../normalizer";

export function parseCSV(
	buffer: Buffer,
	options?: { delimiter?: string },
): Record<string, unknown>[] {
	const text = buffer.toString("utf-8");
	const result = Papa.parse(text, {
		header: true,
		skipEmptyLines: true,
		dynamicTyping: true,
		delimiter: options?.delimiter,
	});

	if (result.errors.length > 0) {
		const critical = result.errors.filter((e) => e.type !== "FieldMismatch");
		if (critical.length > 0) {
			throw new Error(
				`CSV parse error: ${critical.map((e) => e.message).join("; ")}`,
			);
		}
	}

	return result.data as Record<string, unknown>[];
}

export function parseExcel(
	_buffer: Buffer,
	_sheetName?: string,
): Record<string, unknown>[] {
	// xlsx is an optional dependency — throw a clear error if missing
	throw new Error(
		"Excel import requires the xlsx package. Install with: pnpm add xlsx",
	);
}

export async function importRows(
	commodityId: string,
	rows: Record<string, unknown>[],
	mapping: FieldMapping,
	interval: string = "daily",
): Promise<{ inserted: number; updated: number; errors: number }> {
	let inserted = 0;
	let updated = 0;
	let errors = 0;

	const commodity = await prisma.commodity.findUnique({
		where: { id: commodityId },
	});
	if (!commodity) {
		throw new Error(`Commodity not found: ${commodityId}`);
	}

	for (const row of rows) {
		let normalized: NormalizedPrice;
		try {
			normalized = normalizePriceEntry(row, mapping);
		} catch (err) {
			errors++;
			logger.debug(
				`[ManualImport] Skipping row due to normalization error: ${err instanceof Error ? err.message : err}`,
			);
			continue;
		}

		const dateOnly = new Date(normalized.date);
		dateOnly.setHours(0, 0, 0, 0);

		const source = normalized.source || "manual";

		try {
			const existing = await prisma.commodityPrice.findUnique({
				where: {
					commodityId_interval_date_source: {
						commodityId,
						interval,
						date: dateOnly,
						source,
					},
				},
			});

			const priceData = {
				open: normalized.open,
				high: normalized.high,
				low: normalized.low,
				close: normalized.close,
				volume: normalized.volume,
				source,
				metadata: (normalized.metadata ??
					undefined) as unknown as Prisma.InputJsonValue,
			};

			if (existing) {
				await prisma.commodityPrice.update({
					where: { id: existing.id },
					data: priceData,
				});
				updated++;
			} else {
				await prisma.commodityPrice.create({
					data: {
						commodityId,
						date: dateOnly,
						interval,
						...priceData,
					},
				});
				inserted++;
			}
		} catch (err) {
			errors++;
			logger.debug(
				`[ManualImport] DB error for row: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	logger.info(
		`[ManualImport] Import complete for ${commodityId}: ${inserted} inserted, ${updated} updated, ${errors} errors`,
	);

	return { inserted, updated, errors };
}
