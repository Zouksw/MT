/**
 * Beef cut price manual import — the no-API-key real-data path.
 *
 * PURPOSE
 * When no beef scraper API key is available (USDA_MARS_API_KEY / MLA_API_KEY),
 * this is how real cut-level prices enter the platform: an admin uploads a CSV
 * of actual procurement / market quotes. Each upload is stamped
 * source='manual:<uploader>' so it is always distinguishable from scraper
 * output AND from the synthetic seed snapshot — and the freshness framework
 * classifies it 'live' (recent, non-bridge, non-seed).
 *
 * This is the path that makes the platform honest AND usable before keys are
 * obtained: real data the operator has (purchase records, industry contacts)
 * flows in, gets the 'live' freshness tier, and unlocks per-cut AI forecasts
 * (the dual-backend gate passes once fresh manual rows exist).
 *
 * CSV CONTRACT (header row required, case-insensitive):
 *   factoryCode, cutCode, price, date[, currency, unit, grade]
 *
 *   factoryCode — Factory.code e.g. 'AU-847', 'BR-SIF2057' (must exist)
 *   cutCode     — BeefCutTaxonomy.cutCode e.g. 'BRISKET_NAVEL' (must exist)
 *   price       — numeric, in the currency/unit below
 *   date        — YYYY-MM-DD
 *   currency    — optional, default 'USD'
 *   unit        — optional, default 'USD/kg'
 *   grade       — optional, e.g. 'M7', 'Choice'
 *
 * Idempotent on [factoryId, cutCode, date, source] — re-uploading the same
 * row updates the price rather than duplicating.
 */

import { prisma } from "@/lib";

export interface BeefImportRow {
	factoryCode: string;
	cutCode: string;
	price: number;
	date: Date;
	currency?: string;
	unit?: string;
	grade?: string;
}

export interface BeefImportResult {
	imported: number;
	updated: number;
	skipped: number;
	errors: Array<{ row: number; message: string }>;
}

/** Normalize a CSV header to the canonical lower-case key. */
function normalizeHeader(h: string): string {
	return h.trim().toLowerCase().replace(/\s+/g, "");
}

/** Parse a CSV buffer into row objects (header row required). Minimal, robust. */
export function parseBeefCSV(buffer: Buffer, delimiter = ","): Array<Record<string, string>> {
	const text = buffer.toString("utf-8").replace(/^\uFEFF/, ""); // strip BOM
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const headers = lines[0].split(delimiter).map(normalizeHeader);
	const rows: Array<Record<string, string>> = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = lines[i].split(delimiter);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = (cells[j] ?? "").trim();
		}
		rows.push(row);
	}
	return rows;
}

/**
 * Import parsed beef price rows. Validates factoryCode + cutCode against the
 * DB, upserts each row. Per-row errors are collected (one bad row doesn't
 * abort the rest). The source is stamped 'manual:<uploaderEmail>'.
 *
 * The entire batch of valid rows is written inside a single transaction so a
 * crash mid-import leaves no partial write. Insert vs update is determined by
 * the upsert's returned `createdAt`/`updatedAt`, but with a clock-skew-safe
 * comparison (equality within a 1ms tolerance) rather than exact equality.
 */
export async function importBeefPrices(
	rows: Array<Record<string, string>>,
	uploader: string,
): Promise<BeefImportResult> {
	const source = `manual:${uploader}`;
	let imported = 0;
	let updated = 0;
	let skipped = 0;
	const errors: Array<{ row: number; message: string }> = [];

	// Cache factory + taxonomy lookups to avoid N+1 queries on repeated codes.
	const factoryCache = new Map<string, string | null>();
	const cutCache = new Map<string, boolean>();

	// First pass: validate + resolve all rows, collecting valid upsert payloads
	// and per-row errors. Validation reads happen outside the transaction so a
	// slow lookup on a bad CSV doesn't hold a write lock.
	interface PendingUpsert {
		factoryId: string;
		cutCode: string;
		price: number;
		currency: string;
		unit: string;
		grade: string | null;
		date: Date;
		rowNum: number;
	}
	const pending: PendingUpsert[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const rowNum = i + 2; // +1 for header, +1 for 1-based
		const factoryCode = (row.factorycode || row.factory || "").trim();
		const cutCode = (row.cutcode || row.cut || "").trim().toUpperCase();
		const priceStr = (row.price || "").trim();
		const dateStr = (row.date || "").trim();

		if (!factoryCode || !cutCode || !priceStr || !dateStr) {
			errors.push({
				row: rowNum,
				message: "Missing required field (factoryCode/cutCode/price/date)",
			});
			skipped++;
			continue;
		}

		const price = Number(priceStr);
		if (Number.isNaN(price) || price <= 0) {
			errors.push({ row: rowNum, message: `Invalid price: ${priceStr}` });
			skipped++;
			continue;
		}

		const date = new Date(dateStr);
		if (Number.isNaN(date.getTime())) {
			errors.push({ row: rowNum, message: `Invalid date: ${dateStr}` });
			skipped++;
			continue;
		}
		date.setUTCHours(0, 0, 0, 0);

		// Resolve factoryCode → factoryId (cached).
		let factoryId = factoryCache.get(factoryCode);
		if (factoryId === undefined) {
			const factory = await prisma.factory.findUnique({
				where: { code: factoryCode },
				select: { id: true },
			});
			factoryId = factory?.id ?? null;
			factoryCache.set(factoryCode, factoryId);
		}
		if (!factoryId) {
			errors.push({ row: rowNum, message: `Unknown factoryCode: ${factoryCode}` });
			skipped++;
			continue;
		}

		// Validate cutCode exists in taxonomy (cached).
		let cutExists = cutCache.get(cutCode);
		if (cutExists === undefined) {
			const cut = await prisma.beefCutTaxonomy.findUnique({
				where: { cutCode },
				select: { cutCode: true },
			});
			cutExists = !!cut;
			cutCache.set(cutCode, cutExists);
		}
		if (!cutExists) {
			errors.push({ row: rowNum, message: `Unknown cutCode: ${cutCode}` });
			skipped++;
			continue;
		}

		const currency = (row.currency || "USD").trim();
		const unit = (row.unit || "USD/kg").trim();
		const grade = (row.grade || "").trim() || null;

		pending.push({ factoryId, cutCode, price, currency, unit, grade, date, rowNum });
	}

	// Second pass: execute all valid upserts inside a single transaction so the
	// import is atomic — either every valid row lands or none do. A failure
	// rolls back the whole batch and is reported as a single error (the
	// per-row validation above has already filtered out individual bad rows).
	if (pending.length > 0) {
		try {
			await prisma.$transaction(async (tx) => {
				for (const p of pending) {
					const result = await tx.beefCutPrice.upsert({
						where: {
							factoryId_cutCode_date_source: {
								factoryId: p.factoryId,
								cutCode: p.cutCode,
								date: p.date,
								source,
							},
						},
						create: {
							factoryId: p.factoryId,
							cutCode: p.cutCode,
							price: p.price,
							currency: p.currency,
							unit: p.unit,
							source,
							sourceRef: uploader,
							date: p.date,
							grade: p.grade,
						},
						update: { price: p.price, currency: p.currency, unit: p.unit, grade: p.grade },
					});
					// Distinguish insert vs update: a freshly-created row has
					// createdAt within 1ms of updatedAt. Exact equality is fragile
					// under DB-side default-timestamp rounding / clock skew.
					const delta = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime());
					if (delta <= 1) {
						imported++;
					} else {
						updated++;
					}
				}
			});
		} catch (err) {
			// The whole transaction rolled back — report it against every
			// pending row so the operator knows which rows were affected.
			const msg = err instanceof Error ? err.message : String(err);
			for (const p of pending) {
				errors.push({ row: p.rowNum, message: `DB error (batch rolled back): ${msg}` });
				skipped++;
			}
		}
	}

	return { imported, updated, skipped, errors };
}
