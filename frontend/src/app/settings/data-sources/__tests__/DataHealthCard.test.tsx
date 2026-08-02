/**
 * DataHealthCard — frontend rendering of the data-flow health signal (round-48).
 *
 * The card's whole purpose is to make the gap between "scrapers ran healthy"
 * (ingestion-log success) and "sources wrote real price rows" visible. These
 * tests pin the three tones and the headline metric so a regression that
 * re-hides silent data staleness fails loudly.
 */

import { render, screen } from "@testing-library/react";
import { type DataHealth, DataHealthCard } from "../DataHealthCard";

const base: DataHealth = {
	anyDataFlowing: true,
	freshSourceCount: 2,
	registeredSourceCount: 18,
	predictionBacklog: 100000,
	predictionVerified: 1000,
	predictionStale: 11000,
	verificationRatio: 0.01,
	hasVerificationDebt: true,
};

describe("DataHealthCard", () => {
	it("shows the error tone when no data is flowing", () => {
		render(
			<DataHealthCard
				dataHealth={{ ...base, anyDataFlowing: false, freshSourceCount: 0 }}
				scraperHealthy={18}
			/>,
		);
		expect(screen.getByText("No sources are writing fresh data")).toBeInTheDocument();
		// fresh source count headline shows 0 of registered.
		expect(screen.getByText("0/18")).toBeInTheDocument();
	});

	it("shows the warning tone + the gap when scrapers ran but wrote nothing", () => {
		// 18 scrapers healthy, only 2 wrote rows → gap of 16.
		render(<DataHealthCard dataHealth={base} scraperHealthy={18} />);
		// Headline mentions how many healthy scrapers wrote no rows.
		expect(screen.getByText(/16 of 18 healthy scrapers wrote no rows/)).toBeInTheDocument();
		// The "ran but wrote 0" stat shows the gap.
		expect(screen.getByText("16")).toBeInTheDocument();
		// verificationRatio 0.01 → 1%.
		expect(screen.getByText("1%")).toBeInTheDocument();
	});

	it("shows the success tone when data flows and verification is healthy", () => {
		render(
			<DataHealthCard
				dataHealth={{
					...base,
					freshSourceCount: 18,
					verificationRatio: 0.42,
					hasVerificationDebt: false,
					predictionBacklog: 1000,
					predictionVerified: 800,
				}}
				scraperHealthy={18}
			/>,
		);
		expect(screen.getByText("Data is flowing and predictions are verifying")).toBeInTheDocument();
		// No "ran but wrote 0" stat when gap is 0.
		expect(screen.queryByText("ran but wrote 0")).not.toBeInTheDocument();
		// 42% verified.
		expect(screen.getByText("42%")).toBeInTheDocument();
	});

	it("renders the prediction verification detail line", () => {
		render(<DataHealthCard dataHealth={base} scraperHealthy={18} />);
		expect(screen.getByText(/Prediction verification:/)).toBeInTheDocument();
		// verified + backlog numbers appear in the detail line.
		expect(screen.getByText("1000")).toBeInTheDocument();
		expect(screen.getByText("100000")).toBeInTheDocument();
		// stale count shown when present.
		expect(screen.getByText(/11000/)).toBeInTheDocument();
		expect(screen.getByText(/marked stale/)).toBeInTheDocument();
	});

	it("renders the unverifiable (frozen source) count when present", () => {
		render(
			<DataHealthCard
				dataHealth={{ ...base, predictionUnverifiable: 92000 }}
				scraperHealthy={18}
			/>,
		);
		// The unverifiable count + label must appear so operators see the
		// frozen-source backlog scale.
		expect(screen.getByText(/92000/)).toBeInTheDocument();
		expect(screen.getByText(/unverifiable/)).toBeInTheDocument();
	});

	it("omits the prediction detail line when no predictions exist", () => {
		render(
			<DataHealthCard
				dataHealth={{
					...base,
					predictionBacklog: 0,
					predictionVerified: 0,
					predictionStale: 0,
				}}
				scraperHealthy={2}
			/>,
		);
		expect(screen.queryByText(/Prediction verification:/)).not.toBeInTheDocument();
	});
});
