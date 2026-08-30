import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BeefBacktestSection, { BEEF_BACKTEST } from "../BeefBacktestSection";

/**
 * 批1 (round-136): the public evidence panel must render the FULL 7-model
 * pool (no cherry-picking — exponential_smoothing's sub-coin-flip direction
 * stays visible), label the snapshot with its run date + reproducible
 * source, and mark naive's direction as undecidable (flat forecast) rather
 * than silently dropping the cell.
 */

describe("BeefBacktestSection", () => {
	it("renders every consensus-pool model row from the backtest report", () => {
		render(<BeefBacktestSection />);
		for (const row of BEEF_BACKTEST.rows) {
			expect(screen.getByText(row.modelId)).toBeInTheDocument();
		}
		expect(BEEF_BACKTEST.rows).toHaveLength(7);
	});

	it("labels the evidence with run date, origin count, and source path", () => {
		render(<BeefBacktestSection />);
		expect(screen.getByText(/Beef monthly backtest/i)).toBeInTheDocument();
		expect(screen.getByText(/36 expanding-window origins/i)).toBeInTheDocument();
		expect(screen.getByText(/run 2026-08-30/i)).toBeInTheDocument();
		expect(screen.getByText(/backtest-monthly-series\.ts/i)).toBeInTheDocument();
	});

	it("marks naive's direction as flat (—), not a number", () => {
		render(<BeefBacktestSection />);
		expect(screen.getByText(/— \(flat\)/i)).toBeInTheDocument();
	});
});
