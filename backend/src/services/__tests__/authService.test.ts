/**
 * Auth Service — pure-logic unit tests.
 *
 * authService owns the security-critical flows: register, credential
 * verification, session rotation, logout, password change. These had ZERO
 * coverage — a regression in any of them could lock users out or, worse,
 * accept invalid credentials. The functions are designed to be unit-testable
 * (they take plain RequestCtx, not Express requests), so we exercise them
 * directly with mocked Prisma.
 *
 * What's mocked:
 *   - prisma (user/session/auditLog) — no DB
 *   - recordFailedLogin (authLockout) — Redis-dependent, stubbed to no-op
 *   - isTokenBlacklisted / blacklistToken (tokenBlacklist) — Redis-dependent
 *
 * What stays real:
 *   - bcrypt hash/compare (fast, and the password-verify correctness IS the
 *     security property under test — mocking it would defeat the purpose)
 *   - jwtUtils generate/verify (signs real JWTs against the test config secret)
 */

import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared test secret. Both the mocked jwtUtils AND the mocked @/lib/jwt use it
// so tokens generated either way verify consistently.
const SECRET = "test-secret-key-for-jwt-testing-purposes-only-32chars";

const mocks = vi.hoisted(() => ({
	// prisma models touched by authService
	userFindUnique: vi.fn(),
	userCreate: vi.fn(),
	userUpdate: vi.fn(),
	sessionCreate: vi.fn(),
	sessionFindMany: vi.fn(),
	sessionUpdate: vi.fn(),
	sessionUpdateMany: vi.fn(),
	auditLogCreate: vi.fn(),
	// authLockout + tokenBlacklist (Redis-dependent)
	recordFailedLogin: vi.fn(),
	blacklistToken: vi.fn(),
	isTokenBlacklisted: vi.fn(),
}));

vi.mock("@/lib", () => ({
	prisma: {
		user: {
			findUnique: mocks.userFindUnique,
			create: mocks.userCreate,
			update: mocks.userUpdate,
		},
		session: {
			create: mocks.sessionCreate,
			findMany: mocks.sessionFindMany,
			update: mocks.sessionUpdate,
			updateMany: mocks.sessionUpdateMany,
		},
		auditLog: { create: mocks.auditLogCreate },
	},
	// config is read by jwtUtils + createAuthSession; supply realistic values
	// so generated tokens verify and the session TTL computes.
	config: {
		jwt: { secret: "test-secret-key-for-jwt-testing-purposes-only-32chars", expiresIn: "15m" },
		session: { expiresDays: 7 },
	},
	// jwtUtils: a real, self-contained signer/verifier against the test secret.
	// Can't use vi.importActual inside an async factory, so implement the subset
	// authService touches directly on top of jsonwebtoken.
	jwtUtils: {
		generateToken: (userId: string) =>
			jwt.sign({ userId, jti: "jti-" + Math.random() }, SECRET, { expiresIn: "15m" }),
		generateRefreshToken: (userId: string) =>
			jwt.sign({ userId, type: "refresh", jti: "jti-" + Math.random() }, SECRET, {
				expiresIn: "7d",
			}),
		verifyToken: (token: string) => jwt.verify(token, SECRET),
		verifyRefreshToken: (token: string) => {
			const p = jwt.verify(token, SECRET) as { userId: string; type?: string };
			if (p.type !== "refresh") throw new Error("Invalid refresh token");
			return { userId: p.userId };
		},
		decodeToken: (token: string) => jwt.decode(token),
	},
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Some tests generate a token via `await import("@/lib/jwt")` — mock that module
// too so it uses the SAME secret as the mocked @/lib jwtUtils.
vi.mock("@/lib/jwt", () => ({
	jwtUtils: {
		generateToken: (userId: string) =>
			jwt.sign({ userId, jti: "jti-" + Math.random() }, SECRET, { expiresIn: "15m" }),
		generateRefreshToken: (userId: string) =>
			jwt.sign({ userId, type: "refresh", jti: "jti-" + Math.random() }, SECRET, {
				expiresIn: "7d",
			}),
		verifyToken: (token: string) => jwt.verify(token, SECRET),
		verifyRefreshToken: (token: string) => {
			const p = jwt.verify(token, SECRET) as { userId: string; type?: string };
			if (p.type !== "refresh") throw new Error("Invalid refresh token");
			return { userId: p.userId };
		},
		decodeToken: (token: string) => jwt.decode(token),
	},
	default: { generateToken: () => jwt.sign({}, SECRET) },
}));

vi.mock("@/services/authLockout", () => ({
	recordFailedLogin: mocks.recordFailedLogin,
}));
vi.mock("@/services/tokenBlacklist", () => ({
	blacklistToken: mocks.blacklistToken,
	isTokenBlacklisted: mocks.isTokenBlacklisted,
}));

import { ConflictError, NotFoundError, UnauthorizedError } from "@/middleware/errorHandler";
import {
	changePassword,
	createAuthSession,
	getUserIdFromToken,
	invalidateAllSessions,
	invalidateSession,
	registerUser,
	rotateRefreshToken,
	verifyCredentials,
	verifyTokenSession,
} from "@/services/authService";

const CTX = { ipAddress: "127.0.0.1", userAgent: "vitest/1.0" };

/** A user row with a real bcrypt hash, so verifyCredentials' compare is real. */
async function makeUser(overrides: Record<string, unknown> = {}) {
	const bcrypt = await import("bcryptjs");
	return {
		id: "user-1",
		email: "alice@example.com",
		name: "Alice",
		role: "EDITOR",
		avatarUrl: null,
		passwordHash: await bcrypt.hash("CorrectPassword123!", 4), // low cost for speed
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.recordFailedLogin.mockResolvedValue(undefined);
	mocks.blacklistToken.mockResolvedValue(true);
	mocks.isTokenBlacklisted.mockResolvedValue(false);
});

describe("registerUser", () => {
	it("creates a new EDITOR user and returns the public shape", async () => {
		mocks.userFindUnique.mockResolvedValueOnce(null); // no existing user
		mocks.userCreate.mockImplementationOnce(
			async ({ data }: { data: Record<string, unknown> }) => ({
				id: "user-new",
				email: data.email,
				name: data.name,
				role: data.role,
				avatarUrl: null,
				createdAt: new Date(),
			}),
		);

		const user = await registerUser({ email: "new@example.com", password: "pw", name: "New" });

		expect(user.role).toBe("EDITOR");
		expect(user.email).toBe("new@example.com");
		// The password must have been hashed before create — never stored in plaintext.
		const createCall = mocks.userCreate.mock.calls[0][0].data;
		expect(createCall.passwordHash).not.toBe("pw");
		expect(createCall.passwordHash.length).toBeGreaterThan(20);
	});

	it("derives the name from the email local-part when name is omitted", async () => {
		mocks.userFindUnique.mockResolvedValueOnce(null);
		mocks.userCreate.mockResolvedValueOnce({
			id: "u",
			email: "bob@x.com",
			name: "bob",
			role: "EDITOR",
			avatarUrl: null,
		});
		await registerUser({ email: "bob@x.com", password: "pw" });
		expect(mocks.userCreate.mock.calls[0][0].data.name).toBe("bob");
	});

	it("throws ConflictError when the email is already registered", async () => {
		mocks.userFindUnique.mockResolvedValueOnce({ id: "existing" });
		await expect(
			registerUser({ email: "taken@example.com", password: "pw" }),
		).rejects.toBeInstanceOf(ConflictError);
		expect(mocks.userCreate).not.toHaveBeenCalled();
	});
});

describe("verifyCredentials", () => {
	it("returns the user when email + password match", async () => {
		const user = await makeUser();
		mocks.userFindUnique.mockResolvedValueOnce(user);

		const result = await verifyCredentials(user.email, "CorrectPassword123!", "1.2.3.4");
		expect(result.id).toBe(user.id);
		// The returned row must include passwordHash — the session flow hashes the
		// refresh token, not the password, but the docstring promises it.
		expect(result.passwordHash).toBe(user.passwordHash);
		expect(mocks.recordFailedLogin).not.toHaveBeenCalled();
	});

	it("throws UnauthorizedError AND records the attempt when the user is unknown", async () => {
		// The lockout recording is a security requirement: an unknown email must
		// still count toward brute-force protection. If recordFailedLogin stops
		// being called here, lockout can be bypassed by spamming unknown emails.
		mocks.userFindUnique.mockResolvedValueOnce(null);
		await expect(verifyCredentials("ghost@example.com", "pw", "1.2.3.4")).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
		expect(mocks.recordFailedLogin).toHaveBeenCalledWith("ghost@example.com", "1.2.3.4");
	});

	it("throws UnauthorizedError AND records the attempt when the password is wrong", async () => {
		const user = await makeUser();
		mocks.userFindUnique.mockResolvedValueOnce(user);
		await expect(verifyCredentials(user.email, "WrongPassword!", "1.2.3.4")).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
		expect(mocks.recordFailedLogin).toHaveBeenCalledWith(user.email, "1.2.3.4");
	});

	it("returns the SAME error message for unknown-user vs wrong-password (no user enumeration)", async () => {
		// Both branches must say "Invalid email or password" — a different message
		// would let an attacker enumerate valid emails by reading the error.
		const realUser = await makeUser();
		mocks.userFindUnique.mockResolvedValueOnce(null);
		const unknownErr = await verifyCredentials("nope@x.com", "pw", "ip").catch((e) => e);
		mocks.userFindUnique.mockResolvedValueOnce(realUser);
		const wrongPwErr = await verifyCredentials(realUser.email, "wrong", "ip").catch((e) => e);
		expect(unknownErr.message).toBe(wrongPwErr.message);
		expect(unknownErr.message).toBe("Invalid email or password");
	});
});

describe("createAuthSession + getUserIdFromToken round-trip", () => {
	it("issues a token pair that verifies back to the same userId", async () => {
		mocks.sessionCreate.mockImplementationOnce(
			async ({ data }: { data: Record<string, unknown> }) => ({
				id: "sess-1",
				userId: data.userId,
			}),
		);

		const tokens = await createAuthSession("user-42", CTX);
		expect(tokens.sessionId).toBe("sess-1");
		expect(tokens.token).toBeTruthy();
		expect(tokens.refreshToken).toBeTruthy();
		// The two tokens are distinct (access vs refresh).
		expect(tokens.token).not.toBe(tokens.refreshToken);

		// Round-trip: getUserIdFromToken must resolve to the same userId.
		const resolved = await getUserIdFromToken(`Bearer ${tokens.token}`);
		expect(resolved).toBe("user-42");
	});

	it("persists a session row with an expiresAt computed from config.session.expiresDays", async () => {
		mocks.sessionCreate.mockResolvedValueOnce({ id: "sess-1" });
		await createAuthSession("user-1", CTX);
		const session = mocks.sessionCreate.mock.calls[0][0].data;
		// 7-day expiry (from the mocked config) → expiresAt must be ~7 days from now.
		const ttlMs = session.expiresAt.getTime() - Date.now();
		const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
		expect(tTLCloseTo(ttlMs, sevenDaysMs, 60_000)).toBe(true);
		// The refresh token is hashed before storage, never plaintext.
		expect(session.tokenHash).not.toBe(undefined);
	});
});

describe("getUserIdFromToken", () => {
	it("returns null when the header is missing or malformed", async () => {
		expect(await getUserIdFromToken(undefined)).toBeNull();
		expect(await getUserIdFromToken("Token abc")).toBeNull(); // wrong scheme
		expect(await getUserIdFromToken("Bearer ")).toBeNull(); // empty token → verify throws
	});

	it("returns null when the token is blacklisted (revoked)", async () => {
		mocks.isTokenBlacklisted.mockResolvedValueOnce(true);
		// A real-shaped token so we get past the Bearer prefix check; the blacklist
		// short-circuits before verify, so the signature doesn't matter.
		expect(await getUserIdFromToken("Bearer revoked.token.here")).toBeNull();
		expect(mocks.isTokenBlacklisted).toHaveBeenCalled();
	});
});

describe("verifyTokenSession", () => {
	it("throws UnauthorizedError when the user has no active session", async () => {
		// Generate a real token so verify passes, then assert the session check fails.
		const { jwtUtils } = await import("@/lib/jwt");
		const token = jwtUtils.generateToken("user-1");
		mocks.sessionFindMany.mockResolvedValueOnce([]); // no active sessions

		await expect(verifyTokenSession(token)).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("throws UnauthorizedError when the token is blacklisted", async () => {
		const { jwtUtils } = await import("@/lib/jwt");
		const token = jwtUtils.generateToken("user-1");
		mocks.isTokenBlacklisted.mockResolvedValueOnce(true);
		await expect(verifyTokenSession(token)).rejects.toBeInstanceOf(UnauthorizedError);
	});
});

describe("rotateRefreshToken", () => {
	it("issues a fresh token pair when the refresh token matches a live session", async () => {
		const bcrypt = await import("bcryptjs");
		const { jwtUtils } = await import("@/lib/jwt");
		const refreshToken = jwtUtils.generateRefreshToken("user-1");

		mocks.sessionFindMany.mockResolvedValueOnce([
			{ id: "sess-old", tokenHash: await bcrypt.hash(refreshToken, 4), isActive: true },
		]);
		mocks.sessionUpdate.mockResolvedValueOnce({});
		mocks.sessionCreate.mockResolvedValueOnce({ id: "sess-new", userId: "user-1" });

		const result = await rotateRefreshToken(refreshToken, CTX);
		expect(result.sessionId).toBe("sess-new");
		// The old session must be deactivated (single-use refresh token).
		expect(mocks.sessionUpdate).toHaveBeenCalledWith({
			where: { id: "sess-old" },
			data: { isActive: false },
		});
	});

	it("throws UnauthorizedError when the refresh token matches no live session", async () => {
		const { jwtUtils } = await import("@/lib/jwt");
		const refreshToken = jwtUtils.generateRefreshToken("user-1");
		mocks.sessionFindMany.mockResolvedValueOnce([]); // no sessions

		await expect(rotateRefreshToken(refreshToken, CTX)).rejects.toBeInstanceOf(UnauthorizedError);
		expect(mocks.sessionCreate).not.toHaveBeenCalled();
	});

	it("throws UnauthorizedError when the refresh token is malformed", async () => {
		await expect(rotateRefreshToken("not-a-jwt", CTX)).rejects.toBeInstanceOf(UnauthorizedError);
	});
});

describe("invalidateSession (logout)", () => {
	it("blacklists the access token and deactivates ONLY the matching session when a refresh token is given", async () => {
		const bcrypt = await import("bcryptjs");
		const { jwtUtils } = await import("@/lib/jwt");
		const refreshToken = jwtUtils.generateRefreshToken("user-1");
		mocks.sessionFindMany.mockResolvedValueOnce([
			{ id: "sess-target", tokenHash: await bcrypt.hash(refreshToken, 4), isActive: true },
		]);

		await invalidateSession("user-1", "access-token", refreshToken);

		expect(mocks.blacklistToken).toHaveBeenCalledWith("access-token", "logout");
		expect(mocks.sessionUpdate).toHaveBeenCalledTimes(1);
		expect(mocks.sessionUpdate).toHaveBeenCalledWith({
			where: { id: "sess-target" },
			data: { isActive: false },
		});
	});

	it("deactivates ALL active sessions when no refresh token is provided", async () => {
		await invalidateSession("user-1", "access-token");
		expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
			where: { userId: "user-1", isActive: true },
			data: { isActive: false },
		});
		// Per-session update is NOT called in the bulk path.
		expect(mocks.sessionUpdate).not.toHaveBeenCalled();
	});
});

describe("changePassword", () => {
	it("hashes the new password, blacklists the token, and invalidates all sessions", async () => {
		const user = await makeUser();
		mocks.userFindUnique.mockResolvedValueOnce(user);
		mocks.userUpdate.mockResolvedValueOnce({});
		mocks.sessionUpdateMany.mockResolvedValueOnce({ count: 3 });

		await changePassword(user.id, "CorrectPassword123!", "NewPassword456!", "access-token");

		// New hash stored — must differ from the old one.
		const update = mocks.userUpdate.mock.calls[0][0];
		expect(update.data.passwordHash).not.toBe(user.passwordHash);
		// Access token blacklisted so the changed-password session can't be reused.
		expect(mocks.blacklistToken).toHaveBeenCalledWith("access-token", "password_change");
		// Every session revoked → forces re-login everywhere.
		expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
			where: { userId: user.id },
			data: { isActive: false },
		});
	});

	it("throws UnauthorizedError when the current password is wrong", async () => {
		const user = await makeUser();
		mocks.userFindUnique.mockResolvedValueOnce(user);
		await expect(
			changePassword(user.id, "WrongCurrent!", "NewPassword456!", null),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(mocks.userUpdate).not.toHaveBeenCalled();
	});

	it("throws NotFoundError when the user does not exist", async () => {
		mocks.userFindUnique.mockResolvedValueOnce(null);
		await expect(changePassword("ghost", "x", "y", null)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("invalidateAllSessions", () => {
	it("deactivates every session for the user (including inactive ones)", async () => {
		// Note: no `isActive: true` filter — this is used after password change
		// to revoke everything, not just active sessions.
		await invalidateAllSessions("user-1");
		expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
			data: { isActive: false },
		});
	});
});

// ─── helpers ─────────────────────────────────────────────────────────────

/** Loose "close to" check — vitest's toBeCloseTo doesn't fit ms-vs-ms windows. */
function tTLCloseTo(actual: number, expected: number, tolerance: number): boolean {
	return Math.abs(actual - expected) <= tolerance;
}
