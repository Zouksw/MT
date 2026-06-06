import { logger } from "@/lib";

export interface ScraperResult {
	inserted: number;
	updated: number;
}

export interface Scraper {
	name: string;
	fetch(): Promise<ScraperResult>;
	/** If set, skip this source when the env var is empty */
	requiresKey?: string;
}

interface SourceHealth {
	lastRun: Date | null;
	success: boolean;
	error: string | null;
	lastResult?: ScraperResult;
	skippedNoKey?: boolean;
}

export class ScraperManager {
	private sources = new Map<string, Scraper>();
	private health = new Map<string, SourceHealth>();

	registerSource(name: string, scraper: Scraper): void {
		this.sources.set(name, scraper);
		this.health.set(name, { lastRun: null, success: false, error: null });
		logger.info(`[ScraperManager] Registered source: ${name}`);
	}

	async runAll(): Promise<Record<string, ScraperResult | { error: string }>> {
		const entries = Array.from(this.sources.entries());
		const results = await Promise.allSettled(
			entries.map(async ([name, _scraper]) => {
				const result = await this.runSource(name);
				return { name, result };
			}),
		);

		const summary: Record<string, ScraperResult | { error: string }> = {};
		for (const r of results) {
			if (r.status === "fulfilled") {
				summary[r.value.name] = r.value.result;
			}
		}

		const succeeded = results.filter((r) => r.status === "fulfilled").length;
		const failed = results.filter((r) => r.status === "rejected").length;
		logger.info(`[ScraperManager] runAll complete: ${succeeded} succeeded, ${failed} failed`);

		return summary;
	}

	async runSource(name: string): Promise<ScraperResult> {
		const scraper = this.sources.get(name);
		if (!scraper) {
			throw new Error(`Unknown source: ${name}`);
		}

		// Check if source requires an API key that isn't configured
		if (scraper.requiresKey && !process.env[scraper.requiresKey]) {
			this.health.set(name, {
				lastRun: null,
				success: false,
				error: `Missing ${scraper.requiresKey}`,
				skippedNoKey: true,
			});
			logger.debug(`[ScraperManager] ${name} skipped — ${scraper.requiresKey} not configured`);
			return { inserted: 0, updated: 0 };
		}

		const start = Date.now();
		try {
			const result = await scraper.fetch();
			const elapsed = Date.now() - start;

			this.health.set(name, {
				lastRun: new Date(),
				success: true,
				error: null,
				lastResult: result,
			});

			logger.info(
				`[ScraperManager] ${name} completed in ${elapsed}ms: ${result.inserted} inserted, ${result.updated} updated`,
			);
			return result;
		} catch (err) {
			const elapsed = Date.now() - start;
			const msg = err instanceof Error ? err.message : String(err);

			this.health.set(name, {
				lastRun: new Date(),
				success: false,
				error: msg,
			});

			logger.error(`[ScraperManager] ${name} failed in ${elapsed}ms: ${msg}`);
			throw err;
		}
	}

	getHealth(): Record<string, SourceHealth> {
		const result: Record<string, SourceHealth> = {};
		for (const [name, health] of this.health.entries()) {
			result[name] = { ...health };
		}
		return result;
	}
}

export const scraperManager = new ScraperManager();
