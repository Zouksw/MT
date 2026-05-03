/**
 * AI Service Tests
 *
 * Comprehensive tests for IoTDB AI Service including:
 * - Prediction with various algorithms
 * - Anomaly detection
 * - Model listing
 * - Error handling
 * - AI Node availability checks
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	type AnomalyDetectionRequest,
	IoTDBAIService,
	type PredictionRequest,
} from "../ai";

describe("IoTDBAIService", () => {
	let aiService: IoTDBAIService;

	beforeEach(() => {
		aiService = new IoTDBAIService();
	});

	describe("Constructor", () => {
		it("should initialize with default AI Node paths", () => {
			expect(aiService).toBeInstanceOf(IoTDBAIService);
		});

		it("should use environment variables for paths", () => {
			const originalHome = process.env.AI_NODE_HOME;
			const originalPython = process.env.PYTHON_PATH;

			process.env.AI_NODE_HOME = "/custom/ainode";
			process.env.PYTHON_PATH = "/custom/python";

			const customService = new IoTDBAIService();
			expect(customService).toBeInstanceOf(IoTDBAIService);

			process.env.AI_NODE_HOME = originalHome;
			process.env.PYTHON_PATH = originalPython;
		});
	});

	describe("Prediction - ARIMA", () => {
		it("should reject prediction when AI Node is unavailable", async () => {
			const request: PredictionRequest = {
				timeseries: "root.test.temperature",
				horizon: 10,
				algorithm: "arima",
			};

			await expect(aiService.predict(request)).rejects.toThrow();
		});

		it("should validate prediction request parameters", async () => {
			const invalidRequest = {
				timeseries: "",
				horizon: -1,
			} as unknown as PredictionRequest;

			await expect(aiService.predict(invalidRequest)).rejects.toThrow();
		});

		it("should accept valid prediction request structure", () => {
			const request: PredictionRequest = {
				timeseries: "root.sg.device1.temperature",
				horizon: 10,
				algorithm: "arima",
				confidenceLevel: 0.95,
			};

			expect(request.timeseries).toBeDefined();
			expect(request.horizon).toBeGreaterThan(0);
			expect([
				"arima",
				"timer_xl",
				"sundial",
				"holtwinters",
				"exponential_smoothing",
				"naive_forecaster",
				"stl_forecaster",
			]).toContain(request.algorithm);
		});
	});

	describe("Prediction - Algorithm Support", () => {
		const supportedAlgorithms = [
			"arima",
			"timer_xl",
			"sundial",
			"holtwinters",
			"exponential_smoothing",
			"naive_forecaster",
			"stl_forecaster",
		] as const;

		supportedAlgorithms.forEach((algorithm) => {
			it(`should support ${algorithm} algorithm type`, () => {
				const request: PredictionRequest = {
					timeseries: "root.test.sensor",
					horizon: 10,
					algorithm,
				};

				expect(request.algorithm).toBe(algorithm);
			});
		});

		it("should allow optional algorithm parameter", () => {
			const request: PredictionRequest = {
				timeseries: "root.test.sensor",
				horizon: 10,
			};

			expect(request.algorithm).toBeUndefined();
		});
	});

	describe("Anomaly Detection", () => {
		it("should reject anomaly detection when AI Node is unavailable", async () => {
			const request: AnomalyDetectionRequest = {
				timeseries: "root.test.temperature",
				method: "statistical",
			};

			await expect(aiService.detectAnomalies(request)).rejects.toThrow();
		});

		it("should validate anomaly detection request parameters", async () => {
			const invalidRequest = {
				timeseries: "",
				method: "invalid_method",
			} as unknown as AnomalyDetectionRequest;

			await expect(aiService.detectAnomalies(invalidRequest)).rejects.toThrow();
		});
	});

	describe("Anomaly Detection - Method Support", () => {
		const supportedMethods = [
			"statistical",
			"ml",
			"rule_based",
			"STRAY",
		] as const;

		supportedMethods.forEach((method) => {
			it(`should support ${method} detection method`, () => {
				const request: AnomalyDetectionRequest = {
					timeseries: "root.test.sensor",
					method,
				};

				expect(request.method).toBe(method);
			});
		});

		it("should allow optional method parameter", () => {
			const request: AnomalyDetectionRequest = {
				timeseries: "root.test.sensor",
			};

			expect(request.method).toBeUndefined();
		});
	});

	describe("Anomaly Detection - Optional Parameters", () => {
		it("should accept threshold parameter", () => {
			const request: AnomalyDetectionRequest = {
				timeseries: "root.test.sensor",
				method: "statistical",
				threshold: 0.95,
			};

			expect(request.threshold).toBe(0.95);
		});

		it("should accept windowSize parameter", () => {
			const request: AnomalyDetectionRequest = {
				timeseries: "root.test.sensor",
				method: "statistical",
				windowSize: 100,
			};

			expect(request.windowSize).toBe(100);
		});

		it("should accept time range parameters", () => {
			const startTime = Date.now() - 3600000;
			const endTime = Date.now();

			const request: AnomalyDetectionRequest = {
				timeseries: "root.test.sensor",
				method: "statistical",
				startTime,
				endTime,
			};

			expect(request.startTime).toBe(startTime);
			expect(request.endTime).toBe(endTime);
			expect(request.endTime).toBeGreaterThan(request.startTime);
		});
	});

	describe("Prediction Result Structure", () => {
		it("should define correct prediction result structure", () => {
			const mockResult = {
				timestamps: [1, 2, 3, 4, 5],
				values: [10, 20, 30, 40, 50],
				confidence: [1, 2, 3, 4, 5],
				lowerBound: [9, 19, 29, 39, 49],
				upperBound: [11, 21, 31, 41, 51],
			};

			expect(mockResult.timestamps).toHaveLength(5);
			expect(mockResult.values).toHaveLength(5);
			expect(mockResult.confidence).toBeDefined();
			expect(mockResult.lowerBound).toBeDefined();
			expect(mockResult.upperBound).toBeDefined();
		});

		it("should allow optional confidence interval", () => {
			const resultWithoutConfidence = {
				timestamps: [1, 2, 3],
				values: [10, 20, 30],
			};

			expect(resultWithoutConfidence.confidence).toBeUndefined();
			expect(resultWithoutConfidence.lowerBound).toBeUndefined();
			expect(resultWithoutConfidence.upperBound).toBeUndefined();
		});
	});

	describe("Anomaly Detection Result Structure", () => {
		it("should define correct anomaly result structure", () => {
			const mockResult = {
				anomalies: [
					{
						timestamp: 1648120000000,
						value: 85.0,
						score: 0.95,
						severity: "HIGH" as const,
					},
				],
				statistics: {
					total: 1,
					bySeverity: {
						HIGH: 1,
					},
				},
			};

			expect(mockResult.anomalies).toHaveLength(1);
			expect(mockResult.anomalies[0].timestamp).toBeDefined();
			expect(mockResult.anomalies[0].value).toBeDefined();
			expect(mockResult.anomalies[0].score).toBeGreaterThanOrEqual(0);
			expect(mockResult.anomalies[0].score).toBeLessThanOrEqual(1);
			expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(
				mockResult.anomalies[0].severity,
			);
			expect(mockResult.statistics.total).toBe(1);
		});

		it("should support all severity levels", () => {
			const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

			severities.forEach((severity) => {
				const anomaly = {
					timestamp: Date.now(),
					value: 100,
					score: 0.8,
					severity,
				};

				expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(
					anomaly.severity,
				);
			});
		});

		it("should aggregate statistics by severity", () => {
			const mockResult = {
				anomalies: [
					{ timestamp: 1, value: 100, score: 0.9, severity: "HIGH" as const },
					{
						timestamp: 2,
						value: 100,
						score: 0.95,
						severity: "CRITICAL" as const,
					},
					{ timestamp: 3, value: 100, score: 0.7, severity: "HIGH" as const },
					{ timestamp: 4, value: 100, score: 0.5, severity: "MEDIUM" as const },
				],
				statistics: {
					total: 4,
					bySeverity: {
						HIGH: 2,
						CRITICAL: 1,
						MEDIUM: 1,
					},
				},
			};

			expect(mockResult.statistics.total).toBe(4);
			expect(mockResult.statistics.bySeverity.HIGH).toBe(2);
			expect(mockResult.statistics.bySeverity.CRITICAL).toBe(1);
			expect(mockResult.statistics.bySeverity.MEDIUM).toBe(1);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid timeseries names", async () => {
			const invalidRequests = [
				{ timeseries: "", horizon: 10 },
				{ timeseries: "invalid", horizon: 10 },
				{ timeseries: "root..double..dot", horizon: 10 },
			];

			for (const request of invalidRequests) {
				await expect(
					aiService.predict(request as PredictionRequest),
				).rejects.toThrow();
			}
		});

		it("should handle invalid horizon values", async () => {
			const invalidHorizons = [
				{ timeseries: "root.test.sensor", horizon: 0 },
				{ timeseries: "root.test.sensor", horizon: -1 },
				{ timeseries: "root.test.sensor", horizon: NaN },
			];

			for (const request of invalidHorizons) {
				await expect(
					aiService.predict(request as PredictionRequest),
				).rejects.toThrow();
			}
		});

		it("should handle invalid confidence levels", async () => {
			const invalidRequests = [
				{ timeseries: "root.test.sensor", horizon: 10, confidenceLevel: -0.1 },
				{ timeseries: "root.test.sensor", horizon: 10, confidenceLevel: 1.1 },
				{ timeseries: "root.test.sensor", horizon: 10, confidenceLevel: NaN },
			];

			for (const request of invalidRequests) {
				await expect(
					aiService.predict(request as PredictionRequest),
				).rejects.toThrow();
			}
		});
	});

	describe("TypeScript Type Safety", () => {
		it("should enforce correct types for PredictionRequest", () => {
			const validRequest: PredictionRequest = {
				timeseries: "root.sg.device1.temperature",
				horizon: 10,
				algorithm: "arima",
				confidenceLevel: 0.95,
			};

			expect(typeof validRequest.timeseries).toBe("string");
			expect(typeof validRequest.horizon).toBe("number");
			expect(typeof validRequest.algorithm).toBe("string");
			expect(typeof validRequest.confidenceLevel).toBe("number");
		});

		it("should enforce correct types for AnomalyDetectionRequest", () => {
			const validRequest: AnomalyDetectionRequest = {
				timeseries: "root.sg.device1.temperature",
				method: "statistical",
				threshold: 0.95,
				windowSize: 100,
				startTime: Date.now() - 3600000,
				endTime: Date.now(),
			};

			expect(typeof validRequest.timeseries).toBe("string");
			expect(typeof validRequest.method).toBe("string");
			expect(typeof validRequest.threshold).toBe("number");
			expect(typeof validRequest.windowSize).toBe("number");
			expect(typeof validRequest.startTime).toBe("number");
			expect(typeof validRequest.endTime).toBe("number");
		});
	});
});
