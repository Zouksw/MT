import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock logger
vi.mock("@/utils/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe("Config Module", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		// Reset environment variables
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("JWT secret validation", () => {
		test("should throw error when JWT_SECRET is not set", async () => {
			delete process.env.JWT_SECRET;

			await expect(async () => {
				await import("../config");
			}).rejects.toThrow("JWT_SECRET is not set");
		});

		test("should throw error when JWT_SECRET is default value", async () => {
			process.env.JWT_SECRET = "your-super-secret-jwt-key-change-in-production";

			await expect(async () => {
				await import("../config");
			}).rejects.toThrow("SECURITY ERROR: Default JWT_SECRET detected");
		});

		test("should throw error when JWT_SECRET is too short", async () => {
			process.env.JWT_SECRET = "short";
			process.env.SESSION_SECRET = "a".repeat(32);

			await expect(async () => {
				await import("../config");
			}).rejects.toThrow(
				"SECURITY ERROR: JWT_SECRET must be at least 32 characters long",
			);
		});

		test("should accept valid JWT_SECRET", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);

			const config = await import("../config");

			expect(config.config.jwt.secret).toBe("a".repeat(32));
			expect(config.config.jwt.expiresIn).toBeDefined();
		});
	});

	describe("Session secret validation", () => {
		test("should throw error when SESSION_SECRET is not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			delete process.env.SESSION_SECRET;

			await expect(async () => {
				await import("../config");
			}).rejects.toThrow("SESSION_SECRET is not set");
		});

		test("should throw error when SESSION_SECRET is default value", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET =
				"CHANGE_THIS_TO_A_SECURE_BASE64_ENCODED_32_BYTE_SECRET";

			await expect(async () => {
				await import("../config");
			}).rejects.toThrow("SECURITY ERROR: Default SESSION_SECRET detected");
		});

		test("should accept valid SESSION_SECRET", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);

			const config = await import("../config");

			expect(config.config.session.secret).toBe("b".repeat(32));
			expect(config.config.session.expiresDays).toBe(30);
		});
	});

	describe("IoTDB credentials validation", () => {
		test("should use default IoTDB credentials when not set (with warning)", async () => {
			await import("../../utils/logger");

			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.IOTDB_USERNAME;
			delete process.env.IOTDB_PASSWORD;

			const config = await import("../config");

			expect(config.config.iotdb.username).toBe("root");
			expect(config.config.iotdb.password).toBe("root");
		});

		test("should warn when using default IoTDB credentials", async () => {
			const { logger } = await import("../../utils/logger");

			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			process.env.IOTDB_USERNAME = "root";
			process.env.IOTDB_PASSWORD = "password";

			await import("../config");

			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining(
					"SECURITY WARNING: Using default IoTDB credentials",
				),
			);
		});

		test("should accept custom IoTDB credentials", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			process.env.IOTDB_USERNAME = "customuser";
			process.env.IOTDB_PASSWORD = "custompass";

			const config = await import("../config");

			expect(config.config.iotdb.username).toBe("customuser");
			expect(config.config.iotdb.password).toBe("custompass");
		});
	});

	describe("Server configuration", () => {
		test("should use default port when not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.PORT;

			const config = await import("../config");

			expect(config.config.server.port).toBe(8000);
		});

		test("should use custom port when set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			process.env.PORT = "9000";

			const config = await import("../config");

			expect(config.config.server.port).toBe(9000);
		});

		test("should use default CORS origins when not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.CORS_ORIGIN;

			const config = await import("../config");

			expect(config.config.server.corsOrigin).toEqual([
				"http://localhost:3000",
				"http://localhost:3001",
				"http://localhost:3002",
			]);
		});

		test("should use development as default node env", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.NODE_ENV;

			const config = await import("../config");

			expect(config.config.server.nodeEnv).toBe("development");
		});
	});

	describe("IoTDB configuration", () => {
		test("should use default host and port when not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.IOTDB_HOST;
			delete process.env.IOTDB_PORT;

			const config = await import("../config");

			expect(config.config.iotdb.host).toBe("localhost");
			expect(config.config.iotdb.port).toBe(6667);
		});

		test("should use custom host and port when set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			process.env.IOTDB_HOST = "iotdb.example.com";
			process.env.IOTDB_PORT = "6668";

			const config = await import("../config");

			expect(config.config.iotdb.host).toBe("iotdb.example.com");
			expect(config.config.iotdb.port).toBe(6668);
		});

		test("should parse AI enabled flag correctly", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			process.env.IOTDB_AI_ENABLED = "true";

			const config = await import("../config");

			expect(config.config.iotdb.aiEnabled).toBe(true);
		});
	});

	describe("Redis configuration", () => {
		test("should use default Redis URL when not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.REDIS_URL;

			const config = await import("../config");

			expect(config.config.redis.url).toBe("redis://localhost:6379");
		});

		test("should be enabled by default", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.REDIS_ENABLED;

			const config = await import("../config");

			expect(config.config.redis.enabled).toBe(true);
		});

		test("should be disabled when REDIS_ENABLED is false", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			process.env.REDIS_ENABLED = "false";

			const config = await import("../config");

			expect(config.config.redis.enabled).toBe(false);
		});
	});

	describe("Email configuration", () => {
		test("should use default from address when not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.EMAIL_FROM;

			const config = await import("../config");

			expect(config.config.email.from).toBe("noreply@mt.com");
		});

		test("should use default SMTP port when not set", async () => {
			process.env.JWT_SECRET = "a".repeat(32);
			process.env.SESSION_SECRET = "b".repeat(32);
			delete process.env.SMTP_PORT;

			const config = await import("../config");

			expect(config.config.email.smtpPort).toBe(587);
		});
	});
});
