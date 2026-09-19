import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the consensus hook so the page renders against controlled fixtures —
// the fetch logic itself lives in useBeefMonthlyConsensus (thin apiFetch
// wrapper) and the card's honesty states are what need pinning here.
import type { useBeefMonthlyConsensus as realHook } from "@/hooks/useBeefMonthlyConsensus";

type HookReturn = ReturnType<typeof realHook>;
let mockReturn: HookReturn;
// AppShell reads AuthContext for nav prefetch (auth-aware prefetch) — page
// tests render the shell without a provider, so pin a session here.
jest.mock("@/contexts/auth", () => ({
	useAuth: jest.fn(() => ({
		status: "authenticated",
		user: { id: "u1", email: "u@x.dev", name: "Test User" },
		refresh: jest.fn(),
		logout: jest.fn(),
	})),
}));

jest.mock("@/hooks/useBeefMonthlyConsensus", () => ({
	useBeefMonthlyConsensus: () => mockReturn,
}));

// The evidence panel is covered by its own test file; stub it but mark it
// so presence (批5 acceptance: the backtest evidence renders here too) is
// assertable.
jest.mock("@/components/ai/BeefBacktestSection", () => ({
	__esModule: true,
	default: () => <div data-testid="beef-backtest-section" />,
}));

// Upstream quotes arrive via apiFetch — mock the module.
import { apiFetch } from "@/lib/apiFetch";

const apiFetchMock = apiFetch as jest.Mock;
jest.mock("@/lib/apiFetch", () => ({ apiFetch: jest.fn() }));

import BeefForecastPage from "../page";

function makeConsensus(overrides: Partial<NonNullable<HookReturn["consensus"]>> = {}) {
	return {
		direction: "down" as const,
		predictedChange: -1.24,
		currentPrice: 331.78,
		predictedPrice: 327.66,
		confidence: 0.61,
		modelsAgree: 4,
		totalModels: 7,
		availableModels: 7,
		rangeLower: 322.1,
		rangeUpper: 334.9,
		calibratedInterval: {
			lower: 322.63,
			upper: 349.7,
			level: 0.9,
			sampleSize: 36,
			source: "docs/backtests/beef-monthly-consensus-calibration-2026-09.md",
		},
		horizon: 1,
		horizonUnit: "month" as const,
		timestamp: "2026-08-30T08:00:00Z",
		...overrides,
	};
}

describe("BeefForecastPage (round-138 批5)", () => {
	beforeEach(() => {
		mockReturn = { consensus: null, loading: false, error: null, retry: jest.fn() };
		apiFetchMock.mockReset();
		apiFetchMock.mockResolvedValue({
			data: {
				commodity: { slug: "live_cattle_cme", name: "Live Cattle", unit: "USd/lb" },
				price: { close: 211.725, date: "2026-08-28T00:00:00Z" },
			},
		});
	});

	it("renders the next-month consensus card with numbers, spread and agreement", async () => {
		mockReturn = { consensus: makeConsensus(), loading: false, error: null, retry: jest.fn() };
		render(<BeefForecastPage />);
		expect(await screen.findByText("−1.2%")).toBeInTheDocument();
		expect(screen.getByText(/331\.78 → 327\.66 USD/)).toBeInTheDocument();
		expect(screen.getByText("322.10 – 334.90")).toBeInTheDocument();
		expect(screen.getByText("61%")).toBeInTheDocument();
		expect(screen.getByText("4/7")).toBeInTheDocument();
		// H is displayed in MONTHS on the monthly benchmark.
		expect(screen.getByText(/H = 1 个月/)).toBeInTheDocument();
	});

	it("renders the calibrated 90% band with its backtest provenance (round-164 批0b)", async () => {
		mockReturn = { consensus: makeConsensus(), loading: false, error: null, retry: jest.fn() };
		render(<BeefForecastPage />);
		expect(await screen.findByText("校准 90% 区间")).toBeInTheDocument();
		expect(screen.getByText("322.63 – 349.70")).toBeInTheDocument();
		// Sample size caption ties the band to the 36-origin backtest.
		expect(screen.getByText(/回测 36 起点残差分位/)).toBeInTheDocument();
		// The disagreement spread stays visible as a distinct, secondary stat.
		expect(screen.getByText("模型分歧区间")).toBeInTheDocument();
	});

	it("falls back to the honest uncalibrated footnote when the band is absent", async () => {
		mockReturn = {
			consensus: makeConsensus({ calibratedInterval: null }),
			loading: false,
			error: null,
			retry: jest.fn(),
		};
		render(<BeefForecastPage />);
		expect(await screen.findByText("−1.2%")).toBeInTheDocument();
		expect(screen.queryByText("校准 90% 区间")).not.toBeInTheDocument();
		expect(screen.getByText(/待回测证据覆盖本视界后接入/)).toBeInTheDocument();
	});

	it("shows the honest empty state instead of a fabricated consensus", () => {
		render(<BeefForecastPage />);
		expect(screen.getByText("暂无共识信号")).toBeInTheDocument();
	});

	it("shows the honest verification timeline (first rolling verification 2026-09)", () => {
		render(<BeefForecastPage />);
		expect(screen.getByText(/2026-09 \/ 10/)).toBeInTheDocument();
		expect(screen.getByText(/2026-11/)).toBeInTheDocument();
	});

	it("renders the backtest evidence panel and upstream quotes", async () => {
		mockReturn = { consensus: makeConsensus(), loading: false, error: null, retry: jest.fn() };
		render(<BeefForecastPage />);
		expect(screen.getByTestId("beef-backtest-section")).toBeInTheDocument();
		// Both upstream cards resolve the same mocked payload — assert both
		// rendered rather than a unique single match.
		expect(await screen.findAllByText("Live Cattle")).toHaveLength(2);
		// 211.725.toFixed(2) === "211.72" (binary float repr) — assert the
		// actual rendered value.
		expect(screen.getAllByText("211.72")).toHaveLength(2);
	});
});
