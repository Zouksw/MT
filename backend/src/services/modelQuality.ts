/**
 * Model quality weights — quality-weighted consensus (PRODUCT-SPEC §3.3).
 *
 * The consensus previously weighted every model equally: a model with 32% MAPE
 * had the same vote as one with 10% MAPE. This module resolves a per-model
 * quality weight from historical MAPE so the consensus direction vote and the
 * blended confidence can account for which models are actually accurate.
 *
 * Weight scheme: w = 1 / max(mape, floor), then normalized to sum=1 across the
 * voting models. Models with no verified history (new, or all failed) get the
 * median weight of the known models — neutral, not zero (zero would silently
 * exclude them; a new model deserves a fair trial).
 *
 * The floor (default 2%) prevents a near-perfect MAPE (e.g. 0.5%) from
 * dominating with a 200x weight — quality is rewarded, not monopolized.
 *
 * Elimination bar (round-110, PREDICTION-STRATEGY §3.3/3.4): a model with
 * sufficient same-window verified evidence that is strictly WORSE than
 * naive_forecaster gets weight 0 — out of the direction vote and the median
 * entirely, not merely down-weighted. naive is the bar any real model must
 * beat; a model losing to it adds noise, not information. Guarded by
 * MIN_VERIFIED_TO_ELIMINATE on BOTH the model and naive so elimination never
 * fires on thin evidence. If every requested model is eliminated, the
 * existing equal-weight fallback applies (documented edge, not a signal).
 */

import { logger } from "@/lib";
import { getAllModelAccuracy } from "./mapeTracking";

/** MAPE floor — a model can't weigh more than 1/floor = 50x the worst. */
const MAPE_FLOOR_PCT = 2;

/**
 * Minimum verified rows in the window for BOTH the model and the naive bar
 * before elimination may fire. Below this, a worse-than-naive MAPE is more
 * likely noise than evidence — the model keeps its ordinary weight.
 */
const MIN_VERIFIED_TO_ELIMINATE = 20;

export interface ModelWeight {
	modelId: string;
	/** Normalized weight in [0,1], summing to 1 across the voting set. */
	weight: number;
	/** The source avg MAPE (%) if known, else null. */
	mape: number | null;
	/** True if this weight was derived from real history (vs neutral default). */
	empirical: boolean;
}

/**
 * Resolve per-model quality weights for a set of voting model IDs.
 * Fetches the 30-day avg MAPE per model and normalizes to sum=1.
 *
 * Failures (e.g. DB unreachable) degrade gracefully to equal weights — quality
 * weighting is an enhancement, not a hard dependency. The caller always gets a
 * complete weight map for every modelId passed in.
 */
export async function resolveModelWeights(
	modelIds: readonly string[],
	days = 30,
): Promise<Map<string, number>> {
	const weights = new Map<string, number>();

	if (modelIds.length === 0) return weights;

	try {
		const accuracies = await getAllModelAccuracy(undefined, days);
		const accByModel = new Map(accuracies.map((a) => [a.modelId, a]));
		const mapeByModel = new Map<string, number>();
		for (const a of accuracies) {
			if (a.avgMape != null && a.avgMape > 0) {
				mapeByModel.set(a.modelId, a.avgMape);
			}
		}

		// Default weight for models with no empirical MAPE = the median of known
		// MAPEs (neutral — neither rewarded nor penalized for being new).
		const knownMapes = Array.from(mapeByModel.values()).sort((a, b) => a - b);
		const defaultMape =
			knownMapes.length > 0 ? knownMapes[Math.floor(knownMapes.length / 2)] : MAPE_FLOOR_PCT * 4; // 8% if nothing is known at all

		// Elimination bar: naive_forecaster's verified MAPE (when the evidence
		// is thick enough to trust). A model strictly worse than this loses its
		// vote entirely; naive itself and thin-evidence models are exempt.
		const naiveBar = accByModel.get("naive_forecaster");
		const barActive =
			naiveBar?.avgMape != null && naiveBar.verifiedCount >= MIN_VERIFIED_TO_ELIMINATE;

		// Raw weight = 1 / max(mape, floor); eliminated models get 0.
		const raw: Array<{ id: string; w: number; eliminated: boolean }> = [];
		for (const id of modelIds) {
			const acc = accByModel.get(id);
			const mape = acc?.avgMape ?? defaultMape;
			const eliminated =
				barActive &&
				id !== "naive_forecaster" &&
				acc?.avgMape != null &&
				acc.verifiedCount >= MIN_VERIFIED_TO_ELIMINATE &&
				acc.avgMape > (naiveBar?.avgMape as number);
			raw.push({ id, w: eliminated ? 0 : 1 / Math.max(mape, MAPE_FLOOR_PCT), eliminated });
		}

		const eliminatedIds = raw.filter((r) => r.eliminated).map((r) => r.id);
		if (eliminatedIds.length > 0) {
			logger.info(
				`[WEIGHTS] Eliminated from consensus (worse than naive bar): ${eliminatedIds.join(", ")}`,
			);
		}

		// Normalize to sum=1.
		const total = raw.reduce((s, r) => s + r.w, 0);
		for (const r of raw) {
			weights.set(r.id, total > 0 ? r.w / total : 1 / modelIds.length);
		}
	} catch (err) {
		// Graceful degradation — equal weights. Log so the failure is observable.
		logger.warn(`[WEIGHTS] resolveModelWeights fell back to equal weights: ${err}`);
		for (const id of modelIds) {
			weights.set(id, 1 / modelIds.length);
		}
	}

	return weights;
}

/**
 * Quality-weighted median of predicted prices.
 *
 * Standard median ignores quality; weighted mean over-weights outliers. This
 * computes a weighted median (the price at which cumulative weight crosses 50%),
 * which is BOTH robust to outliers AND quality-aware. If weights are equal it
 * degenerates to the plain median — the existing consensus behavior.
 */
export function weightedMedian(predictedPrices: Array<{ price: number; weight: number }>): number {
	if (predictedPrices.length === 0) return 0;
	const sorted = [...predictedPrices].sort((a, b) => a.price - b.price);
	const totalWeight = sorted.reduce((s, p) => s + p.weight, 0);
	if (totalWeight <= 0) {
		// Equal-weight fallback (plain median).
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 !== 0
			? sorted[mid].price
			: (sorted[mid - 1].price + sorted[mid].price) / 2;
	}
	let cumulative = 0;
	for (let i = 0; i < sorted.length; i++) {
		cumulative += sorted[i].weight / totalWeight;
		if (cumulative > 0.5) return sorted[i].price;
		if (cumulative === 0.5) {
			// Exact half-point (e.g. two items at 0.5/0.5): the weighted median
			// is the midpoint of this and the next item — matching the plain
			// median for even equal-weight sets. Returning the lower item
			// biased 2-model consensus downward (round-106).
			const next = sorted[i + 1];
			return next ? (sorted[i].price + next.price) / 2 : sorted[i].price;
		}
	}
	return sorted[sorted.length - 1].price;
}

/**
 * Quality-weighted agreement ratio for a direction vote.
 *
 * Instead of counting heads (3 up / 5 = 0.6), sum the WEIGHTS of models voting
 * each direction. A direction backed by the two best models can win even if
 * outvoted 3-2 by worse models — quality over quantity.
 *
 * TIE-BREAKING: a true tie (two directions with equal weight) returns 'flat'.
 * This preserves the platform's conservative stance — an ambiguous signal is
 * reported as flat, not action-biased. A direction wins only with STRICTLY
 * more weight than every other direction.
 *
 * Returns { direction, agreementRatio } where agreementRatio is the winning
 * direction's share of total weight [0,1].
 */
export function weightedDirectionVote(
	forecasts: Array<{ direction: "up" | "down" | "flat"; weight: number }>,
): { direction: "up" | "down" | "flat"; agreementRatio: number } {
	const tally = { up: 0, down: 0, flat: 0 };
	for (const f of forecasts) {
		tally[f.direction] += f.weight;
	}
	const total = tally.up + tally.down + tally.flat;
	if (total <= 0) return { direction: "flat", agreementRatio: 0 };

	// Strict winner = strictly more weight than ALL others. Ties → flat.
	const max = Math.max(tally.up, tally.down, tally.flat);
	const winners = (["up", "down", "flat"] as const).filter((d) => tally[d] === max);
	if (winners.length > 1) {
		// Tie — conservative flat. agreementRatio = the tied weight share.
		return { direction: "flat", agreementRatio: max / total };
	}
	const direction = winners[0];
	return { direction, agreementRatio: max / total };
}
