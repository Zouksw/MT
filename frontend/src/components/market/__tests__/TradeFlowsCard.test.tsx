/**
 * TradeFlowsCard (V8 批4 base; round-155 批C deepening).
 *
 * Pins the enrichment contract: the HS-code switcher (8 pinned lanes), the
 * per-country monthly volume/price chart over the new `history` payload, the
 * newly-rendered qtyMoM / valueM columns, the per-row currency rendering for
 * the Comext EUR lane (round-161), the AR all-destinations FOB
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

const point = (
	period: string,
	qtyTons: number,
	price: number,
	currency: "USD" | "EUR" = "USD",
) => ({
	period,
	date: `2026-${period.slice(4)}-01T00:00:00.000Z`,
	currency,
	qtyTons,
	unitPricePerT: price,
	valueM: Math.round(((qtyTons * price) / 1_000_000) * 10) / 10,
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
					currency: "USD",
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
					// Comext EU lane (round-161): EUR-denominated, sits in the
					// same table with its own symbol — never converted.
					region: "IE→CN",
					country: "IE",
					freq: "M",
					basis: "FOB-EUR (EU-reported export, Comext DS-045409)",
					currency: "EUR",
					latest: point("202606", 50.5, 2560.59, "EUR"),
					momPct: null,
					qtyMomPct: null,
					stale: false,
					history: [point("202606", 50.5, 2560.59, "EUR")],
				},
				{
					region: "AR→CN",
					country: "AR",
					freq: "A",
					basis: "FOB (partner-reported export)",
					currency: "USD",
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
			uyInacTotal: { period: "2026-07", valueUsdM: 67.5 },
			uyCuts: [
				{
					key: "frozen_hindquarter_boneless",
					process: "frozen",
					period: "2026-07",
					usdPerKg: 8.94,
					tonnes: 3711,
					history: [
						{ period: "2026-05", usdPerKg: 8.6 },
						{ period: "2026-06", usdPerKg: 8.7 },
					],
				},
				{
					key: "chilled_forequarter_boneless",
					process: "chilled",
					period: "2026-07",
					usdPerKg: 12.53,
					tonnes: 758,
					history: [],
				},
			],
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

		// 批C columns: monthly value + qty MoM now rendered (header is
		// currency-neutral since round-161 — symbols live per row).
		expect(screen.getByText("金额（百万）")).toBeInTheDocument();
		expect(screen.getByText("数量环比")).toBeInTheDocument();

		// round-161: per-row currency — BR renders $/t, the IE Comext lane
		// renders €/t and a EUR caliber tag, never converted into USD.
		expect(screen.getAllByText(/\$6,?398\/t/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/€2,?561\/t/).length).toBeGreaterThan(0);
		expect(screen.getByText("爱尔兰")).toBeInTheDocument();
		expect(screen.getAllByText(/M€/).length).toBeGreaterThan(0);
		expect(screen.getAllByText("月度 FOB·EUR").length).toBeGreaterThan(0);

		// AR all-destinations FOB context line.
		expect(screen.getByText(/阿根廷肉类月度出口总额/)).toBeInTheDocument();
		expect(screen.getByText(/非对华流量/)).toBeInTheDocument();

		// round-162: Uruguay INAC to-China value context + cut-family table.
		expect(screen.getByText(/乌拉圭 INAC 官方对华牛肉月度出口额/)).toBeInTheDocument();
		expect(screen.getByText(/乌拉圭部位族 FOB/)).toBeInTheDocument();
		expect(screen.getByText("后四分体去骨")).toBeInTheDocument();
		expect(screen.getByText("冷冻")).toBeInTheDocument();
		expect(screen.getByText("冷鲜")).toBeInTheDocument();
		expect(screen.getAllByText("2026-07").length).toBeGreaterThan(0);

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
		expect(screen.getByText("金额（百万）")).toBeInTheDocument();
	});

	test("omits the card entirely when the fetch returns nothing (anonymous/401)", () => {
		const { container } = render(<TradeFlowsCard />);
		expect(container.querySelector("div")).toBeNull();
	});
});
