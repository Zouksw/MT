/**
 * Account Lockout Service
 *
 * Prevents brute force attacks by locking accounts after multiple failed login attempts
 */

import { logger } from "@/lib";
import { redis } from "@/lib/redis";

const LOCKOUT_PREFIX = "auth:lockout:";
const ATTEMPTS_PREFIX = "auth:attempts:";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
const ATTEMPT_WINDOW = 15 * 60; // 15 minutes in seconds

export interface LockoutInfo {
	isLocked: boolean;
	remainingAttempts?: number;
	lockoutUntil?: Date;
}

/**
 * Check if an account is locked due to too many failed login attempts
 */
export async function checkAccountLockout(
	identifier: string,
): Promise<LockoutInfo> {
	try {
		const lockoutKey = `${LOCKOUT_PREFIX}${identifier}`;
		const attemptsKey = `${ATTEMPTS_PREFIX}${identifier}`;
		const redisClient = await redis();

		// Check if account is currently locked out
		const lockoutTTL = await redisClient.ttl(lockoutKey);

		if (lockoutTTL > 0) {
			const lockoutUntil = new Date(Date.now() + lockoutTTL * 1000);
			logger.warn(
				`[AUTH_LOCKOUT] Account ${identifier} is locked until ${lockoutUntil}`,
			);
			return {
				isLocked: true,
				lockoutUntil,
				remainingAttempts: 0,
			};
		}

		// Check current attempt count
		const attempts = await redisClient.get(attemptsKey);
		const currentAttempts = attempts ? parseInt(attempts, 10) : 0;
		const remainingAttempts = Math.max(0, MAX_ATTEMPTS - currentAttempts);

		return {
			isLocked: false,
			remainingAttempts,
		};
	} catch (error) {
		logger.error(
			`[AUTH_LOCKOUT] Error checking lockout for ${identifier}:`,
			error,
		);
		// Fail closed - if Redis is down, assume account might be locked
		return {
			isLocked: true,
			remainingAttempts: 0,
		};
	}
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
	identifier: string,
	ipAddress: string,
): Promise<void> {
	try {
		const attemptsKey = `${ATTEMPTS_PREFIX}${identifier}`;
		const lockoutKey = `${LOCKOUT_PREFIX}${identifier}`;
		const redisClient = await redis();

		// Increment attempt counter
		const attempts = await redisClient.incr(attemptsKey);

		// Set expiration on first attempt
		if (attempts === 1) {
			await redisClient.expire(attemptsKey, ATTEMPT_WINDOW);
		}

		logger.warn(
			`[AUTH_LOCKOUT] Failed login for ${identifier} from ${ipAddress} (${attempts}/${MAX_ATTEMPTS} attempts)`,
		);

		// Lock out if max attempts reached
		if (attempts >= MAX_ATTEMPTS) {
			await redisClient.set(lockoutKey, "1", { EX: LOCKOUT_DURATION });
			logger.error(
				`[AUTH_LOCKOUT] Account ${identifier} locked out after ${attempts} failed attempts from ${ipAddress}`,
			);
		}
	} catch (error) {
		// Consistent error handling: fail-closed in production, fail-open in development
		logger.error(
			`[AUTH_LOCKOUT] Error recording failed login for ${identifier}:`,
			error,
		);
		if (process.env.NODE_ENV === "production") {
			// In production, throw to prevent login attempts when Redis is down
			throw new Error(
				"Unable to process login attempt due to system error. Please try again later.",
			);
		}
		// In development, allow login to proceed for easier debugging
	}
}

/**
 * Clear failed login attempts after successful login
 */
export async function clearFailedLoginAttempts(
	identifier: string,
): Promise<void> {
	try {
		const attemptsKey = `${ATTEMPTS_PREFIX}${identifier}`;
		const redisClient = await redis();

		await redisClient.del(attemptsKey);
		logger.info(
			`[AUTH_LOCKOUT] Cleared failed login attempts for ${identifier}`,
		);
	} catch (error) {
		// Consistent error handling: fail-closed in production, fail-open in development
		logger.error(
			`[AUTH_LOCKOUT] Error clearing attempts for ${identifier}:`,
			error,
		);
		if (process.env.NODE_ENV === "production") {
			// In production, throw to prevent login when Redis is down
			throw new Error(
				"Unable to clear login state due to system error. Please contact support.",
			);
		}
		// In development, allow login to succeed for easier debugging
	}
}

/**
 * Format lockout time to human-readable string
 */
export function formatLockoutTime(date: Date): string {
	const minutes = Math.ceil((date.getTime() - Date.now()) / (1000 * 60));
	return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}
