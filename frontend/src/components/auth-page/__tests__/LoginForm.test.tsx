import { render, screen } from "@testing-library/react";
import { LoginForm } from "../LoginForm";

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// Mock Toast instead of antd message
jest.mock("@/components/ui/Toast", () => ({
	useToast: () => ({
		showError: jest.fn(),
		showSuccess: jest.fn(),
		showWarning: jest.fn(),
		showInfo: jest.fn(),
	}),
}));

// Mock axios
jest.mock("axios", () => {
	const mockAxios: Record<string, unknown> = {
		post: jest.fn(),
		defaults: { headers: { common: {} } },
		interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
	};
	mockAxios.create = jest.fn(() => mockAxios);
	return mockAxios;
});

// Mock js-cookie
jest.mock("js-cookie", () => ({
	set: jest.fn(),
	get: jest.fn(),
	remove: jest.fn(),
}));

// csrf module no longer exists in the project

// Mock tokenManager
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: {
		setToken: jest.fn(),
		getToken: jest.fn(),
		removeToken: jest.fn(),
	},
}));

// Mock sanitizer
jest.mock("@/lib/sanitizer", () => ({
	sanitizer: {
		sanitizeEmail: jest.fn((email: string) => email),
		sanitizeString: jest.fn((str: string) => str),
	},
}));

describe("LoginForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("should render email and password inputs", () => {
		render(<LoginForm />);

		expect(screen.getByText("Email")).toBeInTheDocument();
		expect(screen.getByText("Password")).toBeInTheDocument();
	});

	test("should render sign in button", () => {
		render(<LoginForm />);

		expect(screen.getByText("Sign In")).toBeInTheDocument();
	});

	test("should render forgot password link", () => {
		render(<LoginForm />);

		expect(screen.getByText("Forgot password?")).toBeInTheDocument();
	});

	test("should render remember me checkbox", () => {
		render(<LoginForm />);

		expect(screen.getByText("Remember me")).toBeInTheDocument();
	});

	test("should have correct input placeholders", () => {
		render(<LoginForm />);

		expect(screen.getByPlaceholderText("your.email@example.com")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
	});
});
