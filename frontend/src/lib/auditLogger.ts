/**
 * Security Audit Logger
 *
 * Logs security-related events for monitoring and forensic analysis.
 * Events are buffered and sent to the server for persistence.
 */

import Cookies from "js-cookie";

/**
 * Security event types that should be logged
 */
export type SecurityEvent =
	| "LOGIN_SUCCESS"
	| "LOGIN_FAILURE"
	| "LOGOUT"
	| "TOKEN_EXPIRED"
	| "TOKEN_REFRESHED"
	| "CSRF_VIOLATION"
	| "XSS_ATTEMPT"
	| "RATE_LIMIT_EXCEEDED"
	| "PERMISSION_DENIED"
	| "SUSPICIOUS_ACTIVITY"
	| "INVALID_INPUT"
	| "API_ERROR"
	| "NETWORK_ERROR";

/**
 * Audit log entry structure
 */
export interface AuditLog {
	event: SecurityEvent;
	timestamp: number;
	userId?: string;
	sessionId: string;
	details: Record<string, any>;
	severity: "low" | "medium" | "high" | "critical";
	userAgent?: string;
	url?: string;
}

/**
 * Configuration for audit logger
 */
interface AuditLoggerConfig {
	maxBufferSize: number;
	flushInterval: number;
	endpoint: string;
	enabled: boolean;
}

/**
 * Security Audit Logger
 *
 * Captures security events and sends them to the monitoring backend.
 * Features:
 * - In-memory buffering
 * - Automatic flushing on interval
 * - High-priority events sent immediately
 * - Sensitive data filtering
 */
class SecurityAuditLogger {
	private logs: AuditLog[] = [];
	private config: AuditLoggerConfig = {
		maxBufferSize: 100,
		flushInterval: 30000, // 30 seconds
		endpoint: "/api/security/audit",
		enabled: true, // Always enabled for testing
	};

	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private sessionId: string;

	constructor() {
		this.sessionId = this.generateSessionId();
		this.startFlushTimer();
	}

	/**
	 * Log a security event
	 * @param event - Type of security event
	 * @param details - Additional event details
	 * @param severity - Event severity level
	 */
	log(
		event: SecurityEvent,
		details: Record<string, any> = {},
		severity: "low" | "medium" | "high" | "critical" = "low",
	): void {
		if (!this.config.enabled) {
			return;
		}

		const log: AuditLog = {
			event,
			timestamp: Date.now(),
			userId: this.getCurrentUserId(),
			sessionId: this.sessionId,
			details: this.sanitizeDetails(details),
			severity,
			userAgent: typeof window !== "undefined" ? navigator.userAgent : undefined,
			url: typeof window !== "undefined" ? window.location.href : undefined,
		};

		this.logs.push(log);

		// Keep buffer size under limit
		if (this.logs.length > this.config.maxBufferSize) {
			this.logs.shift();
		}

		// High/critical severity events should be sent immediately
		if (severity === "high" || severity === "critical") {
			this.flush();
		}

		// Development logging
		if (process.env.NODE_ENV === "development") {
			// eslint-disable-next-line no-console
			console.log("[Security Audit]", log);
		}
	}

	/**
	 * Flush all buffered logs to the server
	 */
	async flush(): Promise<void> {
		if (this.logs.length === 0) {
			return;
		}

		const logsToSend = [...this.logs];
		this.logs = [];

		try {
			const response = await fetch(this.config.endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ logs: logsToSend }),
				credentials: "include",
			});

			if (!response.ok) {
				// Log failed to send - put back in buffer
				this.logs = [...logsToSend, ...this.logs];
			}
		} catch (error) {
			// Network error - put logs back in buffer
			this.logs = [...logsToSend, ...this.logs];

			if (process.env.NODE_ENV === "development") {
				// eslint-disable-next-line no-console
				console.error("[Security Audit] Failed to send logs:", error);
			}
		}
	}

	/**
	 * Start automatic flush timer
	 */
	private startFlushTimer(): void {
		if (typeof window === "undefined") {
			return;
		}

		this.flushTimer = window.setInterval(() => {
			this.flush();
		}, this.config.flushInterval) as unknown as ReturnType<typeof setInterval>;
	}

	/**
	 * Stop automatic flush timer
	 */
	private stopFlushTimer(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
	}

	/**
	 * Get current user ID from session
	 */
	private getCurrentUserId(): string | undefined {
		try {
			const userStr = Cookies.get("user");
			if (userStr) {
				const user = JSON.parse(userStr);
				return user.id;
			}
		} catch {
			// Ignore parsing errors
		}
		return undefined;
	}

	/**
	 * Generate unique session ID
	 */
	private generateSessionId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
	}

	/**
	 * Remove sensitive information from log details
	 */
	private sanitizeDetails(details: Record<string, any>): Record<string, any> {
		const sensitiveKeys = ["password", "token", "secret", "apiKey", "creditCard", "ssn"];
		const sanitized = { ...details };

		for (const key of sensitiveKeys) {
			if (key in sanitized) {
				sanitized[key] = "[REDACTED]";
			}
		}

		return sanitized;
	}

	/**
	 * Get all buffered logs (for debugging)
	 */
	getLogs(): AuditLog[] {
		return [...this.logs];
	}

	/**
	 * Clear all buffered logs
	 */
	clearLogs(): void {
		this.logs = [];
	}

	/**
	 * Update logger configuration
	 */
	updateConfig(config: Partial<AuditLoggerConfig>): void {
		// Merge with existing config, ensuring all properties are preserved
		this.config = {
			maxBufferSize:
				config.maxBufferSize !== undefined ? config.maxBufferSize : this.config.maxBufferSize,
			flushInterval:
				config.flushInterval !== undefined ? config.flushInterval : this.config.flushInterval,
			endpoint: config.endpoint !== undefined ? config.endpoint : this.config.endpoint,
			enabled: config.enabled !== undefined ? config.enabled : this.config.enabled,
		};

		if (config.flushInterval !== undefined) {
			this.stopFlushTimer();
			this.startFlushTimer();
		}
	}

	/**
	 * Force flush logs before cleanup
	 */
	destroy(): void {
		this.stopFlushTimer();
		this.flush();
	}
}

// Export singleton instance
export const auditLogger = new SecurityAuditLogger();

// Flush logs when page is unloaded
if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", () => {
		auditLogger.destroy();
	});
}

// Convenience methods for common events
export const logAuthEvents = {
	loginSuccess: (email?: string) => {
		auditLogger.log("LOGIN_SUCCESS", { email }, "low");
	},

	loginFailure: (email: string, reason: string) => {
		auditLogger.log("LOGIN_FAILURE", { email, reason }, "medium");
	},

	logout: () => {
		auditLogger.log("LOGOUT", {}, "low");
	},

	tokenExpired: (reason?: string) => {
		auditLogger.log("TOKEN_EXPIRED", { reason }, "high");
	},

	tokenRefreshed: () => {
		auditLogger.log("TOKEN_REFRESHED", {}, "low");
	},
};

export const logSecurityEvents = {
	csrfViolation: (details?: Record<string, any>) => {
		auditLogger.log("CSRF_VIOLATION", details || {}, "critical");
	},

	xssAttempt: (details?: Record<string, any>) => {
		auditLogger.log("XSS_ATTEMPT", details || {}, "critical");
	},

	rateLimitExceeded: (endpoint: string) => {
		auditLogger.log("RATE_LIMIT_EXCEEDED", { endpoint }, "high");
	},

	permissionDenied: (resource: string, action: string) => {
		auditLogger.log("PERMISSION_DENIED", { resource, action }, "medium");
	},

	suspiciousActivity: (description: string) => {
		auditLogger.log("SUSPICIOUS_ACTIVITY", { description }, "high");
	},

	invalidInput: (field: string, reason: string) => {
		auditLogger.log("INVALID_INPUT", { field, reason }, "low");
	},
};

export const logApiEvents = {
	apiError: (endpoint: string, status: number, message: string) => {
		auditLogger.log("API_ERROR", { endpoint, status, message }, "medium");
	},

	networkError: (endpoint: string) => {
		auditLogger.log("NETWORK_ERROR", { endpoint }, "medium");
	},
};
