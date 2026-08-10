import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import PriceForecastPanel from "../PriceForecastPanel";

// REGRESSION (round-97): range was a required prop typed as
// `{ lower: number; upper: number }` but the parent (trading page) passed
// `d.signal.range` from an `any`-typed signal. If the backend omits `range`
// (a partial forecast, cache deserialization, or future refactor), the
// `range.lower` access at render time crashed — the identical unguarded-
// access pattern that bit CutForecastCell (round-86) and BeefFreshnessBadge
// (round-92). The fix makes `range` optional and uses `range?.lower` (→
// formatPrice(null) → "--").

const baseProps = {
	consensusDirection: "up" as const,
	confidence: 0.8,
	modelsAgree: 3,
	totalModels: 3,
	// At least one available forecast so the component renders the full panel
	// (not the "暂无预测数据" empty state).
	individualForecasts: [
		{
			modelId: "chronos_tiny",
			direction: "up" as const,
			predictedChange: 2.5,
			currentPrice: 10.0,
			predictedPrice: 10.25,
			confidence: 0.8,
			status: "available" as const,
		},
	],
	predictedChange: 2.5,
	currentPrice: 10.0,
	predictedPrice: 10.25,
	horizon: 7,
	supportLevel: 9.5,
	resistanceLevel: 11.0,
	distribution: { up: 3, down: 0, flat: 0 },
	bestModelId: "chronos_tiny",
	loading: false,
	timestamp: new Date().toISOString(),
};

describe("PriceForecastPanel — range guard (round-97)", () => {
	it("renders normally when range is provided", () => {
		const { container } = render(
			<PriceForecastPanel {...baseProps} range={{ lower: 9.8, upper: 10.7 }} />,
		);
		expect(container.textContent).toContain("9.8");
		expect(container.textContent).toContain("10.7");
	});

	it("does not crash when range is undefined (renders '--' for the bounds)", () => {
		// Cast through unknown to simulate the `any`-typed signal path where the
		// backend omits `range` entirely.
		const { container } = render(<PriceForecastPanel {...baseProps} range={undefined} />);
		// Must render (no throw), and the range bounds show "--" (formatPrice null).
		expect(container.firstChild).not.toBeNull();
		expect(container.textContent).toContain("--");
	});

	it("does not crash when range is undefined and supportLevel/resistanceLevel are also undefined", () => {
		// Worst case: signal shape omits range + levels (all three were unguarded).
		// Cast through unknown to simulate the `any`-typed signal path.
		const props = {
			...baseProps,
			range: undefined,
			supportLevel: undefined,
			resistanceLevel: undefined,
		} as unknown as React.ComponentProps<typeof PriceForecastPanel>;
		const { container } = render(<PriceForecastPanel {...props} />);
		expect(container.firstChild).not.toBeNull();
	});
});
