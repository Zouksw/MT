/**
 * Input Sanitization Module
 *
 * Provides XSS protection by sanitizing user input.
 * Uses DOMPurify for HTML sanitization and custom validators for other input types.
 */

// For Next.js client-side, DOMPurify works directly
// For server-side, we use a basic fallback (or you can add jsdom as devDependency if needed)

class InputSanitizer {
	/**
	 * Configuration for DOMPurify
	 */
	private readonly DOMPURIFY_CONFIG = {
		ALLOWED_TAGS: [
			"b",
			"i",
			"em",
			"strong",
			"a",
			"p",
			"br",
			"span",
			"ul",
			"ol",
			"li",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"blockquote",
			"code",
			"pre",
		],
		ALLOWED_ATTR: ["href", "title", "class", "target", "rel", "id"],
		ALLOW_DATA_ATTR: false,
		ALLOW_URI_PREFIXES: ["http://", "https://", "mailto:", "tel:"],
		ADD_ATTR: ["rel"], // Auto-add rel="noopener noreferrer" to links
		FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button"],
		FORBID_ATTR: ["onclick", "onerror", "onload"],
	};

	/**
	 * Sanitize HTML content to prevent XSS attacks
	 * @param dirty - Potentially unsafe HTML string
	 * @returns Sanitized HTML string
	 */
	sanitizeHtml(dirty: string): string {
		if (!dirty || typeof dirty !== "string") {
			return "";
		}

		// Client-side: Try to use DOMPurify if available, otherwise use fallback
		// Server-side: Use basic HTML escaping
		if (typeof window !== "undefined") {
			try {
				// Try to use DOMPurify from window if available (loaded by CDN or client-side)
				const purify = (
					window as unknown as {
						DOMPurify?: { sanitize: (dirty: string, config: Record<string, unknown>) => string };
					}
				).DOMPurify;
				if (purify) {
					return purify.sanitize(dirty, this.DOMPURIFY_CONFIG);
				}
			} catch {
				// Fall through to basic escaping
			}
		}

		// Server-side fallback - basic HTML escaping
		// For production, consider adding jsdom as a devDependency
		return this.escapeHtml(dirty);
	}

	/**
	 * Sanitize URL to prevent javascript: and other dangerous protocols
	 * @param url - URL to validate
	 * @returns Sanitized URL or # if invalid
	 */
	sanitizeUrl(url: string): string {
		if (!url || typeof url !== "string") {
			return "#";
		}

		try {
			const parsed = new URL(url);

			// Only allow http and https protocols
			if (!["http:", "https:"].includes(parsed.protocol)) {
				return "#";
			}

			// Prevent javascript: and data: URLs
			if (
				url.trim().toLowerCase().startsWith("javascript:") ||
				url.trim().toLowerCase().startsWith("data:")
			) {
				return "#";
			}

			return url;
		} catch {
			// Invalid URL format
			return "#";
		}
	}

	/**
   * Sanitize and validate numeric input
   * @param value - Value to sanitize
   * @param min - Minimum allowed value (optional)
   * @param max - Maximum allowed value (optional)
   @returns Sanitized number or null if invalid
   */
	sanitizeNumber(value: unknown, min?: number, max?: number): number | null {
		const num = Number(value);

		if (Number.isNaN(num) || !Number.isFinite(num)) {
			return null;
		}

		if (min !== undefined && num < min) return min;
		if (max !== undefined && num > max) return max;

		return num;
	}

	/**
	 * Sanitize string input by removing dangerous characters
	 * @param value - Value to sanitize
	 * @param maxLength - Maximum length (default 1000)
	 * @returns Sanitized string
	 */
	sanitizeString(value: unknown, maxLength: number = 1000): string {
		if (typeof value !== "string") {
			return "";
		}

		// Remove control characters (except newline, tab, carriage return)
		const controlChars = [
			String.fromCharCode(0),
			String.fromCharCode(1),
			String.fromCharCode(2),
			String.fromCharCode(3),
			String.fromCharCode(4),
			String.fromCharCode(5),
			String.fromCharCode(6),
			String.fromCharCode(7),
			String.fromCharCode(8),
			String.fromCharCode(11),
			String.fromCharCode(12),
			String.fromCharCode(14),
			String.fromCharCode(15),
			String.fromCharCode(16),
			String.fromCharCode(17),
			String.fromCharCode(18),
			String.fromCharCode(19),
			String.fromCharCode(20),
			String.fromCharCode(21),
			String.fromCharCode(22),
			String.fromCharCode(23),
			String.fromCharCode(24),
			String.fromCharCode(25),
			String.fromCharCode(26),
			String.fromCharCode(27),
			String.fromCharCode(28),
			String.fromCharCode(29),
			String.fromCharCode(30),
			String.fromCharCode(31),
			String.fromCharCode(127),
		].join("");
		const controlCharRegex = new RegExp(`[${controlChars}]`, "g");
		let cleaned = value.replace(controlCharRegex, "");

		// Limit length
		if (cleaned.length > maxLength) {
			cleaned = cleaned.substring(0, maxLength);
		}

		// HTML escape to prevent XSS when displayed as HTML
		cleaned = this.escapeHtml(cleaned);

		return cleaned.trim();
	}

	/**
	 * HTML escape special characters
	 * @param unsafe - Unsafe string
	 * @returns Escaped string
	 */
	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	/**
	 * Sanitize email address
	 * @param email - Email to validate
	 * @returns Lowercase trimmed email or empty string if invalid
	 */
	sanitizeEmail(email: string): string {
		if (!email || typeof email !== "string") {
			return "";
		}

		const trimmed = email.trim().toLowerCase();

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(trimmed)) {
			return "";
		}

		// Remove any potentially dangerous characters
		return trimmed.replace(/[<>]/g, "");
	}

	/**
   * Sanitize file name to prevent path traversal
   * @param filename - File name to sanitize
   @returns Sanitized file name
   */
	sanitizeFileName(filename: string): string {
		if (!filename || typeof filename !== "string") {
			return "";
		}

		// Remove path separators and dangerous characters
		let sanitized = filename
			.replace(/[/\\]/g, "") // Remove path separators
			.replace(/\.\./g, "") // Remove parent directory references
			.replace(/[<>:"|?*]/g, "") // Remove invalid filename characters
			.replace(/\s+/g, "_"); // Replace spaces with underscores

		// Limit length
		if (sanitized.length > 255) {
			sanitized = sanitized.substring(0, 255);
		}

		return sanitized || "";
	}

	/**
	 * Sanitize SQL-like input (basic protection)
	 * Note: This is NOT a replacement for parameterized queries!
	 * @param input - Input to sanitize
	 * @returns Sanitized input
	 */
	sanitizeSql(input: string): string {
		if (!input || typeof input !== "string") {
			return "";
		}

		// Remove common SQL injection patterns
		return input
			.replace(/['";\\]/g, "") // Remove quotes and backslashes
			.replace(/--/g, "") // Remove SQL comments
			.replace(/\/\*/g, "") // Remove SQL block comments
			.replace(/\*|\//g, "") // Remove remaining comment markers
			.trim();
	}

	/**
	 * Sanitize object keys recursively
	 * Useful for sanitizing API responses
	 * @param obj - Object to sanitize
	 * @returns Object with sanitized keys
	 */
	sanitizeObjectKeys<T extends Record<string, unknown>>(obj: T): T {
		const sanitized = {} as T;

		for (const key in obj) {
			if (Object.hasOwn(obj, key)) {
				const sanitizedKey = this.sanitizeString(key, 100);
				const value = obj[key];
				(sanitized as Record<string, unknown>)[sanitizedKey] =
					typeof value === "object" && value !== null
						? this.sanitizeObjectKeys(value as Record<string, unknown>)
						: value;
			}
		}

		return sanitized;
	}

	/**
	 * Validate JSON string
	 * @param json - JSON string to validate
	 * @returns Parsed object or null if invalid
	 */
	validateJson(json: string): unknown | null {
		if (!json || typeof json !== "string") {
			return null;
		}

		try {
			const parsed = JSON.parse(json);
			if (typeof parsed === "object" && parsed !== null) {
				return parsed;
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Strip HTML tags from string
	 * @param html - HTML string
	 * @returns Plain text without tags
	 */
	stripHtml(html: string): string {
		if (!html || typeof html !== "string") {
			return "";
		}

		// Client-side: Use DOMParser if available
		if (typeof window !== "undefined" && "DOMParser" in window) {
			const doc = new DOMParser().parseFromString(html, "text/html");
			return doc.body.textContent || "";
		}

		// Server-side fallback: Remove HTML tags
		return html.replace(/<[^>]*>/g, "");
	}

	/**
	 * Truncate text to specified length
	 * @param text - Text to truncate
	 * @param length - Maximum length
	 * @param suffix - Suffix to add (default: '...')
	 * @returns Truncated text
	 */
	truncate(text: string, length: number, suffix: string = "..."): string {
		if (!text || typeof text !== "string") {
			return "";
		}

		if (text.length <= length) {
			return text;
		}

		return text.substring(0, length - suffix.length) + suffix;
	}
}

// Export singleton instance
export const sanitizer = new InputSanitizer();

// Export type for use in components
export type { InputSanitizer };
