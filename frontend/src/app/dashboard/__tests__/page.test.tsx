/**
 * Tests for Dashboard page
 *
 * Tests that the page renders with mocked stats, shows welcome header,
 * stat cards, and handles loading state.
 */

import { render, screen } from "@testing-library/react";
import type React from "react";
import "@testing-library/jest-dom";

// Mock useDashboardStats hook
const mockUseDashboardStats = jest.fn();
jest.mock("@/hooks/useDashboardStats", () => ({
	useDashboardStats: () => mockUseDashboardStats(),
}));

// Mock getCachedUser + getAuthToken
jest.mock("@/utils/auth", () => ({
	getCachedUser: jest.fn(() => ({ name: "Test User", email: "test@example.com" })),
	getAuthToken: jest.fn(() => "mock-token"),
}));

// Mock useIsMobile
jest.mock("@/lib/responsive-utils", () => ({
	useIsMobile: jest.fn(() => false),
}));

// Mock heavy dynamic imports
jest.mock("@/components/dashboard/ForecastTrendChart", () => ({
	ForecastTrendChart: ({ loading }: { loading: boolean }) => (
		<div data-testid="forecast-chart">{loading ? "Loading chart..." : "Forecast Chart"}</div>
	),
}));
jest.mock("@/components/dashboard/AlertDistributionChart", () => ({
	AlertDistributionChart: ({ loading }: { loading: boolean }) => (
		<div data-testid="alert-chart">{loading ? "Loading chart..." : "Alert Chart"}</div>
	),
}));
jest.mock("@/components/dashboard/RecentActivity", () => ({
	RecentActivity: () => <div data-testid="recent-activity">Recent Activity</div>,
}));
jest.mock("@/components/dashboard/QuickActions", () => ({
	QuickActions: () => <div data-testid="quick-actions">Quick Actions</div>,
}));

// Mock StatCard to avoid animation timer issues
jest.mock("@/components/ui/StatCard", () => ({
	StatCard: ({ title, value }: { title: string; value: number }) => (
		<div data-testid={`stat-card-${title}`}>
			{title}: {value}
		</div>
	),
}));

jest.mock("@/components/ui/ErrorDisplay", () => ({
	ErrorDisplay: ({ error }: { error: Error }) => (
		<div data-testid="error-display">{error.message}</div>
	),
}));

jest.mock("@/components/ui/LoadingState", () => ({
	LoadingState: ({ children, loading }: { children: React.ReactNode; loading: boolean }) => (
		<div data-testid="loading-state">
			{loading ? <div data-testid="loading-spinner">Loading...</div> : children}
		</div>
	),
}));

jest.mock("@/components/layout/PageContainer", () => ({
	PageContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="page-container">{children}</div>
	),
}));

import DashboardPage from "../page";

const defaultStats = {
	datasets: { total: 12, trend: 5 },
	timeseries: { total: 48, trend: 3 },
	forecasts: { total: 8, trend: -8 },
	alerts: { total: 3, bySeverity: { critical: 0, high: 1, medium: 2, low: 0 }, trend: -12 },
	aiModels: { active: 5, total: 7 },
	recentAlerts: [],
	recentForecasts: [],
};

describe("DashboardPage", () => {
	beforeEach(() => {
		mockUseDashboardStats.mockReturnValue({
			stats: defaultStats,
			loading: false,
			error: null,
			manualRetry: jest.fn(),
		});
	});

	it("should render welcome header with user name", () => {
		render(<DashboardPage />);

		expect(screen.getByText(/Welcome back, Test User/)).toBeInTheDocument();
	});

	it("should render stat cards with correct values", () => {
		render(<DashboardPage />);

		expect(screen.getByTestId("stat-card-Datasets")).toHaveTextContent("12");
		expect(screen.getByTestId("stat-card-Time Series")).toHaveTextContent("48");
	});

	it("should show loading state when stats are loading", () => {
		mockUseDashboardStats.mockReturnValue({
			stats: null,
			loading: true,
			error: null,
			manualRetry: jest.fn(),
		});

		render(<DashboardPage />);

		expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
	});

	it("should show error state when stats fetch fails", () => {
		mockUseDashboardStats.mockReturnValue({
			stats: null,
			loading: false,
			error: new Error("Network error"),
			manualRetry: jest.fn(),
		});

		render(<DashboardPage />);

		expect(screen.getByTestId("error-display")).toHaveTextContent("Network error");
	});

	it("should render charts section", () => {
		render(<DashboardPage />);

		expect(screen.getByTestId("forecast-chart")).toBeInTheDocument();
		expect(screen.getByTestId("alert-chart")).toBeInTheDocument();
	});

	it("should render recent activity and quick actions", () => {
		render(<DashboardPage />);

		expect(screen.getByTestId("recent-activity")).toBeInTheDocument();
		expect(screen.getByTestId("quick-actions")).toBeInTheDocument();
	});

	it("should render AI Models status when stats include aiModels", () => {
		render(<DashboardPage />);

		expect(screen.getByText("AI Models Status")).toBeInTheDocument();
		expect(screen.getByText(/models active/)).toHaveTextContent(/5/);
	});

	it("should show healthy system indicator", () => {
		render(<DashboardPage />);

		expect(screen.getByText("Healthy")).toBeInTheDocument();
	});
});
