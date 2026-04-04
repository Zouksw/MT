/**
 * CSP Nonce Management
 *
 * Provides cryptographic nonce values for Content Security Policy.
 * Nonces are used to allow specific inline scripts while maintaining CSP security.
 */

let nonce: string | null = null;
const NONCE_LENGTH = 16;
const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a cryptographically random nonce string
 * Uses crypto.getRandomValues for secure random generation
 */
function generateNonce(): string {
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment - use crypto API
    const array = new Uint8Array(NONCE_LENGTH);
    window.crypto.getRandomValues(array);

    let result = '';
    for (let i = 0; i < NONCE_LENGTH; i++) {
      result += NONCE_ALPHABET[array[i] % NONCE_ALPHABET.length];
    }
    return result;
  } else if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) {
    // Node.js environment - use dynamic import for crypto
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    return crypto.randomBytes(NONCE_LENGTH).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, NONCE_LENGTH);
  } else {
    // Fallback - less secure but functional
    let result = '';
    for (let i = 0; i < NONCE_LENGTH; i++) {
      result += NONCE_ALPHABET[Math.floor(Math.random() * NONCE_ALPHABET.length)];
    }
    return result;
  }
}

/**
 * Set the nonce value (typically called by server during SSR)
 * @param value - The nonce string to use
 */
export function setNonce(value: string): void {
  nonce = value;
}

/**
 * Get the current nonce value
 * Generates a new one if not set
 * @returns Current nonce string
 */
export function getNonce(): string {
  if (!nonce) {
    nonce = generateNonce();
  }
  return nonce;
}

/**
 * Reset the nonce (typically called between page navigations)
 */
export function resetNonce(): void {
  nonce = null;
}

/**
 * Generate a fresh nonce
 * @returns New nonce string
 */
export function generateFreshNonce(): string {
  nonce = generateNonce();
  return nonce;
}

/**
 * Get the nonce attribute for HTML elements
 * @returns Attribute string like 'nonce="abc123"'
 */
export function getNonceAttribute(): string {
  return `nonce="${getNonce()}"`;
}

/**
 * CSP script source with nonce
 * @returns CSP policy string for scripts with nonce
 */
export function getScriptNoncePolicy(): string {
  return `'nonce-${getNonce()}'`;
}

/**
 * CSP style source with nonce
 * @returns CSP policy string for styles with nonce
 */
export function getStyleNoncePolicy(): string {
  return `'nonce-${getNonce()}'`;
}

/**
 * Export nonce for use in Next.js headers
 */
export function getNonceForHeaders(): { 'x-nonce': string } {
  return {
    'x-nonce': getNonce(),
  };
}

/**
 * Initialize nonce for the current request
 * Call this at the beginning of each page render
 */
export function initializeNonce(): string {
  return generateFreshNonce();
}
