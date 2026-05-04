import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock child_process spawn
vi.mock("child_process", () => ({
	spawn: vi.fn(),
}));

// Mock iotdb config
vi.mock("@/services/iotdb/client", () => ({
	iotdbConfig: {
		host: "localhost",
		port: 6667,
		username: "root",
		password: "password",
	},
}));

import { spawn } from "node:child_process";
import * as RpcClientModule from "@/services/iotdb/rpc-client";

const spawnMock = spawn as vi.Mock;

// Try to get the class export
const IoTDBRPCClientClass =
	RpcClientModule.IoTDBRPCClient ||
	RpcClientModule.default?.IoTDBRPCClient ||
	(RpcClientModule as Record<string, unknown>).iotdbRPCClient?.constructor;

describe("IoTDBRPCClient", () => {
	let client: Record<string, unknown>;
	let mockStdin: Record<string, unknown>;
	let mockCli: Record<string, unknown>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers(); // Use fake timers to avoid actual setTimeout

		// Create mock CLI process
		mockStdin = {
			write: vi.fn(),
		};

		mockCli = {
			stdin: mockStdin,
			stdout: null as Record<string, unknown>,
			stderr: null as Record<string, unknown>,
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "close") {
					(mockCli as Record<string, unknown>).closeHandler = handler;
				}
				if (event === "error") {
					(mockCli as Record<string, unknown>).errorHandler = handler;
				}
				return mockCli;
			}),
			kill: vi.fn(),
		};

		mockCli.stdout = {
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "data") {
					(mockCli.stdout as Record<string, unknown>).dataHandler = handler;
				}
			}),
		};

		mockCli.stderr = {
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "data") {
					(mockCli.stderr as Record<string, unknown>).dataHandler = handler;
				}
			}),
		};

		spawnMock.mockReturnValue(mockCli);

		// Try to instantiate - if IoTDBRPCClientClass is available use it, otherwise use direct class reference
		if (IoTDBRPCClientClass && typeof IoTDBRPCClientClass === "function") {
			client = new IoTDBRPCClientClass();
		} else {
			// Fallback: access the class through the module
			const { IoTDBRPCClient } = RpcClientModule as Record<string, unknown>;
			client = new IoTDBRPCClient();
		}
	});

	afterEach(() => {
		vi.useRealTimers(); // Restore real timers after each test
	});

	describe("constructor", () => {
		test("should set correct cli path", () => {
			expect(client.cliPath).toBe(
				"/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/sbin/start-cli.sh",
			);
		});

		test("should load iotdb config", () => {
			expect(client.config).toEqual({
				host: "localhost",
				port: 6667,
				username: "root",
				password: "password",
			});
		});
	});

	describe("createTimeseries", () => {
		test("should spawn CLI with correct arguments", async () => {
			const promise = client.createTimeseries({
				path: "root.test.temp",
				dataType: "DOUBLE",
				encoding: "PLAIN",
			});

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;

			expect(spawnMock).toHaveBeenCalledWith(
				"/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/sbin/start-cli.sh",
				["-h", "localhost", "-p", "6667", "-u", "root", "-pw", "password"],
			);
		});

		test("should send correct SQL to CLI", async () => {
			const promise = client.createTimeseries({
				path: "root.test.temp",
				dataType: "DOUBLE",
				encoding: "PLAIN",
			});

			expect(mockStdin.write).toHaveBeenCalledWith(
				"CREATE TIMESERIES root.test.temp WITH DATATYPE=DOUBLE, ENCODING=PLAIN",
			);
			expect(mockStdin.write).toHaveBeenCalledWith("\n");
			expect(mockStdin.write).toHaveBeenCalledWith("quit\n");

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});

		test("should resolve on successful execution", async () => {
			const promise = client.createTimeseries({
				path: "root.test.temp",
				dataType: "DOUBLE",
				encoding: "PLAIN",
			});

			if (mockCli.stdout?.dataHandler) {
				mockCli.stdout.dataHandler(
					Buffer.from("Msg: The statement is executed successfully"),
				);
			}

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await expect(promise).resolves.toEqual({
				success: true,
				output: "Msg: The statement is executed successfully",
			});
		});

		test("should reject on CLI execution failure", async () => {
			const promise = client.createTimeseries({
				path: "root.test.temp",
				dataType: "DOUBLE",
				encoding: "PLAIN",
			});

			if (mockCli.stderr?.dataHandler) {
				mockCli.stderr.dataHandler(
					Buffer.from("Error: Timeseries already exists"),
				);
			}

			if (mockCli.closeHandler) {
				mockCli.closeHandler(1);
			}

			await expect(promise).rejects.toThrow("CLI execution failed");
		});
	});

	describe("insertRecords", () => {
		test("should insert multiple records correctly", async () => {
			const records = [
				{
					device: "root.test",
					measurements: ["temperature", "humidity"],
					values: [25.5, 60],
					timestamp: 1000,
				},
				{
					device: "root.test",
					measurements: ["temperature", "humidity"],
					values: [26.0, 62],
					timestamp: 2000,
				},
			];

			const promise = client.insertRecords(records);

			// The implementation joins statements with semicolons
			const calls = (mockStdin.write as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
			const sqlCall = calls.find((c: string) => c.includes("INSERT INTO"));

			expect(sqlCall).toContain(
				"INSERT INTO root.test(time, temperature, humidity) VALUES (1000, 25.5, 60)",
			);
			expect(sqlCall).toContain(
				"INSERT INTO root.test(time, temperature, humidity) VALUES (2000, 26, 62)",
			);

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});

		test("should handle single record", async () => {
			const records = [
				{
					device: "root.test",
					measurements: ["temperature"],
					values: [25.5],
					timestamp: 1000,
				},
			];

			const promise = client.insertRecords(records);

			expect(mockStdin.write).toHaveBeenCalledWith(
				"INSERT INTO root.test(time, temperature) VALUES (1000, 25.5);",
			);

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});
	});

	describe("insertOneRecord", () => {
		test("should insert single record from object", async () => {
			const record = {
				device: "root.test",
				timestamp: 1000,
				measurements: {
					temperature: 25.5,
					humidity: 60,
				},
			};

			const promise = client.insertOneRecord(record);

			const calls = mockStdin.write.mock.calls;
			const sqlCall = calls.find((call: unknown[]) =>
				call[0]?.includes("INSERT INTO"),
			);

			expect(sqlCall).toBeDefined();
			expect(sqlCall?.[0]).toContain("INSERT INTO root.test(time,");
			expect(sqlCall?.[0]).toContain(") VALUES (1000,");

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});
	});

	describe("deleteData", () => {
		test("should delete without time range", async () => {
			const promise = client.deleteData({
				path: "root.test.temp",
			});

			expect(mockStdin.write).toHaveBeenCalledWith(
				"DELETE FROM root.test.temp",
			);

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});

		test("should delete with time range", async () => {
			const promise = client.deleteData({
				path: "root.test.temp",
				startTime: 1000,
				endTime: 5000,
			});

			expect(mockStdin.write).toHaveBeenCalledWith(
				"DELETE FROM root.test.temp WHERE time >= 1000 AND time <= 5000",
			);

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});
	});

	describe("deleteTimeseries", () => {
		test("should drop timeseries", async () => {
			const promise = client.deleteTimeseries("root.test.temp");

			expect(mockStdin.write).toHaveBeenCalledWith(
				"DROP TIMESERIES root.test.temp",
			);

			if (mockCli.closeHandler) {
				mockCli.closeHandler(0);
			}

			await promise;
		});
	});

	describe("error handling", () => {
		test("should accept success message in output", async () => {
			const promise = client.createTimeseries({
				path: "root.test.temp",
				dataType: "DOUBLE",
				encoding: "PLAIN",
			});

			if (mockCli.stdout?.dataHandler) {
				mockCli.stdout.dataHandler(
					Buffer.from("Msg: The statement is executed successfully"),
				);
			}

			if (mockCli.closeHandler) {
				mockCli.closeHandler(1);
			}

			await expect(promise).resolves.toEqual({
				success: true,
				output: "Msg: The statement is executed successfully",
			});
		});

		test("should handle timeout", async () => {
			vi.useFakeTimers();

			const promise = client.createTimeseries({
				path: "root.test.temp",
				dataType: "DOUBLE",
				encoding: "PLAIN",
			});

			vi.advanceTimersByTime(30000);

			expect(mockCli.kill).toHaveBeenCalled();

			await expect(promise).rejects.toThrow("CLI execution timeout");

			vi.useRealTimers();
		}, 35000);
	});
});
