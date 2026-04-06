/**
 * Rate Limiter
 *
 * Client-side rate limiting to prevent abuse and protect against DoS.
 * Works in conjunction with server-side rate limiting.
 */

import { auditLogger, logSecurityEvents } from './auditLogger';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Rate limit state
 */
interface RateLimitState {
  count: number;
  resetTime: number;
  blocked: boolean;
}

/**
 * Rate limiter options
 */
interface RateLimiterOptions {
  onLimitReached?: (key: string) => void;
  onLimitReset?: (key: string) => void;
}

/**
 * Client-side rate limiter using token bucket algorithm
 */
class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions = {}) {
    this.options = options;

    // Cleanup expired limits every minute
    if (typeof window !== 'undefined') {
      window.setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Check if a request is allowed under the rate limit
   * @param key - Unique identifier for this rate limit (e.g., 'login', 'api')
   * @param config - Rate limit configuration
   * @returns true if request is allowed, false if rate limited
   */
  canMakeRequest(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    let state = this.limits.get(key);

    // Initialize new limit state
    if (!state || now > state.resetTime) {
      state = {
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false,
      };
      this.limits.set(key, state);

      // Notify reset if previously blocked
      if (this.options.onLimitReset) {
        this.options.onLimitReset(key);
      }
    }

    // Check if currently blocked
    if (state.blocked) {
      const timeRemaining = Math.ceil((state.resetTime - now) / 1000);
      auditLogger.log('RATE_LIMIT_EXCEEDED', {
        key,
        timeRemaining,
      }, 'high');
      return false;
    }

    // Increment counter
    state.count++;

    // Check if limit exceeded
    if (state.count > config.maxRequests) {
      state.blocked = true;

      // Log security event
      logSecurityEvents.rateLimitExceeded(key);

      // Notify callback
      if (this.options.onLimitReached) {
        this.options.onLimitReached(key);
      }

      return false;
    }

    return true;
  }

  /**
   * Reset rate limit for a specific key
   * @param key - Key to reset
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.limits.clear();
  }

  /**
   * Get current state for a key
   * @param key - Rate limit key
   * @returns Current state or undefined if not tracked
   */
  getState(key: string): RateLimitState | undefined {
    return this.limits.get(key);
  }

  /**
   * Get remaining requests for a key
   * @param key - Rate limit key
   * @param config - Rate limit configuration
   * @returns Number of remaining requests
   */
  getRemaining(key: string, config: RateLimitConfig): number {
    const state = this.limits.get(key);
    if (!state || Date.now() > state.resetTime) {
      return config.maxRequests;
    }
    return Math.max(0, config.maxRequests - state.count);
  }

  /**
   * Get time until limit resets
   * @param key - Rate limit key
   * @returns Seconds until reset, or 0 if no limit active
   */
  getResetTime(key: string): number {
    const state = this.limits.get(key);
    if (!state) {
      return 0;
    }
    return Math.max(0, Math.ceil((state.resetTime - Date.now()) / 1000));
  }

  /**
   * Cleanup expired limits
   */
  private cleanup(): void {
    const now = Date.now();
    this.limits.forEach((state, key) => {
      if (now > state.resetTime) {
        this.limits.delete(key);
      }
    });
  }

  /**
   * Get all active limits
   */
  getAllStates(): Map<string, RateLimitState> {
    return new Map(this.limits);
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter({
  onLimitReached: (key) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(`[RateLimiter] Limit exceeded for: ${key}`);
    }
  },
  onLimitReset: (key) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[RateLimiter] Limit reset for: ${key}`);
    }
  },
});

/**
 * Predefined rate limit configurations
 */
export const rateLimits = {
  // Authentication endpoints
  login: { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute
  register: { maxRequests: 3, windowMs: 3600000 }, // 3 per hour
  forgotPassword: { maxRequests: 3, windowMs: 3600000 }, // 3 per hour

  // API endpoints
  apiRequest: { maxRequests: 100, windowMs: 60000 }, // 100 per minute
  dataQuery: { maxRequests: 50, windowMs: 60000 }, // 50 per minute
  dataWrite: { maxRequests: 20, windowMs: 60000 }, // 20 per minute

  // Form submissions
  formSubmit: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  contactForm: { maxRequests: 3, windowMs: 3600000 }, // 3 per hour

  // File operations
  fileUpload: { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  fileDownload: { maxRequests: 20, windowMs: 60000 }, // 20 per minute

  // Search
  search: { maxRequests: 30, windowMs: 60000 }, // 30 per minute

  // AI features
  aiQuery: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  aiPrediction: { maxRequests: 5, windowMs: 60000 }, // 5 per minute
};

/**
 * Rate limiter hook for React components
 */
export function useRateLimit(key: string, config: RateLimitConfig) {
  const checkRateLimit = (): { allowed: boolean; remaining: number; resetTime: number } => {
    const allowed = rateLimiter.canMakeRequest(key, config);
    const remaining = rateLimiter.getRemaining(key, config);
    const resetTime = rateLimiter.getResetTime(key);

    return { allowed, remaining, resetTime };
  };

  const reset = () => {
    rateLimiter.reset(key);
  };

  return {
    checkRateLimit,
    reset,
    getRemaining: () => rateLimiter.getRemaining(key, config),
    getResetTime: () => rateLimiter.getResetTime(key),
  };
}

/**
 * Decorator for rate-limited async functions
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  key: string,
  config: RateLimitConfig,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!rateLimiter.canMakeRequest(key, config)) {
      const resetTime = rateLimiter.getResetTime(key);
      throw new RateLimitError(key, resetTime);
    }
    return fn(...args);
  }) as T;
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(public key: string, public resetTime: number) {
    super(`Rate limit exceeded for: ${key}. Try again in ${resetTime} seconds.`);
    this.name = 'RateLimitError';
  }
}

/**
 * Rate limiter for form submissions
 */
export class FormRateLimiter {
  private key: string;
  private config: RateLimitConfig;

  constructor(formName: string, config?: Partial<RateLimitConfig>) {
    this.key = `form:${formName}`;
    this.config = {
      maxRequests: config?.maxRequests || rateLimits.formSubmit.maxRequests,
      windowMs: config?.windowMs || rateLimits.formSubmit.windowMs,
    };
  }

  canSubmit(): { allowed: boolean; remaining: number; resetTime: number } {
    const allowed = rateLimiter.canMakeRequest(this.key, this.config);
    const remaining = rateLimiter.getRemaining(this.key, this.config);
    const resetTime = rateLimiter.getResetTime(this.key);

    return { allowed, remaining, resetTime };
  }

  reset(): void {
    rateLimiter.reset(this.key);
  }
}

/**
 * Rate limiter for API requests
 */
export class ApiRateLimiter {
  private key: string;
  private config: RateLimitConfig;

  constructor(endpoint: string, config?: Partial<RateLimitConfig>) {
    this.key = `api:${endpoint}`;
    this.config = {
      maxRequests: config?.maxRequests || rateLimits.apiRequest.maxRequests,
      windowMs: config?.windowMs || rateLimits.apiRequest.windowMs,
    };
  }

  canRequest(): { allowed: boolean; remaining: number; resetTime: number } {
    const allowed = rateLimiter.canMakeRequest(this.key, this.config);
    const remaining = rateLimiter.getRemaining(this.key, this.config);
    const resetTime = rateLimiter.getResetTime(this.key);

    return { allowed, remaining, resetTime };
  }

  reset(): void {
    rateLimiter.reset(this.key);
  }
}
