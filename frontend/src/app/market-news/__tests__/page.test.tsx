import { render, screen } from "@testing-library/react";
import type React from "react";
import "@testing-library/jest-dom";

// Mock the data layer so the list page renders against fixtures, not the API.
const mockUseList = jest.fn();
jest.mock("@/lib/api", () => ({
	useList: (...args: unknown[]) => mockUseList(...args),
	deleteRecord: jest.fn(),
}));

// Mock layout + interactive deps to avoid animation/timer noise.
jest.mock("@/components/layout/PageContainer", () => ({
	PageContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="page-container">{children}</div>
	),
}));
jest.mock("@/lib/responsive-utils", () => ({ useIsMobile: () => false }));
jest.mock("@/components/ui/Toast", () => ({
	useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}));

import MarketNewsList from "../page";

const NEWS_FIXTURE = [
	{
		id: "n1",
		title: "Brazil beef exports hit record",
		slug: "brazil-beef-exports",
		summary: "Quarterly record on China demand.",
		category: "TRADE_POLICY",
		source: "Reuters",
		commoditySlug: "bra_topside",
		tags: ["brazil", "china"],
		status: "published",
		viewCount: 12,
		publishedAt: new Date().toISOString(),
		author: { id: "u1", name: "Admin" },
	},
	{
		id: "n2",
		title: "Australian beef prices ease",
		slug: "aus-prices-ease",
		summary: "Slaughter rise lowers M9 cuts.",
		category: "PRICE_MOVE",
		source: "MLA",
		commoditySlug: "aus_sirloin_m9",
		tags: ["australia"],
		status: "published",
		viewCount: 5,
		publishedAt: new Date().toISOString(),
		author: { id: "u1", name: "Admin" },
	},
];

describe("MarketNewsList page", () => {
	beforeEach(() => {
		// Both useList calls (feed + stats) return the same fixture.
		mockUseList.mockReturnValue({
			data: NEWS_FIXTURE,
			total: NEWS_FIXTURE.length,
			loading: false,
			mutate: jest.fn(),
		});
	});

	it("renders the page header and stat cards", () => {
		render(<MarketNewsList />);
		// "Market News" appears in both the PageHeader title and the breadcrumb.
		expect(screen.getAllByText("Market News").length).toBeGreaterThan(0);
		// Stat card labels
		expect(screen.getByText("Total Articles")).toBeInTheDocument();
		expect(screen.getByText("This Week")).toBeInTheDocument();
	});

	it("renders the article titles in the table", () => {
		render(<MarketNewsList />);
		expect(screen.getByText("Brazil beef exports hit record")).toBeInTheDocument();
		expect(screen.getByText("Australian beef prices ease")).toBeInTheDocument();
	});
});
