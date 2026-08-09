import { render } from "@testing-library/react";
import type { CutForecastSummary } from "@/hooks/useBeefCutForecasts";
import CutForecastCell from "../CutForecastCell";

// REGRESSION (round-86): iconConfig[forecast.direction] destructured without
// a guard — a malformed backend payload (null/uppercase/empty direction)
// threw TypeError and crashed the whole beef price table. The cell now falls
// back to the "flat" style for any unknown direction, mirroring the defensive
// lookup in PriceForecastPanel.tsx:197.

const baseForecast: CutForecastSummary = {
	direction: "up",
	predictedChange: 2.5,
	confidence: 0.8,
	predictedPrice: 10.5,
	modelsAgree: 3,
	availableModels: 3,
	dataPoints: 30,
	horizon: 7,
};

describe("CutForecastCell", () => {
	it("renders nothing when forecast is absent (honest absence)", () => {
		const { container } = render(<CutForecastCell forecast={null} />);
		// Absent forecast → the "—" placeholder span (not a crash).
		expect(container.textContent).toContain("—");
	});

	it("renders the direction icon for a valid 'up' forecast", () => {
		const { container } = render(
			<CutForecastCell forecast={{ ...baseForecast, direction: "up" }} />,
		);
		// formatSignedPercent renders the signed change.
		expect(container.textContent).toContain("+");
	});

	it("does not crash on a null/unknown direction (falls back to flat)", () => {
		// Cast through unknown to simulate a malformed API payload whose TS
		// type lies — the component must not throw at render time.
		const malformed = { ...baseForecast, direction: null } as unknown as CutForecastSummary;
		const { container } = render(<CutForecastCell forecast={malformed} />);
		// Flat fallback renders the Minus icon; the cell must still render
		// (no exception thrown).
		expect(container.firstChild).not.toBeNull();
	});

	it("does not crash on an uppercase direction (API casing drift)", () => {
		const malformed = {
			...baseForecast,
			direction: "UP",
		} as unknown as CutForecastSummary;
		const { container } = render(<CutForecastCell forecast={malformed} />);
		expect(container.firstChild).not.toBeNull();
	});
});
