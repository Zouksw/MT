/**
 * Validation Rules Module
 *
 * Provides reusable validation rules for form inputs.
 * Compatible with Ant Design Form validation and Zod schemas.
 */

/**
 * Validation Rule Interface
 * Defines the structure for a validation rule
 */
export interface ValidationRule {
	validate: (value: unknown, allValues?: Record<string, unknown>) => boolean;
	message: string;
	errorCode?: string;
}

/**
 * Validation Rules Class
 *
 * Contains all validation rules with customizable error messages
 */
class ValidationRules {
	/**
	 * Email validation
	 * Validates email format using RFC 5322 compliant regex
	 */
	email: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// RFC 5322 compliant email regex
			const emailRegex =
				/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
			return emailRegex.test(value);
		},
		message: "Please enter a valid email address (e.g., user@example.com)",
		errorCode: "INVALID_EMAIL",
	};

	/**
	 * Password strength validation
	 * Requires: 8+ characters, uppercase, lowercase, number
	 */
	passwordStrength: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// At least 8 chars, uppercase, lowercase, and number
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
			return passwordRegex.test(value);
		},
		message:
			"Password must be at least 8 characters with uppercase, lowercase letters, and numbers",
		errorCode: "WEAK_PASSWORD",
	};

	/**
	 * Password extended validation
	 * Includes special character requirement
	 */
	passwordStrong: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// 12+ chars, uppercase, lowercase, number, special char
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
			return passwordRegex.test(value);
		},
		message:
			"Password must be at least 12 characters with uppercase, lowercase, numbers, and special characters",
		errorCode: "WEAK_PASSWORD",
	};

	/**
	 * Dataset name validation
	 * Only allows letters, numbers, hyphens, and underscores
	 */
	datasetName: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// 1-50 chars, alphanumeric, hyphens, underscores
			const nameRegex = /^[a-zA-Z0-9_-]{1,50}$/;
			return nameRegex.test(value);
		},
		message:
			"Dataset name can only contain letters, numbers, hyphens, and underscores (1-50 characters)",
		errorCode: "INVALID_NAME",
	};

	/**
		 * Commodity ID validation
		 * Must be a non-empty string with valid characters



	 */
	timeseriesPath: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// Must start with root., valid chars after
			const pathRegex = /^root\.[a-zA-Z0-9_.]+(\.[a-zA-Z0-9_.]+)*$/;
			return pathRegex.test(value);
		},
		message:
			'Path must start with "root." and contain only letters, numbers, dots, and underscores',
		errorCode: "INVALID_PATH",
	};

	/**
	 * URL validation
	 * Validates that a string is a properly formatted URL
	 */
	url: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			try {
				new URL(value);
				return true;
			} catch {
				return false;
			}
		},
		message: "Please enter a valid URL (e.g., https://example.com)",
		errorCode: "INVALID_URL",
	};

	/**
	 * Port number validation
	 * Validates port ranges 1-65535
	 */
	port: ValidationRule = {
		validate: (value: unknown) => {
			const num = Number(value);
			if (Number.isNaN(num) || num < 1 || num > 65535) return false;
			return Number.isInteger(num);
		},
		message: "Port must be a number between 1 and 65535",
		errorCode: "INVALID_PORT",
	};

	/**
	 * Phone number validation
	 * Supports international formats (E.164)
	 */
	phoneNumber: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// Basic phone validation (international format)
			const phoneRegex = /^\+?[1-9]\d{1,14}$/;
			return phoneRegex.test(value.replace(/[\s\-()]/g, ""));
		},
		message: "Please enter a valid phone number (e.g., +1234567890)",
		errorCode: "INVALID_PHONE",
	};

	/**
	 * Number range validation
	 * Factory method to create a range validator
	 */
	createRangeValidator(min: number, max: number, fieldName = "value"): ValidationRule {
		return {
			validate: (value: unknown) => {
				const num = Number(value);
				if (Number.isNaN(num)) return false;
				return num >= min && num <= max;
			},
			message: `${fieldName} must be between ${min} and ${max}`,
			errorCode: "OUT_OF_RANGE",
		};
	}

	/**
	 * Min length validation
	 * Factory method to create a min length validator
	 */
	createMinLengthValidator(min: number, fieldName = "value"): ValidationRule {
		return {
			validate: (value: unknown) => {
				if (typeof value !== "string") return false;
				return value.length >= min;
			},
			message: `${fieldName} must be at least ${min} characters`,
			errorCode: "TOO_SHORT",
		};
	}

	/**
	 * Max length validation
	 * Factory method to create a max length validator
	 */
	createMaxLengthValidator(max: number, fieldName = "value"): ValidationRule {
		return {
			validate: (value: unknown) => {
				if (typeof value !== "string") return false;
				return value.length <= max;
			},
			message: `${fieldName} must not exceed ${max} characters`,
			errorCode: "TOO_LONG",
		};
	}

	/**
	 * Pattern validation
	 * Factory method to create a regex pattern validator
	 */
	createPatternValidator(
		pattern: RegExp,
		errorMessage: string,
		errorCode: string = "PATTERN_MISMATCH",
	): ValidationRule {
		return {
			validate: (value: unknown) => {
				if (typeof value !== "string") return false;
				return pattern.test(value);
			},
			message: errorMessage,
			errorCode,
		};
	}

	/**
	 * Convert validation rule to Ant Design Form rule format
	 * @param rule - The validation rule to convert
	 * @returns Ant Design validator function
	 */
	getAntRule(rule: ValidationRule) {
		return {
			validator(_: unknown, value: unknown, source: Record<string, unknown>) {
				// Pass source to validation rules that need it (like confirmation)
				if (rule.validate(value, source)) {
					return Promise.resolve();
				}
				return Promise.reject(new Error(rule.message));
			},
		};
	}

	/**
	 * Convert multiple rules to Ant Design format
	 * @param rules - Array of validation rules
	 * @returns Array of Ant Design validators
	 */
	getAntRules(rules: ValidationRule[]) {
		return rules.map((rule) => this.getAntRule(rule));
	}

	/**
	 * Validate a value against multiple rules
	 * Returns the first error message found, or null if all pass
	 */
	validateAll(value: unknown, rules: ValidationRule[]): string | null {
		for (const rule of rules) {
			if (!rule.validate(value)) {
				return rule.message;
			}
		}
		return null;
	}
}

// Export singleton instance
export const validationRules = new ValidationRules();

/**
 * Common rule sets for quick use
 */
export const commonRules = {
	auth: {
		email: validationRules.email,
		password: validationRules.passwordStrength,
	},
	dataset: {
		name: validationRules.datasetName,
	},
	timeseries: {
		path: validationRules.timeseriesPath,
	},
	network: {
		url: validationRules.url,
		port: validationRules.port,
	},
};

/**
 * Helper function to create a required field rule
 */
export function required(fieldName: string = "This field"): ValidationRule {
	return {
		validate: (value: unknown) => {
			if (typeof value === "string") {
				return value.trim().length > 0;
			}
			return value != null && value !== undefined;
		},
		message: `${fieldName} is required`,
		errorCode: "REQUIRED",
	};
}

/**
 * Helper function to create a confirmation rule
 */
export function confirmation(matchFieldName: string): ValidationRule {
	return {
		validate: (value: unknown, allValues?: Record<string, unknown>) => {
			if (!allValues) return false;
			const matchValue = allValues[matchFieldName];
			return value === matchValue;
		},
		message: `Must match ${matchFieldName}`,
		errorCode: "CONFIRMATION_MISMATCH",
	};
}
