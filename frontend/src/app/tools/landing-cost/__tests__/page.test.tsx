import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * Landing-cost page tests (v3.2.0 批 3). The hook + math are server-side
 * (pinned by backend suites); what needs pinning HERE is the page contract:
 * numbers from the quote render (mid CNY, range, source dates), the
 * insufficient-data honesty state, and that recalculate sends the edited
 * parameters to the public endpoint.
 */

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

jest.mock("@/lib/apiFetch", () => ({ apiFetch: jest.fn() }));

import { apiFetch } from "@/lib/apiFetch";

const apiFetchMock = apiFetch as jest.Mock;

import type { LandingCostQuote } from "@/hooks/useLandingCost";
import LandingCostPage from "../page";

function makeQuote(overrides: Partial<LandingCostQuote> = {}): LandingCostQuote {
	const breakdown = (base: number) => ({
		baseUsdPerKg: base,
		freightUsdPerKg: 0.5,
		feesUsdPerKg: 0.25,
		costBaseUsdPerKg: base + 0.75,
		dutyUsdPerKg: (base + 0.75) * 0.1,
		vatUsdPerKg: (base + 0.75) * 1.1 * 0.09,
		landedUsdPerKg: (base + 0.75) * 1.1 * 1.09 * 1.05,
		cnyPerKg: (base + 0.75) * 1.1 * 1.09 * 1.05 * 7,
	});
	return {
		status: "ok",
		params: {
			baseSeries: "beef_carcass_us",
			originFx: "none",
			tariffPct: 10,
			vatPct: 9,
			freightUsdPerKg: 0.5,
			feesUsdPerKg: 0.25,
			lossPct: 5,
		},
		base: {
			slug: "beef_carcass_us",
			label: "全球牛肉月度基准（IMF via FRED）",
			unit: "USC/lb",
			latestClose: 331.78,
			latestDate: "2026-07-01T00:00:00Z",
			interval: "monthly",
			source: "fred",
			stale: false,
			daysOld: 29,
			usdPerKg: 7.3145,
			window: { points: 3, description: "近 3 个月度点", lowClose: 310, highClose: 331.78 },
		},
		fx: {
			usdCny: { rate: 7.0, date: "2026-08-29T16:00:00Z", stale: false },
			originRef: null,
		},
		landed: {
			low: breakdown(6.8343),
			mid: breakdown(7.3145),
			high: breakdown(7.3145),
		},
		notes: [
			"关税 / 增值税 / 运费 / 杂费 / 损耗为你输入的假设参数——平台不内置各国税率（不造虚构数据）。",
			"增值税按（成本基数 + 关税）计算（中国进口环节口径）；损耗在完税后乘算。",
			"参考估算工具，非报关或采购依据；基准价与汇率均标注来源日期。",
		],
		timestamp: "2026-08-30T00:00:00Z",
		...overrides,
	};
}

function mockResolve(quote: LandingCostQuote) {
	apiFetchMock.mockReset();
	apiFetchMock.mockResolvedValue({ success: true, data: quote });
}

describe("/tools/landing-cost page", () => {
	beforeEach(() => {
		mockResolve(makeQuote());
	});

	it("renders the mid landed CNY figure, USD secondary, and the traceable source dates", async () => {
		render(<LandingCostPage />);

		// mid: (7.3145 + 0.75) × 1.1 × 1.09 × 1.05 × 7 ≈ 71.07 CNY/kg
		const mid = await screen.findByTestId("landed-mid");
		expect(mid).toHaveTextContent("71.07");
		expect(mid.textContent).toMatch(/USD\/kg/);

		// Base card: unit, converted USD/kg, dated + sourced (getAllByText —
		// the card's parent containers aggregate the same text)
		expect(screen.getAllByText(/331\.78 USC\/lb/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/7\.31\d* USD\/kg/).length).toBeGreaterThan(0);
		expect(screen.getByText(/2026\/7\/1/)).toBeInTheDocument();
		expect(screen.getByText(/fred/)).toBeInTheDocument();

		// FX card
		expect(screen.getByText(/USD\/CNY 7\.0000/)).toBeInTheDocument();

		// Honesty notes surface verbatim (also appears in the form footnote —
		// assert presence, not uniqueness)
		expect(screen.getAllByText(/平台不内置各国税率/).length).toBeGreaterThanOrEqual(2);
	});

	it("shows the honest insufficient-data state instead of fabricated numbers", async () => {
		mockResolve(
			makeQuote({
				status: "insufficient_data",
				reason: "基准序列 beef_carcass_us 暂无价格数据",
				base: undefined,
				fx: undefined,
				landed: undefined,
			}),
		);
		render(<LandingCostPage />);

		expect(await screen.findByText("暂无法计算")).toBeInTheDocument();
		expect(screen.getByText(/暂无价格数据/)).toBeInTheDocument();
		expect(screen.queryByTestId("landed-mid")).not.toBeInTheDocument();
	});

	it("recalculate sends the edited parameters to the public endpoint", async () => {
		render(<LandingCostPage />);
		await screen.findByTestId("landed-mid");

		fireEvent.change(screen.getByLabelText("关税税率（%）"), { target: { value: "12" } });
		fireEvent.click(screen.getByRole("button", { name: "计算到岸成本" }));

		await waitFor(() => {
			const call = apiFetchMock.mock.calls[apiFetchMock.mock.calls.length - 1];
			const url = call[0] as string;
			expect(url).toContain("tariffPct=12");
			expect(url).toContain("baseSeries=beef_carcass_us");
			expect(url).toContain("/api/tools/landing-cost?");
		});
	});

	it("flags a stale base series instead of hiding the staleness", async () => {
		const fresh = makeQuote();
		if (!fresh.base) throw new Error("fixture base missing");
		mockResolve(
			makeQuote({
				base: { ...fresh.base, stale: true, daysOld: 75 },
			}),
		);
		render(<LandingCostPage />);

		expect(await screen.findByText(/已 75 天未更新/)).toBeInTheDocument();
	});
});
