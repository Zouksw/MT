/**
 * Authentication test helpers
 *
 * Provides utility functions for creating and managing test users,
 * authentication tokens, and permissions.
 */

import { type User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/jwt';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  token?: string;
}

/**
 * Creates a test user with hashed password
 *
 * @param overrides - Partial user data to override defaults
 * @returns Test user object with plain text password (for testing login)
 *
 * @example
 * ```typescript
 * const user = await createTestUser({ role: 'ADMIN' });
 * // Use user.email and user.password for login tests
 * ```
 */
export async function createTestUser(overrides: Partial<User> = {}): Promise<TestUser> {
  const password = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const timestamp = Date.now();
  const userData: Partial<User> = {
    email: `test-${timestamp}@example.com`,
    name: 'Test User',
    role: UserRole.VIEWER,
    passwordHash,
    ...overrides,
  };

  // Note: This helper doesn't create the user in the database.
  // For database creation, use your Prisma client in tests:
  // const user = await prisma.user.create({ data: userData });
  //
  // This helper provides the data structure and password hashing.
  const user = {
    id: `test-user-id-${timestamp}`,
    ...userData,
    password,
  } as TestUser;

  return user;
}

/**
 * Creates a test user with a valid JWT token
 *
 * @param overrides - Partial user data to override defaults
 * @returns Test user object with JWT token
 *
 * @example
 * ```typescript
 * const user = await createTestUserWithToken();
 * // Use user.token in Authorization header
 * ```
 */
export async function createTestUserWithToken(overrides: Partial<User> = {}): Promise<TestUser> {
  const user = await createTestUser(overrides);
  user.token = generateToken(user.id);
  return user;
}

/**
 * Creates multiple test users with different roles
 *
 * @param count - Number of users to create
 * @param role - Role for all users (default: 'USER')
 * @returns Array of test users
 *
 * @example
 * ```typescript
 * const admins = await createTestUsers(5, 'ADMIN');
 * const users = await createTestUsers(10, UserRole.VIEWER);
 * ```
 */
export async function createTestUsers(count: number, role: UserRole = UserRole.VIEWER): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `test-user-${i}-${Date.now()}@example.com`,
      name: `Test User ${i}`,
      role,
    });
    users.push(user);
  }
  return users;
}

/**
 * Generates authentication headers for a test user
 *
 * @param token - JWT token
 * @returns Headers object with Authorization
 *
 * @example
 * ```typescript
 * const headers = getAuthHeaders(user.token);
 * await request(app).get('/api/users').set(headers);
 * ```
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Creates expired token for testing token expiration
 *
 * @returns Expired JWT token
 *
 * @example
 * ```typescript
 * const expiredToken = createExpiredToken();
 * // Test that expired tokens are rejected
 * ```
 */
export function createExpiredToken(): string {
  // Token that expired in the past (1 hour ago)
  const payload = {
    userId: 'test-user-id',
    role: UserRole.VIEWER as UserRole,
    iat: Math.floor(Date.now() / 1000) - 7200, // Issued 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
