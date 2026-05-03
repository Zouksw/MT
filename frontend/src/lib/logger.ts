/**
 * Simple Logger for Frontend
 *
 * Provides logging with environment-aware output levels.
 * In production, only warnings and errors are logged.
 * In development, all logs are shown.
 */

interface LoggerInterface {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

class Logger implements LoggerInterface {
	private isDev: boolean;

	constructor() {
		this.isDev = process.env.NODE_ENV === "development";
	}

	debug(message: string, ...args: unknown[]): void {
		if (this.isDev) {
			// eslint-disable-next-line no-console
			console.log(`[DEBUG] ${message}`, ...args);
		}
	}

	info(message: string, ...args: unknown[]): void {
		if (this.isDev) {
			// eslint-disable-next-line no-console
			console.log(`[INFO] ${message}`, ...args);
		}
	}

	warn(message: string, ...args: unknown[]): void {
		// Always log warnings
		// eslint-disable-next-line no-console
		console.warn(`[WARN] ${message}`, ...args);
	}

	error(message: string, ...args: unknown[]): void {
		// Always log errors
		// eslint-disable-next-line no-console
		console.error(`[ERROR] ${message}`, ...args);
	}
}

export const logger = new Logger();

/**
 * Context-specific loggers
 */
export const createLogger = (context: string) => ({
	debug: (message: string, ...args: unknown[]) => logger.debug(`[${context}] ${message}`, ...args),
	info: (message: string, ...args: unknown[]) => logger.info(`[${context}] ${message}`, ...args),
	warn: (message: string, ...args: unknown[]) => logger.warn(`[${context}] ${message}`, ...args),
	error: (message: string, ...args: unknown[]) => logger.error(`[${context}] ${message}`, ...args),
});

// Export context loggers
export const authLogger = createLogger("AUTH");
export const apiLogger = createLogger("API");
export const storageLogger = createLogger("STORAGE");
export const csrfLogger = createLogger("CSRF");
export const rateLimitLogger = createLogger("RATE_LIMIT");
