/**
 * Beef ingest — write side of the beef domain (round-117 merge).
 * Sections: beefImport (CSV import) · beefPriceBridge (commodity->cut bridge).
 * Exports unchanged from the two source modules.
 */

import { prisma } from "@/lib";
import { logger } from "@/lib/logger.js";
// ---------------------------------------------------------------------------
// beefImport
// ---------------------------------------------------------------------------

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
	/**
	 * Distinct (factoryId, cutCode) pairs that had at least one row
	 * successfully written. Callers use this to invalidate stale prediction
	 * caches — a forecast cached against the pre-import price series is now
	 * dishonest once newer data has landed.
	 */
	affectedCuts: Array<{ factoryId: string; cutCode: string }>;
}

/** Normalize a CSV header to the canonical lower-case key. */
function normalizeHeader(h: string): string {
	return h.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Parse a date cell from a manual import CSV into a Date, or null when
 * unparseable.
 *
 * ISO strings ("2026-07-26") are UTC-safe in new Date(). Slash dates
 * ("MM/DD/YYYY", US-format CSVs) are NOT: they parse in the server's local
 * timezone, so on a UTC+8 host "08/21/2026" lands at 2026-08-20T16:00Z and
 * a subsequent UTC-midnight truncation pins the PREVIOUS day. Slash
 * components are therefore built as UTC explicitly (round-119).
 */
export function parseImportDate(dateStr: string): Date | null {
	const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
	if (slash) {
		const month = Number(slash[1]);
		const day = Number(slash[2]);
		const year = Number(slash[3]);
		const date = new Date(Date.UTC(year, month - 1, day));
		// Reject rollover: "13/45/2026" or "02/31/2026" must not silently
		// become a different valid date.
		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month - 1 ||
			date.getUTCDate() !== day
		) {
			return null;
		}
		return date;
	}
	const iso = new Date(dateStr);
	return Number.isNaN(iso.getTime()) ? null : iso;
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

		// Slash dates ("MM/DD/YYYY" in US-format manual CSVs) are parsed in
		// the SERVER's local timezone — on a UTC+8 host "08/21/2026" lands at
		// 2026-08-20T16:00Z and the setUTCHours below then pins it to the
		// previous day. parseImportDate builds slash-separated components as
		// UTC explicitly; ISO date strings are already UTC-safe.
		const date = parseImportDate(dateStr);
		if (!date) {
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
	// Track which (factoryId, cutCode) pairs were touched so the caller can
	// evict their stale prediction caches after commit.
	const touchedCuts = new Map<string, { factoryId: string; cutCode: string }>();
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
					// Record the cut pair for post-import cache eviction.
					// Keyed by `${factoryId}|${cutCode}` to dedupe across rows.
					const dedupeKey = `${p.factoryId}|${p.cutCode}`;
					if (!touchedCuts.has(dedupeKey)) {
						touchedCuts.set(dedupeKey, { factoryId: p.factoryId, cutCode: p.cutCode });
					}
				}
			});
		} catch (err) {
			// The whole transaction rolled back — report it against every
			// pending row so the operator knows which rows were affected.
			// round-119: the per-row counters incremented inside the
			// transaction callback describe writes that no longer exist —
			// reset them, or the response says "imported 5" while also
			// reporting every row rolled back (and affectedCuts would evict
			// caches for data that was never written).
			const msg = err instanceof Error ? err.message : String(err);
			imported = 0;
			updated = 0;
			touchedCuts.clear();
			for (const p of pending) {
				errors.push({ row: p.rowNum, message: `DB error (batch rolled back): ${msg}` });
				skipped++;
			}
		}
	}

	return {
		imported,
		updated,
		skipped,
		errors,
		affectedCuts: Array.from(touchedCuts.values()),
	};
}
// ---------------------------------------------------------------------------
// beefPriceBridge
// ---------------------------------------------------------------------------

/** ISO 3166 alpha-3 (Commodity.originCountry) → alpha-2 (Factory.code prefix). */
export const ISO3_TO_ISO2: Record<string, string> = {
	AUS: "AU",
	BRA: "BR",
	ARG: "AR",
	URY: "UY",
	USA: "US",
	CN: "CN",
};

/**
 * The conservative slug → cutCode mapping. Each entry MUST have an unambiguous
 * justification (nameCn AND/OR an alias both pointing to the same cutCode).
 * Add a new entry only when you can cite the normalizer line that disambiguates.
 *
 * Justification sources (beefCutNormalizer.ts):
 *   - 牛腩 (brisket) → BRISKET_NAVEL  (the standard brisket cut for this platform)
 *   - alias "cube roll" + nameCn 眼肉 → RIB_EYE_ROLL
 *   - subcategory "topside" + nameCn 小米龙 → TOPSIDE
 */
export const SLUG_TO_CUTCODE: Record<string, string> = {
	// Brisket — nameCn 牛腩 across all three origins → BRISKET_NAVEL.
	aus_brisket_m7: "BRISKET_NAVEL",
	bra_brisket: "BRISKET_NAVEL",
	arg_brisket: "BRISKET_NAVEL",

	// Rib eye — alias "cube roll" + nameCn 眼肉 agree on RIB_EYE_ROLL.
	aus_cube_roll_m9: "RIB_EYE_ROLL",

	// Topside — subcategory exact + nameCn 小米龙 agree on TOPSIDE.
	bra_topside: "TOPSIDE",
};

// ─── DELIBERATELY NOT BRIDGED (document for a future round) ─────────────────
//
// AMBIGUOUS (multiple cutCodes fit — needs an explicit manual pick before adding):
//   aus_sirloin_m9  → STRIPLOIN (nameCn 西冷) vs SIRLOIN (subcategory)
//   aus_shin_m5     → FORESHANK vs HEEL_MUSCLE (both nameZh 牛腱)
//   aus_thick_flank_m7 → KNUCKLE vs TOPSIDE (no thick_flank cutCode)
//   aus_oyster_blade_m7 → BLADE (alias) vs HANGING_TENDER (nameEn alt)
//   aus_rump_m5     → RUMP (alias) vs CHUCK_TENDER (nameCn 黄瓜条)
//   bra_shin        → FORESHANK (see aus_shin_m5)
//   bra_round       → SILVERSIDE vs OUTSIDE_FLAT
//   arg_shin        → FORESHANK (see aus_shin_m5)
//   arg_forequarter → QUARTER_FRONT (carcass) vs FORESHANK (nameCn 前腱)
//   ury_thick_flank → KNUCKLE vs TOPSIDE
//   ury_shin        → FORESHANK (see aus_shin_m5)
//
// NO cutCode (trade form, not a cut):
//   bra_frozen_boneless, ury_boneless
//
// NO Factory (domestic CN + US cutout have factoryCode = null):
//   brisket_cn, shin_cn, sirloin_cn, fatty_brisket_cn, thick_flank_cn,
//   oyster_blade_cn, ribeye_cn, tenderloin_cn, beef_tripe_cn, beef_tendon_cn,
//   boxed_beef_choice, beef_cutout_us
// ----------------------------------------------------------------------------

export interface BridgeResult {
	copied: number;
	skipped: number;
}

/**
 * Copy the latest daily CommodityPrice.close for each mapped beef slug into
 * BeefCutPrice. Idempotent (upsert). Returns counts for logging.
 */
export async function bridgeBeefPrices(): Promise<BridgeResult> {
	let copied = 0;
	let skipped = 0;

	for (const [slug, cutCode] of Object.entries(SLUG_TO_CUTCODE)) {
		try {
			const commodity = await prisma.commodity.findUnique({
				where: { slug },
				select: { id: true, grade: true, originCountry: true, factoryCode: true },
			});
			if (!commodity || !commodity.factoryCode || !commodity.originCountry) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: missing commodity/factory/origin — skipped`);
				skipped++;
				continue;
			}

			const iso2 = ISO3_TO_ISO2[commodity.originCountry];
			if (!iso2) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: unknown origin ${commodity.originCountry} — skipped`);
				skipped++;
				continue;
			}

			// Factory.code is `<ISO2>-<factoryCode>`. The ISO2 prefix is what
			// disambiguates the `379` collision (BR-SIF379 vs UY-379); a bare
			// endsWith(factoryCode) would join to the wrong country.
			const factoryCode = `${iso2}-${commodity.factoryCode}`;
			const factory = await prisma.factory.findUnique({
				where: { code: factoryCode },
				select: { id: true },
			});
			if (!factory) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: no Factory for ${factoryCode} — skipped`);
				skipped++;
				continue;
			}

			// Latest daily close for this commodity.
			const latest = await prisma.commodityPrice.findFirst({
				where: { commodityId: commodity.id, interval: "daily" },
				orderBy: { date: "desc" },
				take: 1,
				select: { close: true, date: true, source: true },
			});
			if (!latest || latest.close == null) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: no daily CommodityPrice — skipped`);
				skipped++;
				continue;
			}

			const source = `bridge:commodity:${slug}`;
			await prisma.beefCutPrice.upsert({
				where: {
					factoryId_cutCode_date_source: {
						factoryId: factory.id,
						cutCode,
						date: latest.date,
						source,
					},
				},
				create: {
					factoryId: factory.id,
					cutCode,
					price: latest.close.toNumber(),
					currency: "USD",
					unit: "USD/kg",
					source,
					sourceRef: slug,
					date: latest.date,
					grade: commodity.grade ?? null,
				},
				update: {
					price: latest.close.toNumber(),
					grade: commodity.grade ?? null,
				},
			});
			copied++;
		} catch (err) {
			// One slug failing must not abort the rest.
			logger.warn(`[BEEF-BRIDGE] ${slug}: error — skipped (${err})`);
			skipped++;
		}
	}

	return { copied, skipped };
}
