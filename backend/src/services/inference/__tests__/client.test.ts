/**
 * Inference client retry logic tests.
 *
 * The predict() function retries transient failures (5xx, network errors,
 * timeouts) but must NOT retry deterministic 4xx client errors — the request
 * itself is invalid (degenerate series, unsupported model) and a second
 * identical attempt cannot succeed. Retrying 4xx wastes an inference slot +
 * adds 1s backoff + doubles latency for no benefit.
 *
 * These tests mock global.fetch to simulate each failure mode and verify the
 * retry count + error message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { predict } from "@/services/inference/client";

const VALID_REQUEST = {
	values: [1, 2, 3, 4, 5],
	timestamps: [1000, 2000, 3000, 4000, 5000],
	model_id: "arima",
	horizon: 3,
} as const;

function mockResponse(status: number, body: unknown): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
		json: () => Promise.resolve(body),
	} as Response;
}

describe("predict retry logic", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns the response on success (no retry)", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			mockResponse(200, {
				timestamps: [6000, 7000, 8000],
				values: [6, 7, 8],
				lower_bound: null,
				upper_bound: null,
				model_id: "arima",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await predict({ ...VALID_REQUEST });
		expect(result.values).toEqual([6, 7, 8]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does NOT retry on 422 (deterministic client error)", async () => {
		// 422 = degenerate series / malformed input. Retrying the identical
		// request cannot succeed.
		const fetchMock = vi.fn().mockResolvedValue(mockResponse(422, "degenerate series"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(predict({ ...VALID_REQUEST })).rejects.toThrow("422");
		// Must have called fetch exactly ONCE — no retry.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does NOT retry on 400 (bad request)", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse(400, "invalid model_id"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(predict({ ...VALID_REQUEST })).rejects.toThrow("400");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("retries on 500 (transient server error)", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse(500, "internal error"))
			.mockResolvedValueOnce(
				mockResponse(200, {
					timestamps: [6000],
					values: [6],
					lower_bound: null,
					upper_bound: null,
					model_id: "arima",
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await predict({ ...VALID_REQUEST });
		expect(result.values).toEqual([6]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries on network error (fetch throws)", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(
				mockResponse(200, {
					timestamps: [6000],
					values: [6],
					lower_bound: null,
					upper_bound: null,
					model_id: "arima",
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await predict({ ...VALID_REQUEST });
		expect(result.values).toEqual([6]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("gives up after 2 attempts on persistent 500", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse(503, "service unavailable"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(predict({ ...VALID_REQUEST })).rejects.toThrow("503");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
