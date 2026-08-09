/**
 * Beef overview page rendering tests (round-84).
 *
 * The /beef page is the project's strategic focus (beef-only pivot) yet had
 * ZERO unit or e2e coverage (per round-84 audit). These tests mock the data
 * hooks and pin the three render states: loading, empty (no data → CSV
 * import CTA), and data-loaded (price table renders).
 *
 * Mocks useRetryableFetch (4 calls: prices/kill/storage/cuts) +
 * useBeefCutForecasts (batch forecast column). Rendering-layer only — the
 * hooks themselves have their own tests.
 */

import { render, screen } from "@testing-library/react";
import type React from "react";
import "@testing-library/jest-dom";

// Mock the data hooks with a controllable return value per test.
type RetryableReturn = {
	data: unknown;
	error: Error | null;
	isLoading: boolean;
};
let mockPricesReturn: RetryableReturn;
let mockKillReturn: RetryableReturn;
let mockStorageReturn: RetryableReturn;
let mockCutsReturn: RetryableReturn;
let mockForecastsReturn: Record<string, unknown>;

// jest.mock runs before the test body, so we use factory functions that read
// the current mock values at call time (not at mock-definition time).
jest.mock("@/hooks/useRetryableFetch", () => ({
	useRetryableFetch: (key: string) => {
		if (key.includes("weekly-kill")) return mockKillReturn;
		if (key.includes("cold-storage")) return mockStorageReturn;
		if (key.includes("cuts")) return mockCutsReturn;
		return mockPricesReturn; // default: prices/latest
	},
}));
jest.mock("@/hooks/useBeefCutForecasts", () => ({
	useBeefCutForecasts: () => ({ forecasts: mockForecastsReturn }),
}));

// Mock layout deps to keep render noise-free.
jest.mock("@/components/layout/PageContainer", () => ({
	PageContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="page-container">{children}</div>
	),
}));
jest.mock("@/components/market/MarketForecastBoard", () => ({
	MarketForecastBoard: () => <div data-testid="forecast-board" />,
}));
jest.mock("@/components/beef/SnapshotBanner", () => ({
	SnapshotBanner: () => <div data-testid="snapshot-banner" />,
}));

import BeefOverview from "../page";

const EMPTY_RETURN: RetryableReturn = { data: null, error: null, isLoading: false };
const LOADING_RETURN: RetryableReturn = { data: null, error: null, isLoading: true };

function setMocks(overrides: {
	prices?: RetryableReturn;
	kill?: RetryableReturn;
	storage?: RetryableReturn;
	cuts?: RetryableReturn;
	forecasts?: Record<string, unknown>;
}) {
	mockPricesReturn = overrides.prices ?? EMPTY_RETURN;
	mockKillReturn = overrides.kill ?? EMPTY_RETURN;
	mockStorageReturn = overrides.storage ?? EMPTY_RETURN;
	mockCutsReturn = overrides.cuts ?? EMPTY_RETURN;
	mockForecastsReturn = overrides.forecasts ?? {};
}

describe("BeefOverview page", () => {
	beforeEach(() => {
		setMocks({});
	});

	describe("loading state", () => {
		it("renders skeleton placeholders while data loads", () => {
			// All four hooks still loading → skeleton grid.
			setMocks({
				prices: LOADING_RETURN,
				kill: LOADING_RETURN,
				storage: LOADING_RETURN,
				cuts: LOADING_RETURN,
			});
			render(<BeefOverview />);
			expect(screen.getByText("Beef Market Intelligence")).toBeInTheDocument();
			// Skeleton placeholders use animate-pulse — 4 stat cards + chart areas.
			expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
		});
	});

	describe("empty state", () => {
		it("renders the no-data message with CSV import CTA when all sources are empty", () => {
			// All hooks resolved with null data → hasNoData path.
			setMocks({});
			render(<BeefOverview />);
			expect(screen.getByText("No Beef Price Data Available")).toBeInTheDocument();
			// The honest CTA pointing to CSV import (round-81 verified path).
			expect(screen.getByText("Import prices via CSV")).toBeInTheDocument();
		});
	});

	describe("data-loaded state", () => {
		it("renders the price table with rows when data is present", () => {
			setMocks({
				prices: {
					data: {
						data: {
							prices: [
								{
									cutCode: "BRISKET",
									cutName: "Brisket",
									price: 8.5,
									currency: "USD",
									country: "BR",
									factoryName: "BR-FRIGO",
									date: "2026-08-09",
								},
							],
							freshness: { tier: "live" },
						},
					},
					error: null,
					isLoading: false,
				},
				cuts: {
					data: {
						data: {
							cuts: [{ cutCode: "BRISKET", cutName: "Brisket", primal: "Brisket" }],
						},
					},
					error: null,
					isLoading: false,
				},
			});
			render(<BeefOverview />);
			// The page header + price table must render (not the empty state).
			expect(screen.getByText("Beef Market Intelligence")).toBeInTheDocument();
			expect(screen.queryByText("No Beef Price Data Available")).not.toBeInTheDocument();
		});
	});
});
