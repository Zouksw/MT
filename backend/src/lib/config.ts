/**
 * Centralized configuration management
 * Validates environment variables at startup
 */

import { logger } from "@/utils/logger";

// Default secrets that should NOT be used in production
const DEFAULT_SECRETS = [
	"your-super-secret-jwt-key-change-in-production",
	"your-super-secret-session-key-change-in-production",
	"CHANGE_THIS_TO_A_SECURE_BASE64_ENCODED_32_BYTE_SECRET",
];

// Validate secret is not a default value
function validateSecret(secret: string | undefined, name: string): void {
	if (!secret) {
		throw new Error(`${name} is not set in environment variables`);
	}
	if (DEFAULT_SECRETS.includes(secret)) {
		throw new Error(
			`SECURITY ERROR: Default ${name} detected. Please generate a secure secret using:\n` +
				`  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
		);
	}
	if (secret.length < 32) {
		throw new Error(`SECURITY ERROR: ${name} must be at least 32 characters long`);
	}
}

// Initialize and validate configuration
export const config = {
	jwt: {
		secret: (() => {
			const secret = process.env.JWT_SECRET;
			validateSecret(secret, "JWT_SECRET");
			// biome-ignore lint/style/noNonNullAssertion: validateSecret throws if secret is undefined
			return secret!;
		})(),
		expiresIn: process.env.JWT_EXPIRES_IN || "7d",
	},

	session: {
		secret: (() => {
			const secret = process.env.SESSION_SECRET;
			validateSecret(secret, "SESSION_SECRET");
			// biome-ignore lint/style/noNonNullAssertion: validateSecret throws if secret is undefined
			return secret!;
		})(),
		expiresDays: 30,
	},

	server: {
		port: parseInt(process.env.PORT || "8000", 10),
		corsOrigin: process.env.CORS_ORIGIN
			? Array.isArray(process.env.CORS_ORIGIN)
				? process.env.CORS_ORIGIN
				: process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
			: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
		nodeEnv: process.env.NODE_ENV || "development",
		swaggerEnabled: process.env.SWAGGER_ENABLED === "true" || process.env.NODE_ENV !== "production",
	},

	inference: {
		url: process.env.INFERENCE_URL || "http://localhost:10810",
		timeout: parseInt(process.env.INFERENCE_TIMEOUT || "120000", 10),
	},

	redis: {
		url: process.env.REDIS_URL || "redis://localhost:6379",
		enabled: process.env.REDIS_ENABLED !== "false",
	},

	email: {
		smtpHost: process.env.SMTP_HOST,
		smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
		smtpUser: process.env.SMTP_USER,
		smtpPass: process.env.SMTP_PASS,
		from: process.env.EMAIL_FROM || "noreply@mt.com",
	},

	dataIngestion: {
		exchangeRateApiUrl:
			process.env.EXCHANGE_RATE_API_URL || "https://open.er-api.com/v6/latest/USD",
		scrapeIntervalMinutes: parseInt(process.env.SCRAPE_INTERVAL_MINUTES || "60", 10),
		importMaxFileSize: parseInt(process.env.IMPORT_MAX_FILE_SIZE || "10485760", 10),
	},
} as const;

// Log configuration status (without secrets)
logger.info("Configuration loaded", {
	jwt: { secretSet: !!config.jwt.secret, expiresIn: config.jwt.expiresIn },
	session: {
		secretSet: !!config.session.secret,
		expiresDays: config.session.expiresDays,
	},
	server: { port: config.server.port, nodeEnv: config.server.nodeEnv },
	inference: {
		url: config.inference.url,
		timeout: config.inference.timeout,
	},
	redis: { enabled: config.redis.enabled },
	email: { configured: !!config.email.smtpHost },
	dataIngestion: { scrapeInterval: config.dataIngestion.scrapeIntervalMinutes },
});

export default config;
