import { describe, expect, test } from "vitest";
import {
	alertsQuerySchema,
	createAlertSchema,
	resolveAlertSchema,
	updateAlertSchema,
} from "@/schemas/alerts";
import {
	anomaliesQuerySchema,
	bulkResolveSchema,
	detectAnomaliesSchema,
	updateAnomalySchema,
} from "@/schemas/anomalies";
import {
	createDatasetSchema,
	datasetsQuerySchema,
	updateDatasetSchema,
} from "@/schemas/datasets";
import {
	forecastsQuerySchema,
	modelsQuerySchema,
	predictSchema,
	trainModelSchema,
} from "@/schemas/models";
import {
	createDataPointSchema,
	createTimeseriesSchema,
	timeseriesDataQuerySchema,
	timeseriesQuerySchema,
	updateTimeseriesSchema,
} from "@/schemas/timeseries";

describe("Dataset Schemas", () => {
	describe("datasetsQuerySchema", () => {
		test("should accept valid query with search", () => {
			const result = datasetsQuerySchema.parse({
				page: "1",
				limit: "20",
				search: "test",
			});
			expect(result.search).toBe("test");
		});

		test("should accept valid query without search", () => {
			const result = datasetsQuerySchema.parse({
				page: "1",
				limit: "20",
			});
			expect(result.search).toBeUndefined();
		});
	});

	describe("createDatasetSchema", () => {
		const validData = {
			name: "Test Dataset",
			slug: "test-dataset",
			description: "A test dataset",
			storageFormat: "TIMESERIES" as const,
			filePath: "/path/to/file.csv",
			isPublic: false,
		};

		test("should accept valid dataset", () => {
			const result = createDatasetSchema.parse(validData);
			expect(result.name).toBe("Test Dataset");
			expect(result.slug).toBe("test-dataset");
		});

		test("should accept dataset with optional fields", () => {
			const minimalData = {
				name: "Minimal Dataset",
				slug: "minimal-dataset",
				storageFormat: "CSV" as const,
			};
			const result = createDatasetSchema.parse(minimalData);
			expect(result.description).toBeUndefined();
			expect(result.filePath).toBeUndefined();
		});

		test("should reject empty name", () => {
			const data = { ...validData, name: "" };
			expect(() => createDatasetSchema.parse(data)).toThrow();
		});

		test("should reject name over 255 chars", () => {
			const data = { ...validData, name: "a".repeat(256) };
			expect(() => createDatasetSchema.parse(data)).toThrow();
		});

		test("should reject invalid slug format", () => {
			const data = { ...validData, slug: "Invalid_Slug!" };
			expect(() => createDatasetSchema.parse(data)).toThrow();
		});

		test("should reject invalid storage format", () => {
			const data = { ...validData, storageFormat: "INVALID" };
			expect(() => createDatasetSchema.parse(data)).toThrow();
		});
	});

	describe("updateDatasetSchema", () => {
		const validData = {
			name: "Updated Name",
			description: "Updated description",
			isPublic: true,
			isImported: true,
		};

		test("should accept valid update data", () => {
			const result = updateDatasetSchema.parse(validData);
			expect(result.name).toBe("Updated Name");
		});

		test("should accept partial updates", () => {
			const partialData = { name: "New Name" };
			const result = updateDatasetSchema.parse(partialData);
			expect(result.name).toBe("New Name");
			expect(result.description).toBeUndefined();
		});

		test("should reject empty name", () => {
			const data = { ...validData, name: "" };
			expect(() => updateDatasetSchema.parse(data)).toThrow();
		});
	});
});

describe("Timeseries Schemas", () => {
	describe("timeseriesQuerySchema", () => {
		test("should accept valid query with datasetId", () => {
			const result = timeseriesQuerySchema.parse({
				page: "1",
				limit: "20",
				datasetId: "550e8400-e29b-41d4-a716-446655440000",
				search: "temperature",
			});
			expect(result.datasetId).toBe("550e8400-e29b-41d4-a716-446655440000");
		});

		test("should reject invalid UUID", () => {
			expect(() =>
				timeseriesQuerySchema.parse({
					page: "1",
					limit: "20",
					datasetId: "not-a-uuid",
				}),
			).toThrow();
		});
	});

	describe("timeseriesDataQuerySchema", () => {
		test("should accept valid time range", () => {
			const result = timeseriesDataQuerySchema.parse({
				limit: "100",
				startTime: "2024-01-01T00:00:00Z",
				endTime: "2024-12-31T23:59:59Z",
			});
			expect(result.startTime).toBe("2024-01-01T00:00:00Z");
		});

		test("should reject invalid datetime format", () => {
			expect(() =>
				timeseriesDataQuerySchema.parse({
					limit: "100",
					startTime: "not-a-datetime",
				}),
			).toThrow();
		});
	});

	describe("createTimeseriesSchema", () => {
		const validData = {
			name: "Temperature",
			description: "Temperature sensor",
			unit: "°C",
			dataType: "DOUBLE" as const,
			datasetId: "550e8400-e29b-41d4-a716-446655440000",
		};

		test("should accept valid timeseries", () => {
			const result = createTimeseriesSchema.parse(validData);
			expect(result.name).toBe("Temperature");
			expect(result.dataType).toBe("DOUBLE");
		});

		test("should accept minimal timeseries", () => {
			const minimalData = {
				name: "Speed",
				datasetId: "550e8400-e29b-41d4-a716-446655440000",
			};
			const result = createTimeseriesSchema.parse(minimalData);
			expect(result.name).toBe("Speed");
		});

		test("should reject empty name", () => {
			const data = { ...validData, name: "" };
			expect(() => createTimeseriesSchema.parse(data)).toThrow();
		});

		test("should reject invalid dataType", () => {
			const data = { ...validData, dataType: "INVALID" };
			expect(() => createTimeseriesSchema.parse(data)).toThrow();
		});

		test("should reject invalid UUID", () => {
			const data = { ...validData, datasetId: "not-a-uuid" };
			expect(() => createTimeseriesSchema.parse(data)).toThrow();
		});
	});

	describe("updateTimeseriesSchema", () => {
		test("should accept valid update data", () => {
			const data = {
				name: "Updated Temperature",
				unit: "°F",
				dataType: "FLOAT" as const,
			};
			const result = updateTimeseriesSchema.parse(data);
			expect(result.name).toBe("Updated Temperature");
		});

		test("should accept partial updates", () => {
			const data = { unit: "K" };
			const result = updateTimeseriesSchema.parse(data);
			expect(result.unit).toBe("K");
			expect(result.name).toBeUndefined();
		});
	});

	describe("createDataPointSchema", () => {
		test("should accept valid datapoint with timestamp", () => {
			const data = {
				timestamp: "2024-01-01T00:00:00Z",
				value: 25.5,
				quality: 95,
			};
			const result = createDataPointSchema.parse(data);
			expect(result.value).toBe(25.5);
			expect(result.quality).toBe(95);
		});

		test("should accept datapoint without timestamp", () => {
			const data = { value: 30.0 };
			const result = createDataPointSchema.parse(data);
			expect(result.value).toBe(30.0);
		});

		test("should reject quality below 0", () => {
			const data = { value: 25.5, quality: -1 };
			expect(() => createDataPointSchema.parse(data)).toThrow();
		});

		test("should reject quality above 100", () => {
			const data = { value: 25.5, quality: 101 };
			expect(() => createDataPointSchema.parse(data)).toThrow();
		});
	});
});

describe("Alert Schemas", () => {
	describe("alertsQuerySchema", () => {
		test("should accept valid query with alertType", () => {
			const result = alertsQuerySchema.parse({
				page: "1",
				limit: "20",
				alertType: "ANOMALY",
			});
			expect(result.alertType).toBe("ANOMALY");
		});

		test("should transform isResolved string to boolean", () => {
			const result = alertsQuerySchema.parse({
				page: "1",
				limit: "20",
				isResolved: "true",
			});
			expect(result.isResolved).toBe(true);
		});
	});

	describe("createAlertSchema", () => {
		test("should accept valid alert", () => {
			const data = {
				name: "Temperature Alert",
				description: "High temperature warning",
				alertType: "THRESHOLD" as const,
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				conditions: { threshold: 100 },
				actions: ["email", "sms"],
			};
			const result = createAlertSchema.parse(data);
			expect(result.name).toBe("Temperature Alert");
			expect(result.alertType).toBe("THRESHOLD");
		});

		test("should accept minimal alert", () => {
			const data = {
				name: "System Alert",
				alertType: "SYSTEM" as const,
				conditions: {},
			};
			const result = createAlertSchema.parse(data);
			expect(result.name).toBe("System Alert");
			expect(result.enabled).toBe(true); // default
		});

		test("should reject empty name", () => {
			const data = {
				name: "",
				alertType: "ANOMALY" as const,
				conditions: {},
			};
			expect(() => createAlertSchema.parse(data)).toThrow();
		});

		test("should reject invalid alertType", () => {
			const data = {
				name: "Alert",
				alertType: "INVALID",
				conditions: {},
			};
			expect(() => createAlertSchema.parse(data)).toThrow();
		});
	});

	describe("updateAlertSchema", () => {
		test("should accept valid update data", () => {
			const data = {
				name: "Updated Alert",
				conditions: { threshold: 200 },
				enabled: false,
			};
			const result = updateAlertSchema.parse(data);
			expect(result.name).toBe("Updated Alert");
		});
	});

	describe("resolveAlertSchema", () => {
		test("should accept resolution notes", () => {
			const data = {
				resolutionNotes: "Issue resolved",
			};
			const result = resolveAlertSchema.parse(data);
			expect(result.resolutionNotes).toBe("Issue resolved");
		});

		test("should accept empty resolution", () => {
			const result = resolveAlertSchema.parse({});
			expect(result.resolutionNotes).toBeUndefined();
		});
	});
});

describe("Anomaly Schemas", () => {
	describe("anomaliesQuerySchema", () => {
		test("should accept valid query with severity", () => {
			const result = anomaliesQuerySchema.parse({
				page: "1",
				limit: "20",
				severity: "HIGH",
			});
			expect(result.severity).toBe("HIGH");
		});

		test("should transform isResolved string to boolean", () => {
			const result = anomaliesQuerySchema.parse({
				page: "1",
				limit: "20",
				isResolved: "false",
			});
			expect(result.isResolved).toBe(false);
		});
	});

	describe("detectAnomaliesSchema", () => {
		test("should accept valid detection request", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				method: "STATISTICAL" as const,
				threshold: 0.95,
				windowSize: 100,
			};
			const result = detectAnomaliesSchema.parse(data);
			expect(result.method).toBe("STATISTICAL");
		});

		test("should use default values", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
			};
			const result = detectAnomaliesSchema.parse(data);
			expect(result.method).toBe("STATISTICAL"); // default
			expect(result.threshold).toBe(0.95); // default
			expect(result.windowSize).toBe(100); // default
		});

		test("should reject invalid threshold", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				threshold: 1.5,
			};
			expect(() => detectAnomaliesSchema.parse(data)).toThrow();
		});

		test("should reject windowSize below 5", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				windowSize: 3,
			};
			expect(() => detectAnomaliesSchema.parse(data)).toThrow();
		});
	});

	describe("updateAnomalySchema", () => {
		test("should accept valid update data", () => {
			const data = {
				isInvestigated: true,
				resolutionNotes: "Investigated",
				isResolved: true,
			};
			const result = updateAnomalySchema.parse(data);
			expect(result.isInvestigated).toBe(true);
		});
	});

	describe("bulkResolveSchema", () => {
		test("should accept bulk resolve request", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				severity: "HIGH" as const,
				start: "2024-01-01T00:00:00Z",
				end: "2024-12-31T23:59:59Z",
			};
			const result = bulkResolveSchema.parse(data);
			expect(result.severity).toBe("HIGH");
		});
	});
});

describe("Model Schemas", () => {
	describe("modelsQuerySchema", () => {
		test("should accept valid query with algorithm", () => {
			const result = modelsQuerySchema.parse({
				page: "1",
				limit: "20",
				algorithm: "LSTM",
			});
			expect(result.algorithm).toBe("LSTM");
		});

		test("should transform isActive string to boolean", () => {
			const result = modelsQuerySchema.parse({
				page: "1",
				limit: "20",
				isActive: "true",
			});
			expect(result.isActive).toBe(true);
		});
	});

	describe("trainModelSchema", () => {
		test("should accept valid training request", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				algorithm: "LSTM" as const,
				hyperparameters: { epochs: 100 },
			};
			const result = trainModelSchema.parse(data);
			expect(result.algorithm).toBe("LSTM");
		});

		test("should reject invalid algorithm", () => {
			const data = {
				timeseriesId: "550e8400-e29b-41d4-a716-446655440000",
				algorithm: "INVALID",
			};
			expect(() => trainModelSchema.parse(data)).toThrow();
		});
	});

	describe("predictSchema", () => {
		test("should accept valid prediction request", () => {
			const data = {
				horizon: 100,
				confidenceLevel: 0.95,
			};
			const result = predictSchema.parse(data);
			expect(result.horizon).toBe(100);
		});

		test("should use default values", () => {
			const result = predictSchema.parse({});
			expect(result.horizon).toBe(100); // default
			expect(result.confidenceLevel).toBe(0.95); // default
		});

		test("should reject horizon over 10000", () => {
			const data = { horizon: 10001 };
			expect(() => predictSchema.parse(data)).toThrow();
		});
	});

	describe("forecastsQuerySchema", () => {
		test("should accept valid forecast query", () => {
			const data = {
				limit: "100",
				start: "2024-01-01T00:00:00Z",
				end: "2024-12-31T23:59:59Z",
			};
			const result = forecastsQuerySchema.parse(data);
			expect(result.start).toBe("2024-01-01T00:00:00Z");
		});
	});
});
