/**
 * Dashboard performance page — honesty regression tests (round-85/89).
 *
 * Round-85 removed a hardcoded `errorRate = 0` that displayed a fake green
 * "0%" Error Rate card (AGENTS.md §十.3: no fabricated data). The card now
 * shows "--" (null state) because the /metrics endpoint doesn't expose error
 * rate. This test guards against backsliding to a hardcoded value.
 *
 * Mocks global fetch to return empty metrics, then asserts the Error Rate
 * card renders "--" — NOT "0%" or any fabricated percentage.
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation (useSearchParams requires it in tests).
jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams(),
	useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
	usePathname: () => "/dashboard/performance",
}));

// Mock tokenManager (authHeaders reads from it).
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: () => "fake-token" },
}));

// Mock recharts (the page imports chart components that need it).
jest.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	LineChart: () => null,
	Line: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
}));

import PerformancePage from "../page";

// Mock fetch to return minimal valid metrics responses.
function mockFetch() {
	return jest.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: async () => ({
			uptime: { formatted: "1h" },
			memory: { heapUsedFormatted: "50MB", heapUsagePercent: 10 },
			requests: { total: 100, avgResponseTime: 50 },
		}),
		text: async () => "",
	});
}

describe("Dashboard Performance — Error Rate honesty (round-85)", () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		global.fetch = mockFetch() as unknown as typeof fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it("Error Rate card renders '--' (not fabricated 0%)", async () => {
		render(<PerformancePage />);

		// Wait for metrics to load and the StatCards to render.
		await waitFor(() => {
			expect(screen.getByText("Error Rate")).toBeInTheDocument();
		});

		// The Error Rate value must be "--" (honest null), NOT "0%" or any
		// fabricated percentage. Walk up to the card container (the div with
		// the shadow class) that holds both the title and the value.
		const titleEl = screen.getByText("Error Rate");
		const card = titleEl.closest('[class*="shadow"]');
		const cardText = card?.textContent ?? "";
		expect(cardText).toContain("--");
		expect(cardText).not.toMatch(/0%/); // never a fabricated "0%"
	});
});
