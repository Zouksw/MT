import { describe, expect, test } from "vitest";
import {
	buildAggregateQuery,
	buildBatchInsertSQL,
	buildCreateTimeseriesSQL,
	buildDeleteSQL,
	buildDropTimeseriesSQL,
	buildInsertSQL,
	buildSelectQuery,
	buildShowTimeseriesSQL,
	type IoTDBInsertRecord,
	validateQueryParams,
} from "@/services/iotdb/query-builder";

describe("IoTDB Query Builder - buildCreateTimeseriesSQL", () => {
	test("should build CREATE TIMESERIES SQL without compressor", () => {
		const result = buildCreateTimeseriesSQL({
			path: "root.device1.temperature",
			dataType: "DOUBLE",
			encoding: "GORILLA",
		});
		expect(result).toBe(
			"CREATE TIMESERIES `root.device1.temperature` WITH DATATYPE=`DOUBLE`, ENCODING=`GORILLA`",
		);
	});

	test("should build CREATE TIMESERIES SQL with compressor", () => {
		const result = buildCreateTimeseriesSQL({
			path: "root.device1.temperature",
			dataType: "DOUBLE",
			encoding: "GORILLA",
			compressor: "SNAPPY",
		});
		expect(result).toBe(
			"CREATE TIMESERIES `root.device1.temperature` WITH DATATYPE=`DOUBLE`, ENCODING=`GORILLA`, COMPRESSOR=`SNAPPY`",
		);
	});

	test("should escape backticks in path", () => {
		const result = buildCreateTimeseriesSQL({
			path: "root.`device`.temperature",
			dataType: "DOUBLE",
			encoding: "GORILLA",
		});
		expect(result).toBe(
			"CREATE TIMESERIES `root.``device``.temperature` WITH DATATYPE=`DOUBLE`, ENCODING=`GORILLA`",
		);
	});
});

describe("IoTDB Query Builder - buildDropTimeseriesSQL", () => {
	test("should build DROP TIMESERIES SQL", () => {
		const result = buildDropTimeseriesSQL("root.device1.temperature");
		expect(result).toBe("DROP TIMESERIES `root.device1.temperature`");
	});
});

describe("IoTDB Query Builder - buildShowTimeseriesSQL", () => {
	test("should build SHOW TIMESERIES for all", () => {
		const result = buildShowTimeseriesSQL();
		expect(result).toBe("SHOW TIMESERIES");
	});

	test("should build SHOW TIMESERIES for specific path", () => {
		const result = buildShowTimeseriesSQL("root.device1.*");
		expect(result).toBe("SHOW TIMESERIES root.device1.*");
	});
});

describe("IoTDB Query Builder - buildInsertSQL", () => {
	test("should build INSERT SQL with numeric values", () => {
		const result = buildInsertSQL({
			device: "root.device1",
			timestamp: 1234567890000,
			measurements: {
				temperature: 25.5,
				humidity: 60,
			},
		});
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, humidity, timestamp) VALUES (25.5, 60, 1234567890000)",
		);
	});

	test("should build INSERT SQL with string values", () => {
		const result = buildInsertSQL({
			device: "root.device1",
			timestamp: 1234567890000,
			measurements: {
				status: "active",
			},
		});
		expect(result).toBe(
			"INSERT INTO root.device1(status, timestamp) VALUES ('active', 1234567890000)",
		);
	});

	test("should escape single quotes in string values", () => {
		const result = buildInsertSQL({
			device: "root.device1",
			timestamp: 1234567890000,
			measurements: {
				message: "it's working",
			},
		});
		expect(result).toBe(
			"INSERT INTO root.device1(message, timestamp) VALUES ('it''s working', 1234567890000)",
		);
	});

	test("should handle NULL values", () => {
		const result = buildInsertSQL({
			device: "root.device1",
			timestamp: 1234567890000,
			measurements: {
				temperature: null,
			},
		});
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, timestamp) VALUES (NULL, 1234567890000)",
		);
	});

	test("should handle undefined values", () => {
		const result = buildInsertSQL({
			device: "root.device1",
			timestamp: 1234567890000,
			measurements: {
				temperature: undefined,
			},
		});
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, timestamp) VALUES (NULL, 1234567890000)",
		);
	});

	test("should handle boolean values", () => {
		const result = buildInsertSQL({
			device: "root.device1",
			timestamp: 1234567890000,
			measurements: {
				active: true,
				ready: false,
			},
		});
		expect(result).toBe(
			"INSERT INTO root.device1(active, ready, timestamp) VALUES (true, false, 1234567890000)",
		);
	});
});

describe("IoTDB Query Builder - buildBatchInsertSQL", () => {
	test("should build batch INSERT SQL for multiple records", () => {
		const records: IoTDBInsertRecord[] = [
			{
				device: "root.device1",
				measurements: ["temperature"],
				values: [25.5],
				timestamp: 1234567890000,
			},
			{
				device: "root.device2",
				measurements: ["humidity"],
				values: [60],
				timestamp: 1234567891000,
			},
		];
		const result = buildBatchInsertSQL(records);
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, timestamp) VALUES (1234567890000, 25.5); INSERT INTO root.device2(humidity, timestamp) VALUES (1234567891000, 60);",
		);
	});

	test("should handle multiple measurements in batch", () => {
		const records: IoTDBInsertRecord[] = [
			{
				device: "root.device1",
				measurements: ["temperature", "humidity"],
				values: [25.5, 60],
				timestamp: 1234567890000,
			},
		];
		const result = buildBatchInsertSQL(records);
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, humidity, timestamp) VALUES (1234567890000, 25.5, 60);",
		);
	});

	test("should escape strings in batch insert", () => {
		const records: IoTDBInsertRecord[] = [
			{
				device: "root.device1",
				measurements: ["status"],
				values: ["it's ok"],
				timestamp: 1234567890000,
			},
		];
		const result = buildBatchInsertSQL(records);
		expect(result).toBe(
			"INSERT INTO root.device1(status, timestamp) VALUES (1234567890000, 'it''s ok');",
		);
	});

	test("should handle NULL values in batch insert", () => {
		const records: IoTDBInsertRecord[] = [
			{
				device: "root.device1",
				measurements: ["temperature", "humidity"],
				values: [25.5, null],
				timestamp: 1234567890000,
			},
		];
		const result = buildBatchInsertSQL(records);
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, humidity, timestamp) VALUES (1234567890000, 25.5, NULL);",
		);
	});

	test("should handle undefined values in batch insert", () => {
		const records: IoTDBInsertRecord[] = [
			{
				device: "root.device1",
				measurements: ["temperature", "humidity"],
				values: [25.5, undefined],
				timestamp: 1234567890000,
			},
		];
		const result = buildBatchInsertSQL(records);
		expect(result).toBe(
			"INSERT INTO root.device1(temperature, humidity, timestamp) VALUES (1234567890000, 25.5, NULL);",
		);
	});
});

describe("IoTDB Query Builder - buildSelectQuery", () => {
	test("should build simple SELECT query", () => {
		const result = buildSelectQuery({ path: "root.device1.*" });
		expect(result).toBe("SELECT * FROM root.device1.*");
	});

	test("should build SELECT query with limit", () => {
		const result = buildSelectQuery({ path: "root.device1.*", limit: 100 });
		expect(result).toBe("SELECT * FROM root.device1.* LIMIT 100");
	});

	test("should build SELECT query with offset", () => {
		const result = buildSelectQuery({ path: "root.device1.*", offset: 50 });
		expect(result).toBe("SELECT * FROM root.device1.* OFFSET 50");
	});

	test("should build SELECT query with limit and offset", () => {
		const result = buildSelectQuery({
			path: "root.device1.*",
			limit: 100,
			offset: 50,
		});
		expect(result).toBe("SELECT * FROM root.device1.* LIMIT 100 OFFSET 50");
	});

	test("should build SELECT query with time range", () => {
		const result = buildSelectQuery({
			path: "root.device1.*",
			startTime: 1234567890000,
			endTime: 1234567990000,
		});
		expect(result).toBe(
			"SELECT * FROM root.device1.* WHERE time >= 1234567890000 AND time <= 1234567990000",
		);
	});

	test("should build SELECT query with all parameters", () => {
		const result = buildSelectQuery({
			path: "root.device1.*",
			startTime: 1234567890000,
			endTime: 1234567990000,
			limit: 100,
			offset: 50,
		});
		expect(result).toBe(
			"SELECT * FROM root.device1.* WHERE time >= 1234567890000 AND time <= 1234567990000 LIMIT 100 OFFSET 50",
		);
	});

	test("should handle string numbers for time range", () => {
		const result = buildSelectQuery({
			path: "root.device1.*",
			startTime: "1234567890000" as unknown as number,
			endTime: "1234567990000" as unknown as number,
		});
		expect(result).toBe(
			"SELECT * FROM root.device1.* WHERE time >= 1234567890000 AND time <= 1234567990000",
		);
	});

	test("should throw error for invalid startTime", () => {
		expect(() =>
			buildSelectQuery({
				path: "root.device1.*",
				startTime: NaN,
			}),
		).toThrow("Invalid startTime: must be a number");
	});

	test("should throw error for invalid endTime", () => {
		expect(() =>
			buildSelectQuery({
				path: "root.device1.*",
				endTime: NaN,
			}),
		).toThrow("Invalid endTime: must be a number");
	});
});

describe("IoTDB Query Builder - buildAggregateQuery", () => {
	test("should build AVG aggregation query", () => {
		const result = buildAggregateQuery({
			path: "root.device1.temperature",
			func: "avg",
		});
		expect(result).toBe(
			"SELECT AVG(root.device1.temperature) FROM root.device1.temperature",
		);
	});

	test("should build SUM aggregation query", () => {
		const result = buildAggregateQuery({
			path: "root.device1.temperature",
			func: "sum",
		});
		expect(result).toBe(
			"SELECT SUM(root.device1.temperature) FROM root.device1.temperature",
		);
	});

	test("should build MAX aggregation query", () => {
		const result = buildAggregateQuery({
			path: "root.device1.temperature",
			func: "max",
		});
		expect(result).toBe(
			"SELECT MAX(root.device1.temperature) FROM root.device1.temperature",
		);
	});

	test("should build MIN aggregation query", () => {
		const result = buildAggregateQuery({
			path: "root.device1.temperature",
			func: "min",
		});
		expect(result).toBe(
			"SELECT MIN(root.device1.temperature) FROM root.device1.temperature",
		);
	});

	test("should build COUNT aggregation query", () => {
		const result = buildAggregateQuery({
			path: "root.device1.temperature",
			func: "count",
		});
		expect(result).toBe(
			"SELECT COUNT(root.device1.temperature) FROM root.device1.temperature",
		);
	});

	test("should build aggregation query with time range", () => {
		const result = buildAggregateQuery({
			path: "root.device1.temperature",
			func: "avg",
			startTime: 1234567890000,
			endTime: 1234567990000,
		});
		expect(result).toBe(
			"SELECT AVG(root.device1.temperature) FROM root.device1.temperature WHERE time >= 1234567890000 AND time <= 1234567990000",
		);
	});
});

describe("IoTDB Query Builder - buildDeleteSQL", () => {
	test("should build DELETE SQL for all data", () => {
		const result = buildDeleteSQL({ path: "root.device1.*" });
		expect(result).toBe("DELETE FROM root.device1.*");
	});

	test("should build DELETE SQL with time range", () => {
		const result = buildDeleteSQL({
			path: "root.device1.*",
			startTime: 1234567890000,
			endTime: 1234567990000,
		});
		expect(result).toBe(
			"DELETE FROM root.device1.* WHERE time >= 1234567890000 AND time <= 1234567990000",
		);
	});

	test("should build DELETE SQL with startTime only", () => {
		const result = buildDeleteSQL({
			path: "root.device1.*",
			startTime: 1234567890000,
		});
		expect(result).toBe(
			"DELETE FROM root.device1.* WHERE time >= 1234567890000",
		);
	});

	test("should build DELETE SQL with endTime only", () => {
		const result = buildDeleteSQL({
			path: "root.device1.*",
			endTime: 1234567990000,
		});
		expect(result).toBe(
			"DELETE FROM root.device1.* WHERE time <= 1234567990000",
		);
	});
});

describe("IoTDB Query Builder - validateQueryParams", () => {
	test("should accept valid limit", () => {
		expect(() => validateQueryParams({ limit: 100 })).not.toThrow();
		expect(() => validateQueryParams({ limit: 0 })).not.toThrow();
		expect(() => validateQueryParams({ limit: 100000 })).not.toThrow();
	});

	test("should reject limit that is too large", () => {
		expect(() => validateQueryParams({ limit: 100001 })).toThrow(
			"Invalid limit value: must be between 0 and 100000",
		);
	});

	test("should reject negative limit", () => {
		expect(() => validateQueryParams({ limit: -1 })).toThrow(
			"Invalid limit value: must be between 0 and 100000",
		);
	});

	test("should accept valid offset", () => {
		expect(() => validateQueryParams({ offset: 0 })).not.toThrow();
		expect(() => validateQueryParams({ offset: 1000 })).not.toThrow();
	});

	test("should reject negative offset", () => {
		expect(() => validateQueryParams({ offset: -1 })).toThrow(
			"Invalid offset value: must be non-negative",
		);
	});

	test("should accept undefined limit and offset", () => {
		expect(() => validateQueryParams({})).not.toThrow();
	});
});
