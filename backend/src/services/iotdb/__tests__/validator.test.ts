import { describe, expect, test } from "vitest";
import {
	escapeId,
	validateDataType,
	validateDeviceName,
	validateEncoding,
	validateIoTDBPath,
	validateMeasurement,
} from "@/services/iotdb/validator";

describe("IoTDB Validator - escapeId", () => {
	test("should escape simple identifier", () => {
		expect(escapeId("root.device1.sensor1")).toBe("`root.device1.sensor1`");
	});

	test("should escape identifier with internal backticks", () => {
		expect(escapeId("root.`device`.sensor")).toBe("`root.``device``.sensor`");
	});

	test("should handle identifier with multiple backticks", () => {
		expect(escapeId("`a``b`")).toBe("```a````b```");
	});
});

describe("IoTDB Validator - validateIoTDBPath", () => {
	const validPaths = [
		"root.device1.sensor1",
		"root.device_1.sensor-1",
		"root.test*",
		"root.device1.*",
		"root.test_device", // with underscore
		"root.device-1.sensor_2",
	];

	test.each(validPaths)("should accept valid path: %s", (path) => {
		expect(() => validateIoTDBPath(path)).not.toThrow();
	});

	test("should reject empty path", () => {
		expect(() => validateIoTDBPath("")).toThrow(
			"Invalid IoTDB path: path must be a non-empty string",
		);
	});

	test("should reject non-string path", () => {
		expect(() => validateIoTDBPath(null as unknown as string)).toThrow(
			"Invalid IoTDB path: path must be a non-empty string",
		);
		expect(() => validateIoTDBPath(undefined as unknown as string)).toThrow(
			"Invalid IoTDB path: path must be a non-empty string",
		);
	});

	const invalidPaths = [
		"root.device1; DROP TABLE",
		"root.device1--comment",
		"root.device1/*comment*/",
		"root.device1' OR '1'='1",
		"root.device1 UNION SELECT",
		"root.device1 INSERT INTO",
		"root.device1 AND 1=1",
		"root.device1=malicious",
	];

	test.each(invalidPaths)("should reject malicious path: %s", (path) => {
		expect(() => validateIoTDBPath(path)).toThrow(
			/Potentially dangerous IoTDB path detected|Invalid IoTDB path/,
		);
	});

	test("should reject path with invalid characters", () => {
		expect(() => validateIoTDBPath("root.device1/sensor")).toThrow(
			"Invalid IoTDB path",
		);
		expect(() => validateIoTDBPath("root.device1@sensor")).toThrow(
			"Invalid IoTDB path",
		);
	});
});

describe("IoTDB Validator - validateDataType", () => {
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
		"boolean",
		"int32",
		"int64",
		"float",
		"double",
		"text",
		"string",
		"blob",
		"date",
		"timestamp",
		"  INT32  ", // with whitespace
	];

	test.each(validTypes)("should accept valid data type: %s", (type) => {
		expect(() => validateDataType(type)).not.toThrow();
	});

	const invalidTypes = ["VARCHAR", "INTEGER", "DECIMAL", "JSON", "INVALID", ""];

	test.each(invalidTypes)("should reject invalid data type: %s", (type) => {
		expect(() => validateDataType(type)).toThrow(
			`Invalid IoTDB data type: "${type}"`,
		);
	});
});

describe("IoTDB Validator - validateEncoding", () => {
	const validEncodings = [
		"PLAIN",
		"RLE",
		"TS_2DIFF",
		"BITMAP",
		"GORILLA",
		"REGULAR",
		"GORILLA_V1",
		"plain",
		"rle",
		"ts_2diff",
		"bitmap",
		"gorilla",
		"regular",
		"gorilla_v1",
		"  RLE  ", // with whitespace
	];

	test.each(validEncodings)("should accept valid encoding: %s", (encoding) => {
		expect(() => validateEncoding(encoding)).not.toThrow();
	});

	const invalidEncodings = ["SNAPPY", "GZIP", "LZO", "ZSTD", "INVALID", ""];

	test.each(
		invalidEncodings,
	)("should reject invalid encoding: %s", (encoding) => {
		expect(() => validateEncoding(encoding)).toThrow(
			`Invalid IoTDB encoding: "${encoding}"`,
		);
	});
});

describe("IoTDB Validator - validateDeviceName", () => {
	const validDevices = [
		"device1",
		"device_1",
		"device-1",
		"device.1",
		"Device-Name_01",
	];

	test.each(validDevices)("should accept valid device name: %s", (device) => {
		expect(() => validateDeviceName(device)).not.toThrow();
	});

	test("should reject empty device name", () => {
		expect(() => validateDeviceName("")).toThrow(
			"Invalid device name: must be a non-empty string",
		);
	});

	test("should reject non-string device name", () => {
		expect(() => validateDeviceName(null as unknown as string)).toThrow(
			"Invalid device name: must be a non-empty string",
		);
		expect(() => validateDeviceName(undefined as unknown as string)).toThrow(
			"Invalid device name: must be a non-empty string",
		);
	});

	const invalidDevices = [
		"device 1", // space not allowed
		"device/1",
		"device@1",
		"device#1",
		"device;1",
		"device'1",
	];

	test.each(
		invalidDevices,
	)("should reject invalid device name: %s", (device) => {
		expect(() => validateDeviceName(device)).toThrow("Invalid device name");
	});
});

describe("IoTDB Validator - validateMeasurement", () => {
	const validMeasurements = [
		"temperature",
		"temp_1",
		"temp-1",
		"sensorValue",
		"SENSOR_01",
	];

	test.each(
		validMeasurements,
	)("should accept valid measurement: %s", (measurement) => {
		expect(() => validateMeasurement(measurement)).not.toThrow();
	});

	test("should reject empty measurement", () => {
		expect(() => validateMeasurement("")).toThrow(
			"Invalid measurement: must be a non-empty string",
		);
	});

	test("should reject non-string measurement", () => {
		expect(() => validateMeasurement(null as unknown as string)).toThrow(
			"Invalid measurement: must be a non-empty string",
		);
		expect(() => validateMeasurement(undefined as unknown as string)).toThrow(
			"Invalid measurement: must be a non-empty string",
		);
	});

	const invalidMeasurements = [
		"temp value", // space not allowed
		"temp/value",
		"temp@value",
		"temp.value", // dot not allowed in measurement
		"temp;value",
		"temp'value",
	];

	test.each(
		invalidMeasurements,
	)("should reject invalid measurement: %s", (measurement) => {
		expect(() => validateMeasurement(measurement)).toThrow(
			"Invalid measurement name",
		);
	});
});
