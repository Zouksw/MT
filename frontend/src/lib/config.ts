/**
 * Frontend runtime configuration — single source of truth.
 *
 * Every component/hook that needs the backend base URL imports from here
 * instead of re-declaring `const API_BASE = process.env...` locally. This
 * avoids the 14+ scattered definitions that drifted in value (some appended
 * /api, some used "" for Next.js rewrites) and makes the env var name + fallback
 * changeable in one place.
 *
 * Default is SAME-ORIGIN (""): every request goes through the Next.js rewrite
 * (next.config.ts proxies /api/* → Express). The previous default of an absolute
 * http://localhost:8000 origin was baked into the production bundle at build
 * time, so any browser not on the server itself resolved localhost:8000 against
 * the visitor's machine, and even on-box browsers hit the backend's production
 * CORS guard (preflight 500 — localhost origins rejected when NODE_ENV=production),
 * leaving AuthContext permanently unauthenticated. Same-origin requests ride
 * the rewrite/nginx proxy and never trigger CORS at all.
 *
 * Set NEXT_PUBLIC_API_URL only for a split-origin deployment (frontend and API
 * on different hostnames). API paths in callers include their own /api prefix
 * (e.g. "/api/beef/prices"), so the value is a bare origin with no path suffix.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
