export interface FieldMapping {
	date: string;
	open?: string;
	high?: string;
	low?: string;
	close: string;
	volume?: string;
	source?: string;
	metadata?: Record<string, string>;
}

export interface NormalizedPrice {
	date: Date;
	open?: number;
	high?: number;
	low?: number;
	close: number;
	volume?: number;
	source: string;
	metadata?: Record<string, unknown>;
}

const DATE_PATTERNS = [
	"date",
	"time",
	"timestamp",
	"datetime",
	"trade_date",
	"trading_date",
	"day",
	"period",
];
const OPEN_PATTERNS = ["open", "open_price", "opening", "openprice", "first"];
const HIGH_PATTERNS = ["high", "high_price", "highest", "highprice", "max"];
const LOW_PATTERNS = ["low", "low_price", "lowest", "lowprice", "min"];
const CLOSE_PATTERNS = [
	"close",
	"close_price",
	"closing",
	"closeprice",
	"last",
	"settle",
	"settlement",
	"price",
	"value",
	"end_price",
];
const VOLUME_PATTERNS = [
	"volume",
	"vol",
	"qty",
	"quantity",
	"amount",
	"turnover",
	"trade_volume",
];

function matchHeader(
	headers: string[],
	patterns: string[],
): string | undefined {
	const normalized = headers.map((h) =>
		h
			.toLowerCase()
			.replace(/[\s_-]+/g, "_")
			.trim(),
	);
	for (const pattern of patterns) {
		const idx = normalized.indexOf(pattern);
		if (idx !== -1) return headers[idx];
	}
	for (const pattern of patterns) {
		const idx = normalized.findIndex((h) => h.includes(pattern));
		if (idx !== -1) return headers[idx];
	}
	return undefined;
}

export function detectFieldMapping(headers: string[]): FieldMapping {
	const date = matchHeader(headers, DATE_PATTERNS);
	if (!date) {
		throw new Error(`No date column found in headers: ${headers.join(", ")}`);
	}

	const close = matchHeader(headers, CLOSE_PATTERNS);
	if (!close) {
		throw new Error(
			`No close/price column found in headers: ${headers.join(", ")}`,
		);
	}

	const mapped = new Set([date, close]);
	const open = matchHeader(headers, OPEN_PATTERNS);
	if (open) mapped.add(open);
	const high = matchHeader(headers, HIGH_PATTERNS);
	if (high) mapped.add(high);
	const low = matchHeader(headers, LOW_PATTERNS);
	if (low) mapped.add(low);
	const volume = matchHeader(headers, VOLUME_PATTERNS);
	if (volume) mapped.add(volume);

	const metadata: Record<string, string> = {};
	for (const header of headers) {
		if (!mapped.has(header)) {
			const key = header.toLowerCase().replace(/[\s_-]+/g, "_");
			metadata[key] = header;
		}
	}

	return {
		date,
		open,
		high,
		low,
		close,
		volume,
		metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
	};
}

function parseDate(value: unknown): Date {
	if (value instanceof Date) return value;
	if (typeof value === "number") return new Date(value);
	if (typeof value === "string") {
		const d = new Date(value);
		if (!Number.isNaN(d.getTime())) return d;
		const parts = value.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
		if (parts) return new Date(+parts[1], +parts[2] - 1, +parts[3]);
	}
	throw new Error(`Cannot parse date from value: ${value}`);
}

function parseNumber(value: unknown): number | undefined {
	if (value == null || value === "") return undefined;
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const cleaned = value.replace(/[,¥$€]/g, "");
		const n = Number(cleaned);
		return Number.isNaN(n) ? undefined : n;
	}
	return undefined;
}

export function normalizePriceEntry(
	raw: Record<string, unknown>,
	mapping: FieldMapping,
): NormalizedPrice {
	const date = parseDate(raw[mapping.date]);
	const close = parseNumber(raw[mapping.close]);
	if (close == null) {
		throw new Error(
			`Missing close price in row: ${JSON.stringify(raw).slice(0, 200)}`,
		);
	}

	const metadata: Record<string, unknown> = {};
	if (mapping.metadata) {
		for (const [key, header] of Object.entries(mapping.metadata)) {
			if (raw[header] != null && raw[header] !== "") {
				metadata[key] = raw[header];
			}
		}
	}

	return {
		date,
		open: mapping.open ? parseNumber(raw[mapping.open]) : undefined,
		high: mapping.high ? parseNumber(raw[mapping.high]) : undefined,
		low: mapping.low ? parseNumber(raw[mapping.low]) : undefined,
		close,
		volume: mapping.volume ? parseNumber(raw[mapping.volume]) : undefined,
		source: (mapping.source && raw[mapping.source]
			? String(raw[mapping.source])
			: "manual") as string,
		metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
	};
}
