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

// Mock the data hook with a controllable return value.
let mockTradingData: Record<string, unknown>;

jest.mock("@/hooks/useTradingData", () => ({
	useTradingData: () => mockTradingData,
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

// Mock next/navigation.
jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams(),
	useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
	usePathname: () => "/trading",
}));

import TradingPage from "../page";

describe("Trading page — signal=null honesty (round-85)", () => {
	beforeEach(() => {
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
