import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: jest.fn() }),
}));

// Mock dayjs — provide real dayjs with no-op extend/locale
jest.mock("dayjs", () => {
	const dayjs = Object.assign(
		jest.fn(() => ({
			fromNow: jest.fn(),
			format: jest.fn(() => ""),
		})),
		{ extend: jest.fn(), locale: jest.fn() },
	);
	return { __esModule: true, default: dayjs };
});

// Mock authFetch
jest.mock("@/utils/auth", () => ({
	authFetch: jest.fn(),
}));

// Mock useToast
jest.mock("@/components/ui/Toast", () => ({
	useToast: () => ({
		showError: jest.fn(),
		showSuccess: jest.fn(),
		showInfo: jest.fn(),
		showWarning: jest.fn(),
	}),
}));

// Mock responsive
jest.mock("@/lib/responsive-utils", () => ({
	useIsMobile: jest.fn(() => false),
}));

import { authFetch } from "@/utils/auth";
import AlertList from "../page";

const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

const sampleAlerts = [
	{
		id: "alert-1",
		type: "ANOMALY",
		severity: "ERROR",
		message: "High temperature detected",
		isRead: false,
		createdAt: "2024-01-15T10:00:00Z",
	},
	{
		id: "alert-2",
		type: "FORECAST_READY",
		severity: "INFO",
		message: "Forecast completed",
		isRead: true,
		createdAt: "2024-01-14T10:00:00Z",
	},
	{
		id: "alert-3",
		type: "SYSTEM",
		severity: "WARNING",
		message: "Disk space low",
		isRead: false,
		createdAt: "2024-01-13T10:00:00Z",
	},
];

const sampleStats = {
	total: 15,
	unread: 8,
	bySeverity: { INFO: 5, WARNING: 6, ERROR: 4 },
	byType: { ANOMALY: 7, FORECAST_READY: 5, SYSTEM: 3 },
};

describe("AlertList", () => {
	beforeEach(() => {
		mockAuthFetch.mockReset();
		// Default mock responses
		mockAuthFetch.mockImplementation((url: string) => {
			if (url.includes("/stats")) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(sampleStats),
				// biome-ignore lint/suspicious/noExplicitAny: third-party library type
				} as any);
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ alerts: sampleAlerts }),
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			} as any);
		});
	});

	it("should render page header", async () => {
		render(<AlertList />);

		// Title appears in breadcrumb and h1 — check h1 specifically
		const headings = screen.getAllByRole("heading", { level: 1 });
		expect(headings[0]).toHaveTextContent("Alerts & Notifications");
		expect(
			screen.getByText("View and manage system alerts, anomalies, and notifications"),
		).toBeInTheDocument();
	});

	it("should render stats when loaded", async () => {
		render(<AlertList />);

		await waitFor(() => {
			expect(screen.getByText("Total Alerts")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("15")).toBeInTheDocument();
			expect(screen.getByText("Unread")).toBeInTheDocument();
			expect(screen.getByText("8")).toBeInTheDocument();
		});
	});

	it("should render alerts table after loading", async () => {
		render(<AlertList />);

		// Wait for data to load and table to render alert messages
		await waitFor(() => {
			expect(screen.getByText("High temperature detected")).toBeInTheDocument();
		});
	});

	it("should render filter controls", async () => {
		render(<AlertList />);

		await waitFor(() => {
			expect(screen.getByText("Filter by:")).toBeInTheDocument();
		});
	});

	it("should render refresh button", async () => {
		render(<AlertList />);

		expect(screen.getByText("Refresh")).toBeInTheDocument();
	});

	it("should show Mark All Read button when there are unread alerts", async () => {
		render(<AlertList />);

		await waitFor(() => {
			expect(screen.getByText("Mark All Read")).toBeInTheDocument();
		});
	});

	it("should handle fetch error gracefully", async () => {
		mockAuthFetch.mockRejectedValue(new Error("Network error"));

		render(<AlertList />);

		// Should show empty state after error
		await waitFor(() => {
			expect(screen.getByText(/No alerts match your current filters/)).toBeInTheDocument();
		});
	});

	it("should show empty filters message when list is empty", async () => {
		mockAuthFetch.mockImplementation((url: string) => {
			if (url.includes("/stats")) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ total: 0, unread: 0, bySeverity: {}, byType: {} }),
				// biome-ignore lint/suspicious/noExplicitAny: third-party library type
				} as any);
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ alerts: [] }),
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			} as any);
		});

		render(<AlertList />);

		await waitFor(() => {
			expect(screen.getByText(/No alerts match your current filters/)).toBeInTheDocument();
		});
	});
});
