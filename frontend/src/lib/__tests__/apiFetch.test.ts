import { ApiFetchError, apiFetch } from "../apiFetch";

// authFetch is the seam below apiFetch — passthrough to a stubbed global
// fetch so these tests exercise only apiFetch's error contract (the body
// message extraction the TD-8 migration relies on).
jest.mock("@/utils/auth", () => ({
	authFetch: jest.fn((url: string, init?: RequestInit) => fetch(url, init)),
}));

global.fetch = jest.fn();

function jsonResponse(body: unknown, ok: boolean, status = 200, statusText = "") {
	return {
		ok,
		status,
		statusText,
		json: async () => body,
	};
}

describe("apiFetch", () => {
	const fetchMock = global.fetch as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns the parsed JSON body on success", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [1, 2] }, true));

		await expect(apiFetch("/api/x")).resolves.toEqual({ success: true, data: [1, 2] });
	});

	it("throws ApiFetchError carrying the nested error message ({error:{message}})", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ error: { message: "Commodity not found" } }, false, 404, "Not Found"),
		);

		const err = (await apiFetch("/api/x").catch((e) => e)) as ApiFetchError;
		expect(err).toBeInstanceOf(ApiFetchError);
		expect(err.status).toBe(404);
		expect(err.message).toBe("Commodity not found");
		expect(err.body).toEqual({ error: { message: "Commodity not found" } });
	});

	it("throws ApiFetchError carrying the flat auth message ({message})", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ message: "Invalid credentials" }, false, 401));

		const err = (await apiFetch("/api/x").catch((e) => e)) as ApiFetchError;
		expect(err).toBeInstanceOf(ApiFetchError);
		expect(err.status).toBe(401);
		expect(err.message).toBe("Invalid credentials");
	});

	it("throws ApiFetchError carrying a bare string error field", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: "Name already taken" }, false, 409));

		const err = (await apiFetch("/api/x").catch((e) => e)) as ApiFetchError;
		expect(err).toBeInstanceOf(ApiFetchError);
		expect(err.message).toBe("Name already taken");
	});

	it("falls back to the status line when the error body is not JSON", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 502,
			statusText: "Bad Gateway",
			json: async () => {
				throw new SyntaxError("Unexpected token < in JSON");
			},
		});

		const err = (await apiFetch("/api/x").catch((e) => e)) as ApiFetchError;
		expect(err).toBeInstanceOf(ApiFetchError);
		expect(err.status).toBe(502);
		expect(err.message).toBe("HTTP 502 Bad Gateway");
		expect(err.body).toBeUndefined();
	});

	it("falls back to the status line when the error body has no usable message", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ foo: "bar" }, false, 500, "Internal Server Error"));

		const err = (await apiFetch("/api/x").catch((e) => e)) as ApiFetchError;
		expect(err).toBeInstanceOf(ApiFetchError);
		expect(err.message).toBe("HTTP 500 Internal Server Error");
	});
});
