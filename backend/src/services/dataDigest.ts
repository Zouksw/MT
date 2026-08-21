/**
 * Ops data digest (round-115, assessment candidate 3).
 *
 * dataHealth makes the data layer's state VISIBLE (/health/ready, freshness
 * board) but nobody is told — the steady state is "17 of 19 scrapers
 * dormant" and the interesting events (a fresh source going silent, every
 * source stopping, scrapers erroring) are only discoverable by a human
 * opening the page. This module turns that passive visibility into a push
 * signal: one email per day at most, and only when something is actionable:
 *
 *   - no source wrote any row in the last 24h (data layer dead while infra
 *     may be all-green), or
 *   - ingestion runs errored in the last 24h.
 *
 * A "everything is fine" state sends nothing (log line only). No-op unless
 * OPS_ALERT_EMAIL + SMTP are configured.
 */

import { logger, prisma } from "@/lib";
import { type DataHealthSnapshot, getDataHealth } from "@/services/dataHealth";
import { sendOpsEmail } from "@/services/notificationChannels";

export type DigestOutcome = "sent" | "skipped_healthy" | "skipped_unconfigured" | "failed";

export interface IngestionErrorSummary {
	source: string;
	runs: number;
	lastMessage: string | null;
}

export interface DigestDecision {
	send: boolean;
	reason: string;
}

/** Pure gate — unit-tested without any DB. */
export function shouldSendDigest(s: DataHealthSnapshot, errorRuns24h: number): DigestDecision {
	if (!s.anyDataFlowing) {
		return {
			send: true,
			reason:
				"no source wrote any row in the last 24h — data layer stopped while infra may be green",
		};
	}
	if (errorRuns24h > 0) {
		return { send: true, reason: `${errorRuns24h} ingestion error run(s) in the last 24h` };
	}
	return {
		send: false,
		reason: `healthy: ${s.freshSourceCount}/${s.registeredSourceCount} sources fresh, no ingestion errors`,
	};
}

/** Pure formatter — unit-tested without any DB. */
export function buildDigestText(
	s: DataHealthSnapshot,
	errors: IngestionErrorSummary[],
	decision: DigestDecision,
): string {
	const lines: string[] = [];
	lines.push(`MT data digest — ${s.asOf.toISOString()}`);
	lines.push(`Trigger: ${decision.reason}`);
	lines.push("");
	lines.push(
		`Fresh sources (24h): ${s.freshSourceCount}/${s.registeredSourceCount} writing ` +
			`(${
				s.sources
					.filter((src) => src.commodityPriceRows + src.beefCutPriceRows > 0)
					.map((src) => src.source)
					.join(", ") || "none"
			})`,
	);
	lines.push(
		`Verification: ${s.predictionVerified} verified / ${s.predictionBacklog} backlog ` +
			`(ratio ${(s.verificationRatio * 100).toFixed(1)}%, ${s.predictionUnverifiable} unverifiable frozen)`,
	);
	if (errors.length > 0) {
		lines.push("");
		lines.push("Ingestion errors (24h):");
		for (const e of errors) {
			lines.push(`  - ${e.source}: ${e.runs} run(s), last: ${e.lastMessage ?? "unknown"}`);
		}
	}
	lines.push("");
	lines.push("Detail: GET /api/health/ready (dataFresh) and /api/market/sources/freshness");
	return lines.join("\n");
}

export async function runDataDigest(): Promise<DigestOutcome> {
	const recipient = process.env.OPS_ALERT_EMAIL;
	if (!recipient) {
		logger.info("[data-digest] OPS_ALERT_EMAIL not set — ops digest disabled (no-op)");
		return "skipped_unconfigured";
	}

	try {
		const since = new Date(Date.now() - 24 * 3600_000);
		const [snapshot, errorRows] = await Promise.all([
			getDataHealth(1),
			prisma.$queryRaw<Array<{ source: string; runs: bigint; last_message: string | null }>>`
				SELECT source, COUNT(*) AS runs, MAX(error_message) AS last_message
				FROM ingestion_logs
				WHERE status = 'error' AND created_at >= ${since}
				GROUP BY source
				ORDER BY runs DESC`,
		]);
		const errors: IngestionErrorSummary[] = errorRows.map((r) => ({
			source: r.source,
			runs: Number(r.runs),
			lastMessage: r.last_message,
		}));
		const errorRuns = errors.reduce((sum, e) => sum + e.runs, 0);

		const decision = shouldSendDigest(snapshot, errorRuns);
		if (!decision.send) {
			logger.info(`[data-digest] skipped (${decision.reason})`);
			return "skipped_healthy";
		}

		const subject = `[MT] data digest: ${decision.reason}`;
		const ok = await sendOpsEmail(subject, buildDigestText(snapshot, errors, decision));
		if (!ok) {
			logger.warn("[data-digest] SMTP send failed or transport unconfigured");
			return "failed";
		}
		return "sent";
	} catch (err) {
		logger.warn(
			`[data-digest] failed: ${err instanceof Error ? err.message : String(err)} (next attempt in 24h)`,
		);
		return "failed";
	}
}
