import type { NextFunction, Request, Response } from "express";
import { logger } from "@/lib/logger";
import { get, set } from "@/services/cache";

interface CachedRequest extends Request {
	cacheKey?: string;
	cacheTTL?: number;
}

const cacheResponse = (options: { ttl?: number; keyGenerator?: (req: Request) => string }) => {
	const { ttl = 300, keyGenerator } = options;

	return async (req: CachedRequest, res: Response, next: NextFunction) => {
		if (req.method !== "GET") {
			return next();
		}

		const cacheKey = keyGenerator
			? keyGenerator(req)
			: `http:${req.path}:${JSON.stringify(req.query)}`;

		req.cacheKey = cacheKey;
		req.cacheTTL = ttl;

		const cached = await get(cacheKey);

		if (cached) {
			res.setHeader("X-Cache", "HIT");
			res.setHeader("Cache-Control", `max-age=${ttl}`);

			return res.json(cached);
		}

		res.setHeader("X-Cache", "MISS");

		const originalJson = res.json.bind(res);

		res.json = ((body: unknown): Response => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				set(cacheKey, body, ttl).catch((err) => {
					logger.error("Cache set error:", err);
				});
			}

			return originalJson(body) as Response;
		}) as typeof res.json;

		next();
	};
};

export { cacheResponse };
