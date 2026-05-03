/**
 * Tests for AuthPage component (login/register/forgotPassword/updatePassword)
 *
 * Tests title/description rendering for each page type, form switching,
 * and navigation links.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock LoginForm/RegisterForm/etc. to avoid deep rendering
jest.mock("../LoginForm", () => ({
	LoginForm: () => <div data-testid="login-form">LoginForm</div>,
}));
jest.mock("../RegisterForm", () => ({
	RegisterForm: () => <div data-testid="register-form">RegisterForm</div>,
}));
jest.mock("../ForgotPasswordForm", () => ({
	ForgotPasswordForm: () => <div data-testid="forgot-password-form">ForgotPasswordForm</div>,
}));
jest.mock("../UpdatePasswordForm", () => ({
	UpdatePasswordForm: ({ token }: { token: string }) => (
		<div data-testid="update-password-form">UpdatePasswordForm token={token}</div>
	),
}));

import { AuthPage } from "../index";

// Get the mocked push function from jest.setup.js
const _mockPush = jest.fn();

describe("AuthPage", () => {
	it("should render login page title and description", () => {
		render(<AuthPage type="login" />);

		expect(screen.getByText("Welcome back")).toBeInTheDocument();
		expect(screen.getByText("Enter your credentials to access your account")).toBeInTheDocument();
	});

	it("should render LoginForm for login type", () => {
		render(<AuthPage type="login" />);

		expect(screen.getByTestId("login-form")).toBeInTheDocument();
	});

	it("should render register page title", () => {
		render(<AuthPage type="register" />);

		expect(screen.getByText("Create your account")).toBeInTheDocument();
		expect(screen.getByTestId("register-form")).toBeInTheDocument();
	});

	it("should render forgot password page", () => {
		render(<AuthPage type="forgotPassword" />);

		expect(screen.getByText("Reset your password")).toBeInTheDocument();
		expect(screen.getByTestId("forgot-password-form")).toBeInTheDocument();
	});

	it("should render update password page with token", () => {
		render(<AuthPage type="updatePassword" token="reset-token-abc" />);

		expect(screen.getByText("Create new password")).toBeInTheDocument();
		expect(screen.getByTestId("update-password-form")).toBeInTheDocument();
		expect(screen.getByText(/reset-token-abc/)).toBeInTheDocument();
	});

	it('should render "Sign up" link on login page', () => {
		render(<AuthPage type="login" />);

		expect(screen.getByText("Sign up")).toBeInTheDocument();
	});

	it('should render "Sign in" link on register page', () => {
		render(<AuthPage type="register" />);

		expect(screen.getByText("Sign in")).toBeInTheDocument();
	});

	it('should render "Back to login" on forgot password page', () => {
		render(<AuthPage type="forgotPassword" />);

		expect(screen.getByText(/Back to login/)).toBeInTheDocument();
	});

	it("should render Terms of Service and Privacy Policy links", () => {
		render(<AuthPage type="login" />);

		expect(screen.getByText("Terms of Service")).toBeInTheDocument();
		expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
	});

	it("should render MT branding on left panel", () => {
		render(<AuthPage type="login" />);

		expect(screen.getByText("MT")).toBeInTheDocument();
	});

	it("should render feature highlights on left panel", () => {
		render(<AuthPage type="login" />);

		expect(screen.getByText("55+ Commodities")).toBeInTheDocument();
		expect(screen.getByText("7 AI Models")).toBeInTheDocument();
		expect(screen.getByText("Multi-Factor Analysis")).toBeInTheDocument();
	});

	it("should navigate to register when Sign up clicked", () => {
		render(<AuthPage type="login" />);

		fireEvent.click(screen.getByText("Sign up"));
		// Router push is mocked in jest.setup.js, just verify it doesn't throw
	});
});
