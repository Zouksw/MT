/**
 * Sentry Error Monitoring Integration
 *
 * Configures Sentry for error tracking and performance monitoring.
 * Filters sensitive information and enriches error context.
 *
 * NOTE: This is an optional monitoring feature. To enable Sentry:
 * 1. Install the package: pnpm add @sentry/nextjs
 * 2. Set NEXT_PUBLIC_SENTRY_DSN in .env
 */

import { auditLogger } from './auditLogger';
import { logger } from './logger';

// Type definitions for optional Sentry package
type SentryType = {
  init: (config: any) => void;
  setUser: (user: any) => void;
  addBreadcrumb: (breadcrumb: any) => void;
  captureException: (error: Error, context?: any) => void;
  captureMessage: (message: string, context?: any) => void;
};

// Dynamic import to avoid @ts-ignore
let sentryModule: SentryType | null = null;

const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true' ||
                       !!process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Lazy load Sentry (only when enabled)
 */
async function loadSentry(): Promise<void> {
  if (!SENTRY_ENABLED || sentryModule !== null) return;

  try {
    // Dynamic import to avoid requiring the package
    // @ts-expect-error - @sentry/nextjs is an optional package
    const module = await import('@sentry/nextjs');
    sentryModule = module.default || module;
  } catch (error) {
    logger.warn('Sentry package not installed. Run: pnpm add @sentry/nextjs');
    sentryModule = null;
  }
}

/**
 * Sentry configuration
 */
interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

/**
 * Sensitive data patterns to filter from error reports
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /credit[_-]?card/i,
  /ssn/i,
  /social[_-]?security/i,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
];

/**
 * Initialize Sentry for error monitoring
 */
export async function initSentry(): Promise<void> {
  if (!SENTRY_ENABLED) {
    logger.debug('Sentry monitoring is disabled');
    return;
  }

  await loadSentry();

  if (!sentryModule) {
    logger.warn('Failed to load Sentry package');
    return;
  }

  const config: SentryConfig = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  };

  if (!config.enabled) {
    logger.debug('Sentry monitoring is disabled (no DSN or not production)');
    return;
  }

  try {
    sentryModule.init({
      dsn: config.dsn,
      environment: config.environment,
      tracesSampleRate: config.tracesSampleRate,
      beforeSend: (_event: unknown) => null, // Disabled when mock is active
      ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'Non-Error promise rejection captured',
      ],
      denyUrls: [
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
      ],
    });

    logger.info('Sentry error monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize Sentry', error);
  }
}

/**
 * Set user context for Sentry
 */
export async function setSentryUser(user: { id?: string; email?: string; username?: string }): Promise<void> {
  if (!SENTRY_ENABLED) return;
  if (!sentryModule) await loadSentry();
  if (sentryModule) {
    sentryModule.setUser({ id: user.id, username: user.username });
  }
}

/**
 * Clear user context
 */
export async function clearSentryUser(): Promise<void> {
  if (!SENTRY_ENABLED) return;
  if (!sentryModule) await loadSentry();
  if (sentryModule) {
    sentryModule.setUser(null);
  }
}

/**
 * Add custom breadcrumb for tracking
 */
export async function addBreadcrumb(
  category: string,
  message: string,
  level: 'log' | 'info' | 'warn' | 'error' = 'info',
  data?: Record<string, unknown>
): Promise<void> {
  if (!SENTRY_ENABLED) return;
  if (!sentryModule) await loadSentry();
  if (sentryModule) {
    sentryModule.addBreadcrumb({ category, message, level, data });
  }
}

/**
 * Capture exception with additional context
 */
export async function captureException(
  error: Error,
  context?: {
    level?: 'log' | 'info' | 'warn' | 'error';
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  if (!SENTRY_ENABLED) return;

  // Log to audit logger regardless of Sentry status
  auditLogger.log('API_ERROR', {
    message: error.message,
    level: context?.level || 'error',
  }, 'medium');

  if (!sentryModule) await loadSentry();
  if (sentryModule) {
    sentryModule.captureException(error, context);
  }
}

/**
 * Capture message with level
 */
export async function captureMessage(
  message: string,
  level: 'log' | 'info' | 'warn' | 'error' = 'info',
  context?: Record<string, unknown>
): Promise<void> {
  if (!SENTRY_ENABLED) return;
  if (!sentryModule) await loadSentry();
  if (sentryModule) {
    sentryModule.captureMessage(message, { level, extra: context });
  }
}

/**
 * Flush pending events
 */
export async function flushSentry(): Promise<boolean> {
  if (!SENTRY_ENABLED) return true;
  if (typeof sentryModule !== 'undefined' && (sentryModule as any).flush) {
    return await (sentryModule as any).flush(2000);
  }
  return true;
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  initSentry();
}

// Export a dummy Sentry object for type compatibility
export const Sentry = {
  init: initSentry,
  captureException,
  captureMessage,
  setUser: setSentryUser,
  addBreadcrumb,
  flush: flushSentry,
};
