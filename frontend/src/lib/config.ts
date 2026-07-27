/**
 * Frontend runtime configuration — single source of truth.
 *
 * Every component/hook that needs the backend base URL imports from here
 * instead of re-declaring `const API_BASE = process.env...` locally. This
 * avoids the 14+ scattered definitions that drifted in value (some appended
 * /api, some used "" for Next.js rewrites) and makes the env var name + fallback
 * changeable in one place.
 *
 * The base URL points at the Express backend (default :8000). API paths in
 * callers include their own /api prefix (e.g. "/api/beef/prices"), so this
 * constant is the bare origin with no path suffix.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
