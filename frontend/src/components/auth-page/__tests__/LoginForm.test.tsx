import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Mock js-cookie
jest.mock("js-cookie", () => ({
	set: jest.fn(),
	get: jest.fn(),
	remove: jest.fn(),
}));

// Mock tokenManager
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: {
		setToken: jest.fn(),
		getToken: jest.fn(),
		removeToken: jest.fn(),
	},
}));

// Mock sanitizer — pass-through so validate() sees real values
jest.mock("@/lib/sanitizer", () => ({
	sanitizer: {
		sanitizeEmail: jest.fn((email: string) => email),
		sanitizeString: jest.fn((str: string) => str),
	},
}));

// fetch is stubbed per-case; default to a failing call so a forgotten mock is
// caught instead of silently hitting the network.
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof global.fetch;

describe("LoginForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		fetchMock.mockReset();
	});

	it("renders email and password fields and the submit button", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
	});

	it("shows validation errors and does NOT call the API when submitting empty form", async () => {
		render(<LoginForm />);

		// Submit without entering anything (htmlForm noValidate allows it)
		fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

		// validate() sets errors.email + errors.password; Input renders them as
		// <p className="...text-error"> (Input.tsx). Assert the real visible
		// behavior — and that the request was never sent.
		await waitFor(() => {
			expect(screen.getByText(/email is required/i)).toBeInTheDocument();
			expect(screen.getByText(/password is required/i)).toBeInTheDocument();
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not show field errors before submit (initial render has no errors)", () => {
		render(<LoginForm />);

		expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument();
	});

	it("clears the email error once the user types and resubmits", async () => {
		render(<LoginForm />);

		// Trigger the initial error
		fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
		await waitFor(() => expect(screen.getByText(/email is required/i)).toBeInTheDocument());

		// Type an email + password and submit — fetch returns a 401, but the
		// point is that the validation errors are gone (validate() passes).
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: async () => ({ message: "bad creds" }),
		} as Response);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "user@example.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "Sup3rSecret!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

		await waitFor(() => {
			expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument();
		});
		// And validate() passing means the request WAS sent this time.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
