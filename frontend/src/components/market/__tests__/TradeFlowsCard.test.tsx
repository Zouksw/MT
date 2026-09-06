/**
 * TradeFlowsCard (V8 批4 base; round-155 批C deepening).
 *
 * Pins the enrichment contract: the HS-code switcher (8 pinned lanes), the
 * per-country monthly volume/price chart over the new `history` payload, the
 * newly-rendered qtyMoM / valueUsdM columns, the AR all-destinations FOB
 * context line, and the honest-degrade paths (no data → card omitted;
 * annual-only lanes → table without chart). The 口径注记 footer stays
 * mandatory on every render that shows data.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type React from "react";

// Key-keyed fetch results — the hook mock returns whatever the test planted
// for the current URL (same pattern as the beef page tests).
const mockFetchData: Record<string, unknown> = {};
jest.mock("@/hooks/useRetryableFetch", () => ({
	useRetryableFetch: (key: string) => ({ data: mockFetchData[key] }),
}));

// recharts-lazy wraps next/dynamic — stub the primitives synchronously so
// JSDOM can assert chart presence without async dynamic loading.
jest.mock("@/lib/recharts-lazy", () => ({
	dynamicRecharts: () => ({
		ComposedChart: ({ children }: React.PropsWithChildren) => (
			<div data-testid="recharts-ComposedChart">{children}</div>
		),
		Bar: () => <div data-testid="recharts-Bar" />,
		Line: () => <div data-testid="recharts-Line" />,
		XAxis: () => <div data-testid="recharts-XAxis" />,
		YAxis: () => <div data-testid="recharts-YAxis" />,
		CartesianGrid: () => <div data-testid="recharts-CartesianGrid" />,
		Tooltip: () => <div data-testid="recharts-Tooltip" />,
		Legend: () => <div data-testid="recharts-Legend" />,
		ResponsiveContainer: ({ children }: React.PropsWithChildren) => (
			<div data-testid="recharts-ResponsiveContainer">{children}</div>
		),
	}),
}));

import { TradeFlowsCard } from "../TradeFlowsCard";

const point = (period: string, qtyTons: number, price: number) => ({
	period,
	date: `2026-${period.slice(4)}-01T00:00:00.000Z`,
	qtyTons,
	unitPriceUsdPerT: price,
	valueUsdM: Math.round(((qtyTons * price) / 1_000_000) * 10) / 10,
});

function makePayload(hs: string, opts: { monthlyHistory?: boolean } = {}) {
	return {
		data: {
			hs,
			flows: [
				{
					region: "BR→CN",
					country: "BR",
					freq: "M",
					basis: "FOB (partner-reported export)",
					latest: point("202607", 82714, 6398),
					momPct: -5.2,
					qtyMomPct: -3.1,
					stale: false,
					history: opts.monthlyHistory
						? [
								point("202605", 90000, 6400),
								point("202606", 85000, 6750),
								point("202607", 82714, 6398),
							]
						: [],
				},
				{
					region: "AR→CN",
					country: "AR",
					freq: "A",
					basis: "FOB (partner-reported export)",
					latest: point("2025", 592360, 3723),
					momPct: null,
					qtyMomPct: null,
					stale: false,
					history: [point("2025", 592360, 3723)],
				},
			],
			calibration: [
				{
					region: "CN←BR",
					country: "BR",
					basis: "CIF (China-reported import)",
					latest: point("2024", 1339849, 4621),
					stale: false,
				},
			],
			arFobTotal: { period: "2026-06", valueUsdM: 210.5 },
			notes: ["月度线为出口国报送的 FOB 镜像口径。", "两口径并列展示、绝不合并。"],
		},
	};
}

beforeEach(() => {
	for (const k of Object.keys(mockFetchData)) delete mockFetchData[k];
});

describe("TradeFlowsCard", () => {
	test("renders HS switcher, history chart, enriched columns and AR FOB context", () => {
		mockFetchData["/api/market/trade-flows?hs=0202"] = makePayload("0202", {
			monthlyHistory: true,
		});

		render(<TradeFlowsCard />);

		// Title reflects the selected HS lane.
		expect(screen.getByText(/对华贸易流 · 冻牛肉（HS 0202/)).toBeInTheDocument();

		// All 8 HS lanes are offered as pills.
		for (const label of ["冻去骨牛肉", "鲜/冷藏牛肉", "其他冻牛杂碎"]) {
			expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
		}

		// Monthly history powers the volume/price chart (BR default = first
		// monthly lane), annual AR is excluded from the pills by history depth.
		expect(screen.getByTestId("recharts-ComposedChart")).toBeInTheDocument();
		expect(screen.getByTestId("recharts-Bar")).toBeInTheDocument();
		expect(screen.getByTestId("recharts-Line")).toBeInTheDocument();
		expect(screen.getAllByText("巴西").length).toBeGreaterThan(0);
		expect(screen.queryByText("阿根廷", { exact: false, selector: "button" })).toBeNull();

		// 批C columns: monthly value (USD M) + qty MoM now rendered.
		expect(screen.getByText("金额（百万 USD）")).toBeInTheDocument();
		expect(screen.getByText("数量环比")).toBeInTheDocument();

		// AR all-destinations FOB context line.
		expect(screen.getByText(/阿根廷肉类月度出口总额/)).toBeInTheDocument();
		expect(screen.getByText(/非对华流量/)).toBeInTheDocument();

		// 口径注记 footer stays mandatory.
		expect(screen.getByText(/绝不合并/)).toBeInTheDocument();
	});

	test("switching an HS pill re-keys the fetch to the new lane", () => {
		mockFetchData["/api/market/trade-flows?hs=0202"] = makePayload("0202", {
			monthlyHistory: true,
		});
		mockFetchData["/api/market/trade-flows?hs=020230"] = makePayload("020230", {
			monthlyHistory: true,
		});

		render(<TradeFlowsCard />);
		expect(screen.getByText(/HS 0202/)).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /020230/ }));
		expect(screen.getByText(/HS 020230/)).toBeInTheDocument();
	});

	test("annual-only payload renders the table without the chart section", () => {
		const payload = makePayload("0202", { monthlyHistory: false });
		// No monthly lane with ≥2 history points → chart omitted, table stays.
		mockFetchData["/api/market/trade-flows?hs=0202"] = payload;

		render(<TradeFlowsCard />);

		expect(screen.queryByTestId("recharts-ComposedChart")).toBeNull();
		expect(screen.getByText("金额（百万 USD）")).toBeInTheDocument();
	});

	test("omits the card entirely when the fetch returns nothing (anonymous/401)", () => {
		const { container } = render(<TradeFlowsCard />);
		expect(container.querySelector("div")).toBeNull();
	});
});
