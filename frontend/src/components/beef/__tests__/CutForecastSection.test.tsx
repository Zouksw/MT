import { render, screen } from "@testing-library/react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { tokenManager } from "@/lib/tokenManager";
import CutForecastSection from "../CutForecastSection";

// Mock the hook so the component doesn't hit the network.
jest.mock("@/hooks/useRetryableFetch");
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: () => null },
}));

const mocked = useRetryableFetch as jest.MockedFunction<typeof useRetryableFetch>;

function setData(data: unknown) {
	mocked.mockReturnValue({
		data,
		error: undefined,
		isLoading: false,
		isValidating: false,
		isRetrying: false,
		retryCount: 0,
		manualRetry: jest.fn(),
		mutate: jest.fn(),
	} as ReturnType<typeof useRetryableFetch>);
}

function setLoading() {
	mocked.mockReturnValue({
		data: null,
		error: undefined,
		isLoading: true,
		isValidating: false,
		isRetrying: false,
		retryCount: 0,
		manualRetry: jest.fn(),
		mutate: jest.fn(),
	} as ReturnType<typeof useRetryableFetch>);
}

function setError(message: string) {
	mocked.mockReturnValue({
		data: null,
		error: new Error(message),
		isLoading: false,
		isValidating: false,
		isRetrying: false,
		retryCount: 0,
		manualRetry: jest.fn(),
		mutate: jest.fn(),
	} as ReturnType<typeof useRetryableFetch>);
}

describe("CutForecastSection", () => {
	beforeEach(() => mocked.mockReset());

	it("renders loading skeleton while fetching", () => {
		setLoading();
		render(<CutForecastSection cutCode="BRISKET_NAVEL" />);
		expect(screen.getByText(/AI Forecast/i)).toBeInTheDocument();
	});

	it("renders honest 'can't forecast' card with reason when forecastable:false", () => {
		setData({
			data: {
				cutCode: "BRISKET_NAVEL",
				forecastable: false,
				reason: "Price data is stale (latest 2026-04-30). Activate a beef source.",
			},
		});
		render(<CutForecastSection cutCode="BRISKET_NAVEL" />);
		expect(screen.getByText(/stale/i)).toBeInTheDocument();
		expect(screen.getByText(/Activate a beef source/i)).toBeInTheDocument();
		// Must NOT render consensus fields when not forecastable
		expect(screen.queryByText(/Confidence/i)).not.toBeInTheDocument();
	});

	it("renders login prompt on 401", () => {
		setError("401");
		render(<CutForecastSection cutCode="BRISKET_NAVEL" />);
		expect(screen.getByText(/Log in/i)).toBeInTheDocument();
	});

	it("renders full consensus forecast when forecastable:true", () => {
		setData({
			data: {
				cutCode: "SILVERSIDE",
				forecastable: true,
				factoryId: "f1",
				dataPoints: 30,
				currentPrice: 7.08,
				forecast: {
					direction: "up",
					confidence: 0.72,
					modelsAgree: 3,
					totalModels: 5,
					availableModels: 5,
					predictedChange: 6.1,
					currentPrice: 7.08,
					predictedPrice: 7.52,
					horizon: 7,
					range: { lower: 7.31, upper: 8.46 },
					distribution: { up: 3, down: 0, flat: 2 },
					bestModel: "exponential_smoothing",
					individualForecasts: [],
				},
			},
		});
		render(<CutForecastSection cutCode="SILVERSIDE" />);
		expect(screen.getByText("Up")).toBeInTheDocument();
		expect(screen.getByText(/72%/)).toBeInTheDocument();
		expect(screen.getByText(/3\/5/)).toBeInTheDocument();
		expect(screen.getByText(/Exp. Smoothing/i)).toBeInTheDocument();
	});

	it("renders nothing on non-401 error (silent fail — forecast is enhancement)", () => {
		setError("500");
		const { container } = render(<CutForecastSection cutCode="UNKNOWN" />);
		expect(container.firstChild).toBeNull();
	});
});
