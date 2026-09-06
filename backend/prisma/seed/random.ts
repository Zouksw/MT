/** Extracted from prisma/seed.ts (round-156 批3a) — data-only move, logic unchanged. */
export function rand(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

/** Generate a random integer between min and max (inclusive) */
export function randInt(min: number, max: number): number {
	return Math.floor(rand(min, max + 1));
}

/** Pick a random element from an array */
export function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a sine wave with noise - simulates realistic sensor data */
export function sineWave(
	index: number,
	baseValue: number,
	amplitude: number,
	period: number,
	noiseAmplitude: number,
): number {
	const signal = Math.sin((2 * Math.PI * index) / period) * amplitude;
	const noise = (Math.random() - 0.5) * 2 * noiseAmplitude;
	return parseFloat((baseValue + signal + noise).toFixed(4));
}

/** Add an occasional anomaly spike */
export function withSpike(value: number, _index: number, spikeChance: number = 0.02): number {
	if (Math.random() < spikeChance) {
		return parseFloat((value * (1 + (Math.random() > 0.5 ? 1 : -1) * rand(0.3, 0.8))).toFixed(4));
	}
	return value;
}

/** Generate a slug from a name */
export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

// ============================================================================
// Seed Data Definitions
// ============================================================================
