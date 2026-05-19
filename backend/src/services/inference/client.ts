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
		model_id: request.algorithm || "arima",
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
