import type { NextFunction, Request, Response } from "express";
import { jwtUtils, logger, prisma } from "@/lib";
import { isTokenBlacklisted } from "@/services/tokenBlacklist";

export interface AuthRequest extends Request {
	userId?: string;
	user?: {
		id: string;
		email: string;
		name: string;
		role: string;
	};
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader?.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				error: { message: "No token provided", code: "UNAUTHORIZED" },
			});
		}

		const token = authHeader.substring(7);

		// Check if token is blacklisted
		if (await isTokenBlacklisted(token)) {
			logger.warn(`Blacklisted token used from IP: ${req.ip}`);
			return res.status(401).json({
				success: false,
				error: { message: "Token has been revoked", code: "UNAUTHORIZED" },
			});
		}

		try {
			const payload = jwtUtils.verifyToken(token);
			req.userId = payload.userId;

			// Fetch full user object with role information
			const user = await prisma.user.findUnique({
				where: { id: payload.userId },
				select: { id: true, email: true, name: true, role: true },
			});

			if (!user) {
				return res.status(401).json({
					success: false,
					error: { message: "User not found", code: "UNAUTHORIZED" },
				});
			}

			req.user = user;

			// Update active session count (sampled to avoid performance impact)
			if (Math.random() < 0.01) {
				// 1% sampling
				// Count active sessions in the last 15 minutes
				const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
				prisma.user
					.count({
						where: {
							lastLoginAt: {
								gte: fifteenMinutesAgo,
							},
						},
					})
					.then((_count) => {})
					.catch((err) => {
						logger.error(`Failed to count active sessions: ${err}`);
					});
			}

			next();
		} catch (_error) {
			return res.status(401).json({
				success: false,
				error: { message: "Invalid or expired token", code: "UNAUTHORIZED" },
			});
		}
	} catch (error) {
		logger.error(`Authentication error: ${error} from IP: ${req.ip}`);
		res.status(500).json({
			success: false,
			error: { message: "Authentication failed", code: "INTERNAL_ERROR" },
		});
	}
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
	return async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			if (!req.userId) {
				return res.status(401).json({
					success: false,
					error: { message: "Authentication required", code: "UNAUTHORIZED" },
				});
			}

			if (!req.user) {
				return res.status(401).json({
					success: false,
					error: {
						message: "User information not found",
						code: "UNAUTHORIZED",
					},
				});
			}

			// Check if user's role is in the allowed roles list
			if (!roles.includes(req.user.role)) {
				return res.status(403).json({
					success: false,
					error: {
						message: "Insufficient permissions",
						code: "FORBIDDEN",
					},
				});
			}

			next();
		} catch (error) {
			logger.error(`Authorization error for user ${req.userId} (${req.user?.role}): ${error}`);
			res.status(500).json({
				success: false,
				error: { message: "Authorization failed", code: "INTERNAL_ERROR" },
			});
		}
	};
};
