/**
 * Audit Logger Unit Tests
 *
 * Tests for security audit logging functionality
 */

import { auditLogger, logApiEvents, logAuthEvents } from "../auditLogger";

// Don't mock console methods for now to see debug output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Mock fetch - reject to keep logs in buffer for testing
global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

// Mock Cookies
jest.mock("js-cookie", () => ({
	default: {
		get: jest.fn(),
	},
}));

describe("auditLogger", () => {
	beforeEach(() => {
		// Reset logger state and ensure it's enabled
		auditLogger.clearLogs();
		// Set both enabled and maxBufferSize together
		auditLogger.updateConfig({ enabled: true, maxBufferSize: 100 });

		// Clear mocks
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Cleanup - don't call destroy as it flushes and clears logs
		auditLogger.clearLogs();
	});

	describe("log", () => {
		it("should add log to buffer", () => {
			auditLogger.clearLogs();
			auditLogger.log("LOGIN_SUCCESS", { email: "test@example.com" }, "low");

			const logs = auditLogger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].event).toBe("LOGIN_SUCCESS");
		});

		it("should sanitize sensitive details", () => {
			auditLogger.clearLogs();
			auditLogger.log(
				"LOGIN_FAILURE",
				{
					email: "test@example.com",
					password: "secret123",
					token: "abc123",
				},
				"medium",
			);

			const logs = auditLogger.getLogs();
			expect(logs[0].details.password).toBe("[REDACTED]");
			expect(logs[0].details.token).toBe("[REDACTED]");
			expect(logs[0].details.email).toBe("test@example.com");
		});

		it("should not exceed max buffer size", () => {
			auditLogger.clearLogs();
			auditLogger.updateConfig({ maxBufferSize: 5 });

			for (let i = 0; i < 10; i++) {
				auditLogger.log("API_ERROR", { index: i }, "low");
			}

			const logs = auditLogger.getLogs();
			expect(logs.length).toBeLessThanOrEqual(5);
		});

		it("should include timestamp", () => {
			auditLogger.clearLogs();
			const beforeTime = Date.now();
			auditLogger.log("LOGIN_SUCCESS", {}, "low");
			const afterTime = Date.now();

			const logs = auditLogger.getLogs();
			expect(logs[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(logs[0].timestamp).toBeLessThanOrEqual(afterTime);
		});

		it("should include severity level", async () => {
			auditLogger.clearLogs();

			// Use low severity to avoid immediate flush
			auditLogger.log("XSS_ATTEMPT", {}, "low");
			auditLogger.log("LOGIN_FAILURE", {}, "medium");

			const logs = auditLogger.getLogs();
			expect(logs.some((l) => l.severity === "low")).toBe(true);
			expect(logs.some((l) => l.severity === "medium")).toBe(true);
		});
	});

	describe("clearLogs", () => {
		it("should clear all buffered logs", () => {
			auditLogger.clearLogs();
			auditLogger.log("LOGIN_SUCCESS", {}, "low");
			auditLogger.log("LOGOUT", {}, "low");

			expect(auditLogger.getLogs()).toHaveLength(2);

			auditLogger.clearLogs();

			expect(auditLogger.getLogs()).toHaveLength(0);
		});
	});

	describe("flush", () => {
		it("should send logs to server", async () => {
			auditLogger.clearLogs();
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
			});

			auditLogger.log("LOGIN_SUCCESS", {}, "low");
			auditLogger.log("LOGOUT", {}, "low");

			// Manually trigger flush
			await auditLogger.flush?.();

			expect(global.fetch).toHaveBeenCalledWith(
				"/api/security/audit",
				expect.objectContaining({
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
				}),
			);
		});

		it("should clear buffer after successful send", async () => {
			auditLogger.clearLogs();
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
			});

			auditLogger.log("LOGIN_SUCCESS", {}, "low");

			await auditLogger.flush?.();

			expect(auditLogger.getLogs()).toHaveLength(0);
		});

		it("should keep logs on send failure", async () => {
			auditLogger.clearLogs();
			(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

			auditLogger.log("LOGIN_SUCCESS", {}, "low");
			const beforeCount = auditLogger.getLogs().length;

			await auditLogger.flush?.();

			expect(auditLogger.getLogs().length).toBe(beforeCount);
		});
	});

	describe("updateConfig", () => {
		it("should update configuration", () => {
			auditLogger.updateConfig({
				maxBufferSize: 50,
				flushInterval: 60000,
			});

			const state = auditLogger.getLogs();
			// Just verify no errors thrown
			expect(state).toBeDefined();
		});
	});

	describe("logAuthEvents", () => {
		it("should log login success", () => {
			auditLogger.clearLogs();
			logAuthEvents.loginSuccess("test@example.com");

			const logs = auditLogger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].event).toBe("LOGIN_SUCCESS");
		});

		it("should log login failure", () => {
			auditLogger.clearLogs();
			logAuthEvents.loginFailure("test@example.com", "invalid_credentials");

			const logs = auditLogger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].event).toBe("LOGIN_FAILURE");
			expect(logs[0].details.reason).toBe("invalid_credentials");
		});

		it("should log logout", () => {
			auditLogger.clearLogs();
			logAuthEvents.logout();

			const logs = auditLogger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].event).toBe("LOGOUT");
		});
	});

	describe("logSecurityEvents", () => {
		it("should log CSRF violation", async () => {
			auditLogger.clearLogs();

			// Critical severity triggers immediate flush
			auditLogger.log("CSRF_VIOLATION", { url: "http://example.com" }, "critical");

			// Wait for flush to complete (logs will be put back due to mock rejection)
			await new Promise((resolve) => setTimeout(resolve, 10));

			const logs = auditLogger.getLogs();
			expect(logs.length).toBeGreaterThanOrEqual(1);
			const csrfLog = logs.find((l) => l.event === "CSRF_VIOLATION");
			expect(csrfLog).toBeDefined();
			expect(csrfLog?.severity).toBe("critical");
		});

		it("should log XSS attempt", async () => {
			auditLogger.clearLogs();

			auditLogger.log("XSS_ATTEMPT", { payload: "<script>alert(1)</script>" }, "critical");

			// Wait for flush
			await new Promise((resolve) => setTimeout(resolve, 10));

			const logs = auditLogger.getLogs();
			expect(logs.length).toBeGreaterThanOrEqual(1);
			expect(logs[0].event).toBe("XSS_ATTEMPT");
			expect(logs[0].severity).toBe("critical");
		});

		it("should log rate limit exceeded", async () => {
			auditLogger.clearLogs();

			auditLogger.log("RATE_LIMIT_EXCEEDED", { endpoint: "/api/login" }, "high");

			// Wait for flush
			await new Promise((resolve) => setTimeout(resolve, 10));

			const logs = auditLogger.getLogs();
			expect(logs.length).toBeGreaterThanOrEqual(1);
			const rateLimitLog = logs.find((l) => l.event === "RATE_LIMIT_EXCEEDED");
			expect(rateLimitLog).toBeDefined();
			expect(rateLimitLog?.severity).toBe("high");
		});
	});

	describe("logApiEvents", () => {
		it("should log API error", () => {
			auditLogger.clearLogs();
			logApiEvents.apiError("/api/data", 500, "Internal server error");

			const logs = auditLogger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].event).toBe("API_ERROR");
			expect(logs[0].details.endpoint).toBe("/api/data");
			expect(logs[0].details.status).toBe(500);
		});

		it("should log network error", () => {
			auditLogger.clearLogs();
			logApiEvents.networkError("/api/data");

			const logs = auditLogger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].event).toBe("NETWORK_ERROR");
		});
	});
});
