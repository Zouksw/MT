import { render, screen } from "@testing-library/react";
import type React from "react";
import "@testing-library/jest-dom";

// Mock the data hook so the page renders against controlled fixtures. This
// isolates the rendering-layer honesty gates (MapeBadge sample-size gate,
// Primary/Baseline role tags, transition banner) from the fetch logic, which
// is covered by useAccuracyData.test.ts.
import type { useAccuracyData as realUseAccuracyData } from "@/hooks/useAccuracyData";

type UseAccuracyDataReturn = ReturnType<typeof realUseAccuracyData>;
let mockReturnValue: UseAccuracyDataReturn;
const useAccuracyDataReal = (): UseAccuracyDataReturn => mockReturnValue;
jest.mock("@/hooks/useAccuracyData", () => ({
	useAccuracyData: (..._args: unknown[]) => useAccuracyDataReal(),
}));

// Mock layout + chart deps to keep the render noise-free.
jest.mock("@/components/layout/PageContainer", () => ({
	PageContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="page-container">{children}</div>
	),
}));
jest.mock("@/components/charts/AccuracyTrendChart", () => ({
	AccuracyTrendChart: () => <div data-testid="trend-chart" />,
}));
jest.mock("@/components/charts/ModelPerformanceBarChart", () => ({
	ModelPerformanceBarChart: () => <div data-testid="perf-chart" />,
}));

import type { ModelWithBacktest } from "@/types/accuracy";
import AccuracyPage from "../page";

function makeModel(overrides: Partial<ModelWithBacktest> = {}): ModelWithBacktest {
	return {
		modelId: "arima",
		avgMape: 2.28,
		predictionCount: 100,
		verifiedCount: 100,
		displayName: "ARIMA",
		...overrides,
	};
}

describe("AccuracyPage — honesty rendering", () => {
	beforeEach(() => {
		mockReturnValue = {
			models: [],
			overallAccuracy: null,
			bestModel: null,
			totalPredictions: 0,
			totalVerified: 0,
			loading: false,
			error: null,
			retry: jest.fn(),
		};
	});

	describe("MapeBadge sample-size gate", () => {
		it("shows the MAPE value when verifiedCount >= MIN_VERIFIED_SAMPLE", () => {
			mockReturnValue.models = [
				makeModel({
					modelId: "naive_forecaster",
					displayName: "Naive",
					avgMape: 2.22,
					verifiedCount: 133,
				}),
			];
			render(<AccuracyPage />);
			// 2.22% rounded to 1 decimal — present, not gated. (The MAPE cell is
			// distinct from the Verified-count cell which shows "133".)
			expect(screen.getByText("2.2%")).toBeInTheDocument();
			// The sample-size gate's "(N verified)" sub-label must NOT appear.
			expect(screen.queryByText("(133 verified)")).not.toBeInTheDocument();
		});

		it("shows the sample-size gate when verifiedCount < MIN_VERIFIED_SAMPLE", () => {
			// chronos_tiny has a MAPE figure but only 1 verified row — showing
			// 4.63% would mislead. The gate must withhold the number and show
			// the "(N verified)" sub-label instead.
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_tiny",
					displayName: "Chronos-T5-Tiny",
					avgMape: 4.63,
					verifiedCount: 1,
					isPrimary: true,
				}),
			];
			render(<AccuracyPage />);
			// The "(1 verified)" sub-label is unique to the sample-size gate.
			expect(screen.getByText("(1 verified)")).toBeInTheDocument();
			// The raw MAPE number must NOT be rendered as if it were reliable.
			expect(screen.queryByText("4.6%")).not.toBeInTheDocument();
		});

		it("shows '--' when avgMape is null (no verified rows at all)", () => {
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_mini",
					displayName: "Chronos-T5-Mini",
					avgMape: null,
					verifiedCount: 0,
					isPrimary: true,
				}),
			];
			render(<AccuracyPage />);
			// The null-MAPE dash path ("--") is the Overall Accuracy stat card
			// value when overallAccuracy is null, plus the MAPE cell. The
			// sample-size gate sub-label "(0 verified)" must NOT appear because
			// the null check short-circuits before the sample gate.
			expect(screen.queryByText("(0 verified)")).not.toBeInTheDocument();
		});
	});

	describe("Pretrained / Statistical role tag", () => {
		it("tags chronos models as Pretrained and statistical models as Statistical", () => {
			// The baseline's verifiedCount (0) is under MIN_VERIFIED_SAMPLE, so
			// the EnsembleComparisonCard self-hides — keeping the "Statistical"
			// text unique to this table Tag (the card also has a "Statistical"
			// label which would otherwise collide with this text-content scan).
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_tiny",
					displayName: "Chronos-T5-Tiny",
					verifiedCount: 0,
					isPrimary: true,
				}),
				makeModel({
					modelId: "arima",
					displayName: "ARIMA",
					verifiedCount: 0,
					isPrimary: false,
				}),
			];
			const { container } = render(<AccuracyPage />);
			// Both tags render; one Pretrained (chronos), one Statistical (baseline).
			const pretrainedTags = Array.from(container.querySelectorAll("*")).filter(
				(el) => el.textContent === "Pretrained",
			);
			const statisticalTags = Array.from(container.querySelectorAll("*")).filter(
				(el) => el.textContent === "Statistical",
			);
			expect(pretrainedTags.length).toBe(1);
			expect(statisticalTags.length).toBe(1);
		});
	});

	describe("AccuracyTransitionBanner", () => {
		it("renders the honesty callout while a primary model is under-sampled", () => {
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_tiny",
					displayName: "Chronos-T5-Tiny",
					avgMape: 4.63,
					verifiedCount: 1,
					isPrimary: true,
				}),
				makeModel({
					modelId: "naive_forecaster",
					displayName: "Naive",
					avgMape: 2.22,
					verifiedCount: 133,
					isPrimary: false,
				}),
			];
			render(<AccuracyPage />);
			expect(screen.getByText(/Accuracy sample accumulating/i)).toBeInTheDocument();
			expect(screen.getByText(/historical MAPE from before the switch/i)).toBeInTheDocument();
		});

		it("hides the banner once all primary models have enough samples", () => {
			// Auto-cleanup: once chronos accumulates >= MIN_VERIFIED_SAMPLE, the
			// transition banner disappears on its own.
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_tiny",
					displayName: "Chronos-T5-Tiny",
					avgMape: 3.1,
					verifiedCount: 20,
					isPrimary: true,
				}),
			];
			render(<AccuracyPage />);
			expect(screen.queryByText(/Accuracy sample accumulating/i)).not.toBeInTheDocument();
		});
	});

	describe("EnsembleComparisonCard", () => {
		it("shows the pretrained advantage when both groups have enough samples", () => {
			// chronos 1.5% vs baseline 3.0% → ratio 2.0×. Both groups meet
			// MIN_VERIFIED_SAMPLE so the comparison is honest.
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_tiny",
					displayName: "Chronos-T5-Tiny",
					avgMape: 1.5,
					verifiedCount: 845,
					isPrimary: true,
				}),
				makeModel({
					modelId: "arima",
					displayName: "ARIMA",
					avgMape: 3.0,
					verifiedCount: 3287,
					isPrimary: false,
				}),
			];
			render(<AccuracyPage />);
			// Scope assertions to the card via testid — the table also renders
			// the model MAPE values and Tag labels, so unscoped getByText would
			// match multiple elements.
			const card = screen.getByTestId("ensemble-comparison");
			expect(card).toHaveTextContent("Pretrained ensemble advantage");
			expect(card).toHaveTextContent("1.5%");
			expect(card).toHaveTextContent("3.0%");
			expect(card).toHaveTextContent("2.0×");
		});

		it("hides when the primary group lacks enough verified samples", () => {
			// chronos verifiedCount=1 (under MIN_VERIFIED_SAMPLE) — the comparison
			// would pit an under-sampled placeholder against a real baseline, so
			// the card must self-hide rather than show a misleading ratio.
			mockReturnValue.models = [
				makeModel({
					modelId: "chronos_tiny",
					displayName: "Chronos-T5-Tiny",
					avgMape: 4.63,
					verifiedCount: 1,
					isPrimary: true,
				}),
				makeModel({
					modelId: "arima",
					displayName: "ARIMA",
					avgMape: 3.0,
					verifiedCount: 3287,
					isPrimary: false,
				}),
			];
			render(<AccuracyPage />);
			expect(screen.queryByTestId("ensemble-comparison")).not.toBeInTheDocument();
		});
	});
});
