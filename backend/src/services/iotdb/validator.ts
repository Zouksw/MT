/**
 * IoTDB Validation Utilities
 *
 * Provides validation functions for IoTDB paths, names, and parameters
 * to prevent SQL injection and ensure data integrity.
 */

/**
 * Escape SQL identifier (backtick escape for IoTDB)
 * IoTDB uses backticks for identifiers
 * Escape internal backticks by doubling them
 */
export function escapeId(identifier: string): string {
	return `\`${identifier.replace(/`/g, "``")}\``;
}

/**
 * Escape string values for IoTDB SQL queries
 * Provides comprehensive escaping to prevent SQL injection
 */
export function escapeString(value: string): string {
	// Convert to string if not already
	const str = String(value);

	// Escape backslashes first (before escaping other characters)
	let escaped = str.replace(/\\/g, "\\\\");

	// Escape single quotes by doubling them
	escaped = escaped.replace(/'/g, "''");

	// Escape newlines and carriage returns
	escaped = escaped.replace(/\n/g, "\\n");
	escaped = escaped.replace(/\r/g, "\\r");

	// Escape null character
	escaped = escaped.replace(new RegExp(String.fromCharCode(0), "g"), "\\0");

	// Escape substitute character (used by some databases)
	escaped = escaped.replace(new RegExp(String.fromCharCode(0x1a), "g"), "\\Z");

	// Return with single quotes wrapped around
	return `'${escaped}'`;
}

/**
 * Validate IoTDB path/timeseries name to prevent SQL injection
 * IoTDB paths follow pattern: root.device1.sensor1 (alphanumeric, underscore, dot)
 */
export function validateIoTDBPath(path: string): void {
	if (!path || typeof path !== "string") {
		throw new Error("Invalid IoTDB path: path must be a non-empty string");
	}

	// Trim whitespace
	const trimmedPath = path.trim();

	if (trimmedPath.length === 0) {
		throw new Error("Invalid IoTDB path: path cannot be empty");
	}

	// Allow alphanumeric, underscore, dot, and hyphen in paths
	// Also allow root keyword and wildcards (for queries)
	// More strict pattern: no spaces, only valid path characters
	const validPattern = /^[a-zA-Z0-9_.\-*]+$/;

	if (!validPattern.test(trimmedPath)) {
		throw new Error(
			`Invalid IoTDB path: "${trimmedPath}" contains invalid characters. Only alphanumeric, underscore, dot, hyphen, and asterisk are allowed.`,
		);
	}

	// Check for potential SQL injection patterns
	const dangerousPatterns = [
		/;/i, // Statement separator
		/--/, // SQL comment
		/\/\*/, // SQL comment start
		/\*\//, // SQL comment end
		/\bUNION\b/i, // UNION operator
		/\bDROP\b/i, // DROP statement
		/\bDELETE\b/i, // DELETE statement
		/\bINSERT\b/i, // INSERT statement
		/\bUPDATE\b/i, // UPDATE statement
		/\bEXEC\b/i, // EXEC statement
		/\bEXECUTE\b/i, // EXECUTE statement
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(trimmedPath)) {
			throw new Error(
				`Potentially dangerous IoTDB path detected: "${trimmedPath}"`,
			);
		}
	}

	// Additional check: path length limit
	if (trimmedPath.length > 1000) {
		throw new Error("Invalid IoTDB path: path too long (max 1000 characters)");
	}
}

/**
 * Validate IoTDB data type
 */
export function validateDataType(dataType: string): void {
	const validTypes = [
		"BOOLEAN",
		"INT32",
		"INT64",
		"FLOAT",
		"DOUBLE",
		"TEXT",
		"STRING",
		"BLOB",
		"DATE",
		"TIMESTAMP",
	];

	const upperType = dataType.toUpperCase().trim();

	if (!validTypes.includes(upperType)) {
		throw new Error(`Invalid IoTDB data type: "${dataType}"`);
	}
}

/**
 * Validate IoTDB encoding
 */
export function validateEncoding(encoding: string): void {
	const validEncodings = [
		"PLAIN",
		"RLE",
		"TS_2DIFF",
		"BITMAP",
		"GORILLA",
		"REGULAR",
		"GORILLA_V1",
	];

	const upperEncoding = encoding.toUpperCase().trim();

	if (!validEncodings.includes(upperEncoding)) {
		throw new Error(`Invalid IoTDB encoding: "${encoding}"`);
	}
}

/**
 * Validate device name
 */
export function validateDeviceName(device: string): void {
	if (!device || typeof device !== "string") {
		throw new Error("Invalid device name: must be a non-empty string");
	}

	// Allow alphanumeric, underscore, dot, and hyphen
	const validPattern = /^[a-zA-Z0-9_.-]+$/;

	if (!validPattern.test(device)) {
		throw new Error(
			`Invalid device name: "${device}" contains invalid characters`,
		);
	}
}

/**
 * Validate measurement name
 */
export function validateMeasurement(measurement: string): void {
	if (!measurement || typeof measurement !== "string") {
		throw new Error("Invalid measurement: must be a non-empty string");
	}

	// Allow alphanumeric, underscore, and hyphen
	const validPattern = /^[a-zA-Z0-9_-]+$/;

	if (!validPattern.test(measurement)) {
		throw new Error(
			`Invalid measurement name: "${measurement}" contains invalid characters`,
		);
	}
}
