/**
 * Session Monitor
 *
 * Monitors user session activity and manages session timeout.
 * Detects inactivity and handles session expiration gracefully.
 */

import { auditLogger, logAuthEvents } from './auditLogger';
import { tokenManager } from './tokenManager';

/**
 * Session monitor configuration
 */
interface SessionMonitorConfig {
  inactivityTimeout: number; // Milliseconds of inactivity before timeout
  warningTime: number; // Milliseconds before timeout to show warning
  checkInterval: number; // How often to check activity
  enableWarning: boolean; // Show timeout warning
}

/**
 * Activity events that reset the inactivity timer
 */
const ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'input',
  'change',
];

/**
 * Session state
 */
interface SessionState {
  lastActivity: number;
  isWarningShown: boolean;
  isExpired: boolean;
}

/**
 * Session Monitor
 *
 * Tracks user activity and manages session timeout.
 */
class SessionMonitor {
  private config: SessionMonitorConfig = {
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes
    checkInterval: 60 * 1000, // 1 minute
    enableWarning: true,
  };

  private state: SessionState = {
    lastActivity: Date.now(),
    isWarningShown: false,
    isExpired: false,
  };

  private checkTimer: NodeJS.Timeout | null = null;
  private activityListenersAttached = false;

  /**
   * Start monitoring session activity
   */
  start(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.checkTimer) {
      return; // Already started
    }

    // Setup activity listeners
    this.attachActivityListeners();

    // Start periodic checks
    this.checkTimer = setInterval(() => {
      this.checkSession();
    }, this.config.checkInterval);

    // Log session start
    auditLogger.log('LOGIN_SUCCESS', {
      timeout: this.config.inactivityTimeout,
    }, 'low');

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[SessionMonitor] Started monitoring');
    }
  }

  /**
   * Stop monitoring session activity
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    this.detachActivityListeners();

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[SessionMonitor] Stopped monitoring');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SessionMonitorConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart if interval changed
    if (config.checkInterval && this.checkTimer) {
      this.stop();
      this.start();
    }
  }

  /**
   * Manually update activity timestamp
   */
  updateActivity(): void {
    this.state.lastActivity = Date.now();
    this.state.isWarningShown = false;
  }

  /**
   * Get time until session expires
   */
  getTimeUntilExpiry(): number {
    const elapsed = Date.now() - this.state.lastActivity;
    return Math.max(0, this.config.inactivityTimeout - elapsed);
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    return Date.now() - this.state.lastActivity > this.config.inactivityTimeout;
  }

  /**
   * Get remaining time in minutes
   */
  getRemainingMinutes(): number {
    return Math.ceil(this.getTimeUntilExpiry() / 60000);
  }

  /**
   * Check session status and handle timeout
   */
  private checkSession(): void {
    const elapsed = Date.now() - this.state.lastActivity;
    const timeRemaining = this.config.inactivityTimeout - elapsed;

    // Session expired
    if (timeRemaining <= 0) {
      this.handleSessionTimeout();
      return;
    }

    // Show warning
    if (
      this.config.enableWarning &&
      !this.state.isWarningShown &&
      timeRemaining <= this.config.warningTime
    ) {
      this.showWarning();
    }
  }

  /**
   * Handle session timeout
   */
  private handleSessionTimeout(): void {
    if (this.state.isExpired) {
      return; // Already handled
    }

    this.state.isExpired = true;

    // Log security event
    logAuthEvents.tokenExpired('inactivity_timeout');

    // Clear tokens
    tokenManager.removeToken();

    // Stop monitoring
    this.stop();

    // Dispatch custom event
    const event = new CustomEvent('session-expired', {
      detail: { reason: 'inactivity' },
    });
    window.dispatchEvent(event);

    // Redirect to login (with slight delay for event handlers)
    setTimeout(() => {
      // Check if navigation is supported (not in jsdom test environment)
      if (typeof window.location.assign === 'function' || process.env.NODE_ENV === 'production') {
        try {
          const currentUrl = window.location.href;
          window.location.href = `/login?reason=session_expired&redirect=${encodeURIComponent(currentUrl)}`;
        } catch {
          // Navigation failed - ignore in tests
        }
      }
    }, 1000);

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[SessionMonitor] Session expired due to inactivity');
    }
  }

  /**
   * Show timeout warning to user
   */
  private showWarning(): void {
    this.state.isWarningShown = true;

    // Dispatch custom event
    const event = new CustomEvent('session-warning', {
      detail: {
        remainingMinutes: this.getRemainingMinutes(),
        warningTime: this.config.warningTime,
      },
    });
    window.dispatchEvent(event);

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[SessionMonitor] Session timeout warning triggered');
    }
  }

  /**
   * Attach activity event listeners
   */
  private attachActivityListeners(): void {
    if (this.activityListenersAttached || typeof window === 'undefined') {
      return;
    }

    const handler = () => this.updateActivity();

    ACTIVITY_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, handler, { passive: true });
    });

    this.activityListenersAttached = true;
  }

  /**
   * Detach activity event listeners
   */
  private detachActivityListeners(): void {
    if (!this.activityListenersAttached || typeof window === 'undefined') {
      return;
    }

    const handler = () => this.updateActivity();

    ACTIVITY_EVENTS.forEach(eventName => {
      window.removeEventListener(eventName, handler);
    });

    this.activityListenersAttached = false;
  }

  /**
   * Get current state (for debugging)
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Reset session state
   */
  reset(): void {
    this.state = {
      lastActivity: Date.now(),
      isWarningShown: false,
      isExpired: false,
    };
  }
}

// Export singleton instance
export const sessionMonitor = new SessionMonitor();

/**
 * React hook for session monitoring
 */
export function useSessionMonitor() {
  const start = () => sessionMonitor.start();
  const stop = () => sessionMonitor.stop();
  const reset = () => sessionMonitor.reset();
  const isExpired = () => sessionMonitor.isExpired();
  const getTimeUntilExpiry = () => sessionMonitor.getTimeUntilExpiry();
  const getRemainingMinutes = () => sessionMonitor.getRemainingMinutes();

  return {
    start,
    stop,
    reset,
    isExpired,
    getTimeUntilExpiry,
    getRemainingMinutes,
  };
}

/**
 * Hook for session warning event
 */
export function useSessionWarning(callback: (remainingMinutes: number) => void) {
  if (typeof window === 'undefined') {
    return;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ remainingMinutes: number }>;
    callback(customEvent.detail.remainingMinutes);
  };

  window.addEventListener('session-warning', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('session-warning', handler);
  };
}

/**
 * Hook for session expired event
 */
export function useSessionExpired(callback: (reason: string) => void) {
  if (typeof window === 'undefined') {
    return;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ reason: string }>;
    callback(customEvent.detail.reason);
  };

  window.addEventListener('session-expired', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('session-expired', handler);
  };
}

/**
 * Auto-start session monitor on user login
 */
export function initSessionMonitor() {
  if (typeof window !== 'undefined') {
    // Check if user is logged in
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (user) {
      sessionMonitor.start();
    }
  }
}
