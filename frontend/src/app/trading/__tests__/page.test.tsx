/**
 * Trading page — honesty regression tests (round-85/89).
 *
 * Round-85 removed fabricated support/resistance levels (currentPrice *
 * 0.97/1.03/1.04) and a fake predictedPrice when the AI signal was null.
 * The page now renders an honest "AI signal unavailable" message instead
 * of a PriceForecastPanel with fabricated levels.
 *
 * This test mocks useTradingData to return signal:null (no AI signal
 * available) and asserts the page renders the honest fallback — NOT a
 * PriceForecastPanel with fabricated numbers.
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type React from "react";

// Mock the data hook with a controllable return value; the initial-slug
// argument is captured so the deep-link test can assert the pass-through.
let mockTradingData: Record<string, unknown>;
let lastInitialSlug: string | undefined;

jest.mock("@/hooks/useTradingData", () => ({
	useTradingData: (initialSlug?: string) => {
		lastInitialSlug = initialSlug;
		return mockTradingData;
	},
}));

// Mock chart components that pull in lightweight-charts (heavy native dep).
jest.mock("@/components/trading/MultiSourceChart", () => () => null);
jest.mock("@/components/trading/ProfessionalChart", () => () => null);
jest.mock("@/components/trading/MarketFactorsPanel", () => () => null);
jest.mock("@/components/trading/ModelConsensusTable", () => () => null);
jest.mock("@/components/trading/AnomalyAlertBanner", () => () => null);
jest.mock("@/components/trading/DataSourcePanel", () => () => null);

// Mock recharts (chart components need it).
jest.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	ComposedChart: () => null,
	Line: () => null,
	Bar: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
	ReferenceLine: () => null,
}));

// Mock next/navigation. mockSearch is read lazily so the deep-link test can
// retarget the query string per test.
let mockSearch = "";
jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams(mockSearch),
	useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
	usePathname: () => "/trading",
}));

import TradingPage from "../page";

describe("Trading page — signal=null honesty (round-85)", () => {
	beforeEach(() => {
		mockSearch = "";
		mockTradingData = {
			signalLoading: false,
			signal: null, // no AI signal — the round-85 fix scenario
			loading: false,
			error: null,
			currentPrice: 5.0,
			commodity: { slug: "brl_usd", name: "BRL/USD", category: "fx", unit: "USD" },
			selectedCommodity: "brl_usd",
			commodities: [],
			commoditiesLoading: false,
			prices: [],
			chartData: [],
			chartType: "professional",
			multiSources: {},
			indicators: {},
			factors: [],
			factorsLoading: false,
			factorSources: [],
			predictionHistory: [],
			predictionOverlays: {},
			anomalies: [],
			bestModelId: null,
			previousDirection: null,
			beefMode: false,
			beefPrices: [],
			beefCuts: [],
			beefFactories: [],
			beefFactoryFilter: "",
			beefChartData: [],
			beefMultiSources: {},
			beefCutInfo: null,
		};
	});

	it("renders 'AI signal unavailable' when signal is null", () => {
		render(<TradingPage />);

		// The honest fallback must be visible — NOT a PriceForecastPanel
		// with fabricated support/resistance levels.
		expect(screen.getByText(/AI signal unavailable/i)).toBeInTheDocument();
	});

	it("does NOT render PriceForecastPanel when signal is null", () => {
		render(<TradingPage />);

		// PriceForecastPanel renders specific forecast detail labels. With
		// signal:null it must NOT appear (round-85 removed the fabricated-
		// levels render that used currentPrice * 0.97/1.03/1.04).
		expect(screen.queryByText(/Predicted Price/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Support Level/i)).not.toBeInTheDocument();
	});
});

describe("Trading page — ?slug= deep link (round-147)", () => {
	beforeEach(() => {
		mockSearch = "";
		mockTradingData = {
			signalLoading: false,
			signal: null,
			loading: false,
			error: null,
			currentPrice: 5.0,
			selectedSlug: "",
			setSelectedSlug: jest.fn(),
			commodities: [],
			commoditiesLoading: false,
			prices: [],
			chartData: [],
			chartType: "professional",
			multiSources: {},
			indicators: {},
			factors: [],
			factorsLoading: false,
			factorSources: [],
			predictionHistory: [],
			predictionOverlays: {},
			anomalies: [],
			bestModelId: null,
			previousDirection: null,
			beefMode: false,
			setBeefMode: jest.fn(),
			setSelectedCut: jest.fn(),
			setBeefFactoryFilter: jest.fn(),
			beefPrices: [],
			beefCuts: [],
			beefFactories: [],
			beefFactoryFilter: "",
			beefChartData: [],
			beefMultiSources: {},
			beefCutInfo: null,
		};
	});

	it("passes ?slug= to the hook as the initial selection", () => {
		mockSearch = "slug=feeder_cattle";
		render(<TradingPage />);

		expect(lastInitialSlug).toBe("feeder_cattle");
	});

	it("syncs same-route slug changes to the selection (page does not remount on /trading -> /trading?slug=)", () => {
		mockSearch = "slug=feeder_cattle";
		render(<TradingPage />);

		// The sync effect must drive setSelectedSlug on URL slug arrival —
		// the hook's initial value alone would miss same-route navigation.
		expect(mockTradingData.setSelectedSlug).toHaveBeenCalledWith("feeder_cattle");
	});

	it("no slug param: neither initial value nor selection sync fires", () => {
		render(<TradingPage />);

		expect(lastInitialSlug).toBeUndefined();
		expect(mockTradingData.setSelectedSlug).not.toHaveBeenCalled();
	});
});

describe("Trading page — timeframe selector cadence honesty (round-149)", () => {
	// A weekly-only series (beef_90cl_us) has no meaningful daily/monthly
	// timeframe: the backend serves the series' real cadence regardless
	// (getPriceHistory fallback), so the selector must hide for any
	// non-daily cadence — the round-129 monthly logic extended to weekly.
	const baseData = {
		signalLoading: false,
		signal: null,
		loading: false,
		error: null,
		currentPrice: 348,
		selectedSlug: "beef_90cl_us",
		setSelectedSlug: jest.fn(),
		commodities: [],
		commoditiesLoading: false,
		prices: [],
		chartData: [],
		chartType: "professional",
		multiSources: {},
		indicators: {},
		factors: [],
		factorsLoading: false,
		factorSources: [],
		priceSources: [],
		predictionHistory: [],
		predictionOverlays: {},
		anomalies: [],
		bestModelId: null,
		previousDirection: null,
		beefMode: false,
		setBeefMode: jest.fn(),
		setSelectedCut: jest.fn(),
		setBeefFactoryFilter: jest.fn(),
		beefPrices: [],
		beefCuts: [],
		beefFactories: [],
		beefFactoryFilter: "",
		beefChartData: [],
		beefMultiSources: {},
		beefCutInfo: null,
	};

	it("hides the timeframe selector for a weekly-only series", () => {
		mockSearch = "";
		mockTradingData = {
			...baseData,
			selected: { slug: "beef_90cl_us", name: "US Imported 90CL Beef", interval: "weekly" },
		};
		render(<TradingPage />);

		expect(screen.queryByLabelText("Timeframe selector")).not.toBeInTheDocument();
	});

	it("hides the timeframe selector for a monthly-only series (round-129 behavior kept)", () => {
		mockSearch = "";
		mockTradingData = {
			...baseData,
			selected: { slug: "beef_carcass_us", name: "Beef Carcass", interval: "monthly" },
		};
		render(<TradingPage />);

		expect(screen.queryByLabelText("Timeframe selector")).not.toBeInTheDocument();
	});

	it("shows the timeframe selector for a daily series", () => {
		mockSearch = "";
		mockTradingData = {
			...baseData,
			selected: { slug: "live_cattle_cme", name: "Live Cattle", interval: "daily" },
		};
		render(<TradingPage />);

		expect(screen.getByLabelText("Timeframe selector")).toBeInTheDocument();
	});
});
