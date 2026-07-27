export interface InferencePredictRequest {
	values: number[];
	timestamps: number[];
	model_id: string;
	horizon: number;
	confidence_level?: number;
}

export interface InferencePredictResponse {
	timestamps: number[];
	values: number[];
	lower_bound: number[] | null;
	upper_bound: number[] | null;
	model_id: string;
}

export interface PredictionRequest {
	commodityId: string;
	horizon: number;
	algorithm?: string;
	confidenceLevel?: number;
}

export interface PredictionResult {
	timestamps: number[];
	values: number[];
	lowerBound?: number[];
	upperBound?: number[];
}

/**
 * Shape of the inference service's /ready response body.
 * Mirrors inference-service/services/inference_engine.py:readiness_state().
 */
export interface InferenceReadyState {
	ready: boolean;
	chronos_usable_variants: Record<string, boolean>;
	chronos_pipelines_loaded: string[];
	preload_failures: Record<string, string>;
	ready_variants: string[];
}

/**
 * Backend-facing readiness summary. `alive` is the liveness signal (process
 * up), `ready` is the readiness signal (chronos ensemble usable). They differ
 * when the inference process is up but chronos weights are missing — in that
 * case statistical baselines still serve /predict, so the platform is
 * degraded, not down.
 */
export interface InferenceReadiness {
	alive: boolean;
	ready: boolean;
	readyVariants: string[];
	detail?: InferenceReadyState;
}

const INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:10810";
const CONNECT_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 120_000;

async function fetchWithTimeout(
	url: string,
	options: RequestInit,
	timeout: number,
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

export async function healthCheck(): Promise<boolean> {
	try {
		const res = await fetchWithTimeout(`${INFERENCE_URL}/health`, {}, CONNECT_TIMEOUT);
		return res.ok;
	} catch {
		// intentionally ignored — inference service unavailable
		return false;
	}
}

/**
 * Probe the inference service's /ready endpoint.
 *
 * Unlike healthCheck() (which hits /health — a pure liveness probe that
 * returns ok as long as the process is up), this hits /ready, which returns
 * 200 only when at least one chronos variant has cached weights AND a loaded
 * pipeline. On 503 the body still carries the diagnostic state (which
 * variants are blocked, preload failures) so callers can report *why* chronos
 * is unavailable rather than just that it is.
 *
 * Returns alive+ready so the health endpoint can distinguish "process down"
 * from "process up, chronos degraded" — the latter still serves statistical
 * baselines, so the platform is partially functional.
 */
export async function checkReadiness(): Promise<InferenceReadiness> {
	// Liveness first: if /health fails, /ready would too, and there'd be no
	// body to parse. Short-circuit to {alive:false, ready:false}.
	const alive = await healthCheck();
	if (!alive) {
		return { alive: false, ready: false, readyVariants: [] };
	}

	try {
		const res = await fetchWithTimeout(`${INFERENCE_URL}/ready`, {}, CONNECT_TIMEOUT);
		// 200 = ready; 503 = not ready but body still has diagnostics.
		const body = (await res.json().catch(() => null)) as InferenceReadyState | null;
		if (!body || typeof body.ready !== "boolean") {
			// No body or unexpected shape — trust the HTTP status only.
			return { alive: true, ready: res.ok, readyVariants: [] };
		}
		return {
			alive: true,
			// Double-check both the HTTP status and the body's own flag:
			// a 200 with ready=false (or vice versa) shouldn't happen, but
			// if it does we treat the more conservative signal as truth.
			ready: Boolean(res.ok && body.ready),
			readyVariants: body.ready_variants ?? [],
			detail: body,
		};
	} catch {
		// Network/timeout on /ready specifically (process was alive per /health).
		// Treat as not-ready rather than crashing the health endpoint.
		return { alive: true, ready: false, readyVariants: [] };
	}
}

export async function predict(request: InferencePredictRequest): Promise<InferencePredictResponse> {
	const url = `${INFERENCE_URL}/predict`;
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await fetchWithTimeout(
				url,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(request),
				},
				REQUEST_TIMEOUT,
			);

			if (!res.ok) {
				const body = await res.text().catch(() => "unknown error"); // intentionally ignored — fallback for error body
				throw new Error(`Inference service ${res.status}: ${body}`);
			}

			return (await res.json()) as InferencePredictResponse;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			if (attempt === 0) {
				await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
			}
		}
	}

	throw new Error(`Prediction failed after retries: ${lastError?.message}`);
}

export async function predictFromCache(request: PredictionRequest): Promise<PredictionResult> {
	const { getCommodityPriceValues } = await import("./data-fetcher");
	const { values, timestamps } = await getCommodityPriceValues(request.commodityId, 200);

	const result = await predict({
		values,
		timestamps,
		model_id: request.algorithm || "chronos_tiny",
		horizon: request.horizon,
		confidence_level: request.confidenceLevel || 0.95,
	});

	return {
		timestamps: result.timestamps,
		values: result.values,
		lowerBound: result.lower_bound ?? undefined,
		upperBound: result.upper_bound ?? undefined,
	};
}
