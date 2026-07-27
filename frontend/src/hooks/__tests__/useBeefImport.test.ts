import { act, renderHook, waitFor } from "@testing-library/react";
import { tokenManager } from "@/lib/tokenManager";
import { useBeefImport } from "../useBeefImport";

// Mock tokenManager so we can control the bearer header.
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: jest.fn(() => "test-token") },
}));

const mockedToken = tokenManager as jest.Mocked<typeof tokenManager>;

function mockFetchResponse(body: unknown, ok = true, status = 200) {
	return jest.fn().mockResolvedValue({
		ok,
		status,
		json: async () => body,
	});
}

describe("useBeefImport", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedToken.getToken.mockReturnValue("test-token");
	});

	it("starts idle with no result", () => {
		const { result } = renderHook(() => useBeefImport());
		expect(result.current.status).toBe("idle");
		expect(result.current.result).toBeNull();
		expect(result.current.error).toBeNull();
	});

	it("uploads successfully and stores the result", async () => {
		const response = {
			success: true,
			data: { imported: 5, updated: 2, skipped: 0, errors: [] },
		};
		global.fetch = mockFetchResponse(response, true, 201);

		const { result } = renderHook(() => useBeefImport());
		const file = new File(["a,b\n1,2"], "prices.csv", { type: "text/csv" });

		await act(async () => {
			await result.current.upload(file);
		});

		expect(result.current.status).toBe("success");
		expect(result.current.result).toEqual({
			imported: 5,
			updated: 2,
			skipped: 0,
			errors: [],
		});

		// Verify FormData + auth header were sent.
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/beef/import"),
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
			}),
		);
		const callBody = (global.fetch as jest.Mock).mock.calls[0][1].body;
		expect(callBody).toBeInstanceOf(FormData);
	});

	it("surfaces a 403 as an admin-only error", async () => {
		global.fetch = mockFetchResponse(
			{ success: false, error: { message: "Forbidden" } },
			false,
			403,
		);

		const { result } = renderHook(() => useBeefImport());
		const file = new File(["a"], "prices.csv", { type: "text/csv" });

		await act(async () => {
			await result.current.upload(file);
		});

		expect(result.current.status).toBe("error");
		expect(result.current.error).toContain("administrators");
	});

	it("surfaces a network error", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("Network down"));

		const { result } = renderHook(() => useBeefImport());
		const file = new File(["a"], "prices.csv", { type: "text/csv" });

		await act(async () => {
			await result.current.upload(file);
		});

		expect(result.current.status).toBe("error");
		expect(result.current.error).toBe("Network down");
	});

	it("reset() returns to idle", async () => {
		global.fetch = mockFetchResponse(
			{ success: true, data: { imported: 1, updated: 0, skipped: 0, errors: [] } },
			true,
			201,
		);
		const { result } = renderHook(() => useBeefImport());

		await act(async () => {
			await result.current.upload(new File(["a"], "p.csv", { type: "text/csv" }));
		});
		expect(result.current.status).toBe("success");

		act(() => result.current.reset());

		await waitFor(() => {
			expect(result.current.status).toBe("idle");
			expect(result.current.result).toBeNull();
		});
	});
});
