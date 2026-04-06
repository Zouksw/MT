/**
 * CSRF Protection Module
 *
 * NOTE: CSRF protection has been removed from the backend.
 * This module is kept for compatibility but does not enforce CSRF.
 * All methods return empty values to allow the app to function normally.
 */

class CsrfProtection {
  private token: string | null = null;
  private readonly STORAGE_KEY = 'csrf_token';
  private readonly TOKEN_ENDPOINT = '/api/auth/csrf-token'; // Matches backend endpoint
  private readonly HEADER_NAME = 'x-csrf-token'; // Matches backend header name (lowercase)
  private initialized = false;

  /**
   * Initialize CSRF protection - NOOP since CSRF was removed from backend
   */
  async initialize(): Promise<void> {
    // Mark as initialized without fetching token
    this.initialized = true;
  }

  /**
   * Get auth headers for API requests
   * Includes auth token if available from tokenManager
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Note: Auth token is handled by HttpOnly cookie set by backend
    // We don't need to manually add Authorization header for most requests
    // The backend will read the token from the HttpOnly cookie

    return headers;
  }

  /**
   * Get current CSRF token
   */
  getToken(): string | null {
    if (this.token) {
      return this.token;
    }

    // Fallback to sessionStorage
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.token = stored;
        return this.token;
      }
    }

    return null;
  }

  /**
   * Get headers object with CSRF token for API requests
   * Returns empty object since CSRF was removed from backend
   */
  getHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Check if CSRF protection is ready
   */
  isReady(): boolean {
    return this.initialized && this.token !== null;
  }

  /**
   * Refresh CSRF token from backend
   * Call this after user actions that might require token refresh
   */
  async refresh(): Promise<void> {
    this.initialized = false;
    this.token = null;
    await this.initialize();
  }

  /**
   * Set CSRF token manually (for responses that include new token)
   */
  setToken(token: string): void {
    this.token = token;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.STORAGE_KEY, token);
    }
  }

  /**
   * Clear CSRF token (e.g., after logout)
   */
  clear(): void {
    this.token = null;
    this.initialized = false;

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Get CSRF token for use in forms (hidden input)
   */
  getFormToken(): string {
    return this.getToken() || '';
  }

  /**
   * Get the header name used for CSRF token
   */
  getHeaderName(): string {
    return this.HEADER_NAME;
  }

  /**
   * Get the cookie name used by backend
   */
  getCookieName(): string {
    return 'csrf_token';
  }
}

// Export singleton instance
export const csrfProtection = new CsrfProtection();

// Auto-initialize on client side
if (typeof window !== 'undefined') {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      csrfProtection.initialize().catch(() => { /* CSRF init failed */ });
    });
  } else {
    // Already loaded
    csrfProtection.initialize().catch(() => { /* CSRF init failed */ });
  }
}
