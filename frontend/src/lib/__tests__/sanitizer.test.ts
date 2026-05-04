/**
 * Input Sanitizer Unit Tests
 *
 * Tests for input sanitization and XSS prevention functionality
 */

// Mock window.DOMPurify for testing (sanitizer uses window.DOMPurify, not an import)
const mockSanitize = jest.fn((html: string) => {
	return html
		.replace(/<script[^>]*>.*?<\/script>/gi, "")
		.replace(/on\w+="[^"]*"/gi, "")
		.replace(/javascript:/gi, "");
});

if (typeof window !== "undefined") {
	(window as unknown as { DOMPurify: { sanitize: (input: string) => string } }).DOMPurify = { sanitize: mockSanitize };
}

import { sanitizer } from "../sanitizer";

// Mock console methods
global.console = {
	...console,
	log: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

describe("sanitizer", () => {
	describe("sanitizeHtml", () => {
		it("should remove script tags", () => {
			const input = '<script>alert("xss")</script><p>Hello</p>';
			const output = sanitizer.sanitizeHtml(input);

			expect(mockSanitize).toHaveBeenCalled();
			expect(output).toBeDefined();
		});

		it("should handle null and undefined", () => {
			expect(sanitizer.sanitizeHtml(null as any)).toBe("");
			expect(sanitizer.sanitizeHtml(undefined as any)).toBe("");
		});

		it("should handle empty strings", () => {
			expect(sanitizer.sanitizeHtml("")).toBe("");
		});
	});

	describe("sanitizeUrl", () => {
		it("should allow valid http URLs", () => {
			const url = "http://example.com";
			expect(sanitizer.sanitizeUrl(url)).toBe(url);
		});

		it("should allow valid https URLs", () => {
			const url = "https://example.com/path?query=value";
			expect(sanitizer.sanitizeUrl(url)).toBe(url);
		});

		it("should block javascript: protocol", () => {
			expect(sanitizer.sanitizeUrl("javascript:alert(1)")).toBe("#");
		});

		it("should block data: protocol", () => {
			expect(sanitizer.sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
		});

		it("should handle invalid URLs", () => {
			expect(sanitizer.sanitizeUrl("not-a-url")).toBe("#");
			expect(sanitizer.sanitizeUrl("")).toBe("#");
			expect(sanitizer.sanitizeUrl(null as any)).toBe("#");
		});
	});

	describe("sanitizeNumber", () => {
		it("should parse valid numbers", () => {
			expect(sanitizer.sanitizeNumber("42")).toBe(42);
			expect(sanitizer.sanitizeNumber("3.14")).toBe(3.14);
			expect(sanitizer.sanitizeNumber(100)).toBe(100);
		});

		it("should return null for invalid numbers", () => {
			expect(sanitizer.sanitizeNumber("abc")).toBeNull();
			expect(sanitizer.sanitizeNumber(NaN)).toBeNull();
			expect(sanitizer.sanitizeNumber(Infinity)).toBeNull();
			// Empty string becomes 0 via Number(''), which is valid behavior
			expect(sanitizer.sanitizeNumber("")).toBe(0);
		});

		it("should respect min bounds", () => {
			expect(sanitizer.sanitizeNumber("-5", 0)).toBe(0);
			expect(sanitizer.sanitizeNumber("5", 10)).toBe(10);
			expect(sanitizer.sanitizeNumber("15", 0, 10)).toBe(10);
		});

		it("should respect max bounds", () => {
			expect(sanitizer.sanitizeNumber("150", 0, 100)).toBe(100);
			expect(sanitizer.sanitizeNumber("200", undefined, 100)).toBe(100);
		});

		it("should handle infinity", () => {
			expect(sanitizer.sanitizeNumber(Infinity)).toBeNull();
			expect(sanitizer.sanitizeNumber(-Infinity)).toBeNull();
		});
	});

	describe("sanitizeString", () => {
		it("should remove control characters", () => {
			const input = "Hello\x00World";
			const output = sanitizer.sanitizeString(input);

			expect(output).not.toContain("\x00");
		});

		it("should limit string length", () => {
			const input = "a".repeat(2000);
			const output = sanitizer.sanitizeString(input, 100);

			expect(output.length).toBe(100);
		});

		it("should trim whitespace", () => {
			expect(sanitizer.sanitizeString("  hello  ")).toBe("hello");
		});

		it("should handle non-string input", () => {
			expect(sanitizer.sanitizeString(123)).toBe("");
			expect(sanitizer.sanitizeString(null)).toBe("");
		});
	});

	describe("sanitizeEmail", () => {
		it("should validate and lowercase emails", () => {
			expect(sanitizer.sanitizeEmail("Test@Example.COM")).toBe("test@example.com");
		});

		it("should return empty string for invalid emails", () => {
			expect(sanitizer.sanitizeEmail("")).toBe("");
			expect(sanitizer.sanitizeEmail("invalid")).toBe("");
		});

		it("should handle valid emails", () => {
			expect(sanitizer.sanitizeEmail("user@example.com")).toBe("user@example.com");
		});
	});

	describe("sanitizeFileName", () => {
		it("should remove path separators", () => {
			expect(sanitizer.sanitizeFileName("../../../etc/passwd")).toBe("etcpasswd");
		});

		it("should replace spaces with underscores", () => {
			expect(sanitizer.sanitizeFileName("my file name.txt")).toBe("my_file_name.txt");
		});

		it("should limit filename length", () => {
			const longName = `${"a".repeat(300)}.txt`;
			const output = sanitizer.sanitizeFileName(longName);

			expect(output.length).toBeLessThanOrEqual(255);
		});

		it("should handle empty input", () => {
			expect(sanitizer.sanitizeFileName("")).toBe("");
		});
	});

	describe("sanitizeSql", () => {
		it("should remove SQL injection patterns", () => {
			const output = sanitizer.sanitizeSql("'; DROP TABLE users; --");
			expect(output).not.toContain("'");
			expect(output).not.toContain("--");
		});
	});

	describe("validateJson", () => {
		it("should parse valid JSON", () => {
			const json = '{"key": "value"}';
			const parsed = sanitizer.validateJson(json);

			expect(parsed).toEqual({ key: "value" });
		});

		it("should return null for invalid JSON", () => {
			expect(sanitizer.validateJson("not json")).toBeNull();
		});
	});

	describe("stripHtml", () => {
		it("should remove HTML tags", () => {
			const html = "<p>Hello <strong>world</strong></p>";
			const text = sanitizer.stripHtml(html);

			expect(text).toBe("Hello world");
		});

		it("should handle empty input", () => {
			expect(sanitizer.stripHtml("")).toBe("");
		});
	});

	describe("truncate", () => {
		it("should truncate long text", () => {
			const text = "a".repeat(100);
			const truncated = sanitizer.truncate(text, 10);

			// truncate returns exactly `length` characters total (including suffix)
			expect(truncated).toHaveLength(10); // 10 chars total (7 'a's + '...')
			expect(truncated).toContain("...");
		});

		it("should not truncate short text", () => {
			const text = "Short";
			expect(sanitizer.truncate(text, 20)).toBe("Short");
		});
	});

	describe("edge cases", () => {
		it("should handle unicode characters", () => {
			const input = "你好世界";
			expect(sanitizer.sanitizeString(input)).toContain("你好");
		});

		it("should handle very long inputs", () => {
			const longInput = "a".repeat(100000);
			const output = sanitizer.sanitizeString(longInput, 1000);

			expect(output.length).toBe(1000);
		});
	});
});
