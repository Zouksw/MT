export interface ValidationRule {
	validate: (value: unknown, allValues?: Record<string, unknown>) => boolean;
	message: string;
	errorCode?: string;
}

class ValidationRules {
	email: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			// RFC 5322 compliant
			const emailRegex =
				/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
			return emailRegex.test(value);
		},
		message: "Please enter a valid email address (e.g., user@example.com)",
		errorCode: "INVALID_EMAIL",
	};

	passwordStrength: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
		},
		message:
			"Password must be at least 8 characters with uppercase, lowercase letters, and numbers",
		errorCode: "WEAK_PASSWORD",
	};

	passwordStrong: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(value);
		},
		message:
			"Password must be at least 12 characters with uppercase, lowercase, numbers, and special characters",
		errorCode: "WEAK_PASSWORD",
	};

	datasetName: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			return /^[a-zA-Z0-9_-]{1,50}$/.test(value);
		},
		message:
			"Dataset name can only contain letters, numbers, hyphens, and underscores (1-50 characters)",
		errorCode: "INVALID_NAME",
	};

	timeseriesPath: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			return /^root\.[a-zA-Z0-9_.]+(\.[a-zA-Z0-9_.]+)*$/.test(value);
		},
		message:
			'Path must start with "root." and contain only letters, numbers, dots, and underscores',
		errorCode: "INVALID_PATH",
	};

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

	port: ValidationRule = {
		validate: (value: unknown) => {
			const num = Number(value);
			if (Number.isNaN(num) || num < 1 || num > 65535) return false;
			return Number.isInteger(num);
		},
		message: "Port must be a number between 1 and 65535",
		errorCode: "INVALID_PORT",
	};

	phoneNumber: ValidationRule = {
		validate: (value: unknown) => {
			if (!value || typeof value !== "string") return false;
			return /^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s\-()]/g, ""));
		},
		message: "Please enter a valid phone number (e.g., +1234567890)",
		errorCode: "INVALID_PHONE",
	};

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

	getAntRule(rule: ValidationRule) {
		return {
			validator(_: unknown, value: unknown, source: Record<string, unknown>) {
				if (rule.validate(value, source)) {
					return Promise.resolve();
				}
				return Promise.reject(new Error(rule.message));
			},
		};
	}

	getAntRules(rules: ValidationRule[]) {
		return rules.map((rule) => this.getAntRule(rule));
	}

	validateAll(value: unknown, rules: ValidationRule[]): string | null {
		for (const rule of rules) {
			if (!rule.validate(value)) {
				return rule.message;
			}
		}
		return null;
	}
}

export const validationRules = new ValidationRules();

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
