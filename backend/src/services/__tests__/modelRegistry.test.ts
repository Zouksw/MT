import { beforeEach, describe, expect, it } from "vitest";
import {
	ALL_MODELS,
	BASELINE_MODELS,
	getValidModels,
	isValidModel,
	resetModelRegistryForTests,
	syncModelsFromRemote,
} from "../modelRegistry";

const SEED = [
	"chronos_tiny",
	"chronos_mini",
	"chronos_base",
	"arima",
	"sarimax",
	"holtwinters",
	"exponential_smoothing",
	"naive_forecaster",
	"stl_forecaster",
];

describe("modelRegistry runtime sync (round-115)", () => {
	beforeEach(() => {
		resetModelRegistryForTests();
	});

	it("seeds the acceptance list with the 9 inference MODEL_IDS", () => {
		expect(getValidModels()).toEqual(SEED);
	});

	it("adopts new upstream ids and reports them as added", () => {
		const r = syncModelsFromRemote([...SEED, "new_model"]);
		expect(r.added).toEqual(["new_model"]);
		expect(r.removed).toEqual([]);
		expect(isValidModel("new_model")).toBe(true);
		expect(getValidModels()).toContain("new_model");
	});

	it("drops ids removed upstream and reports them as removed", () => {
		const r = syncModelsFromRemote(SEED.filter((id) => id !== "stl_forecaster"));
		expect(r.removed).toEqual(["stl_forecaster"]);
		expect(isValidModel("stl_forecaster")).toBe(false);
	});

	it("flags curated ensemble/baseline ids missing upstream", () => {
		const r = syncModelsFromRemote(SEED.filter((id) => id !== "chronos_base"));
		expect(r.curatedMissing).toEqual(["chronos_base"]);
		// A curated id missing upstream must NOT drop it from the curated
		// constants themselves — those are semantic tiers, not sync state.
		expect(ALL_MODELS).toContain("chronos_base");
	});

	it("dedupes and sorts remote input so diffs are stable", () => {
		const r = syncModelsFromRemote(["chronos_tiny", "arima", "arima"]);
		expect(r.valid).toEqual(["arima", "chronos_tiny"]);
		expect(r.added).toEqual([]);
	});

	it("curated tiers stay subsets of the seed (no silent tier drift)", () => {
		const seed = new Set(SEED);
		for (const id of [...ALL_MODELS, ...BASELINE_MODELS]) {
			expect(seed.has(id)).toBe(true);
		}
	});
});
