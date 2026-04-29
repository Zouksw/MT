/**
 * User test fixtures
 *
 * Pre-defined user data for testing different scenarios
 */

import { type User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Standard test user fixture
 */
export const standardUser: Partial<User> = {
  email: 'test.user@example.com',
  name: 'Standard Test User',
  role: UserRole.VIEWER,
};

/**
 * Admin user fixture
 */
export const adminUser: Partial<User> = {
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN',
};

/**
 * Premium user fixture
 */
export const premiumUser: Partial<User> = {
  email: 'premium@example.com',
  name: 'Premium User',
  role: UserRole.EDITOR,
};

/**
 * User fixture with all fields populated
 */
export const fullUser: Partial<User> = {
  email: 'full.user@example.com',
  name: 'Full Test User',
  role: UserRole.VIEWER,
};

/**
 * Invalid user fixtures for testing validation
 */
export const invalidUsers = {
  noEmail: {
    name: 'No Email User',
    role: UserRole.VIEWER as UserRole,
  },
  invalidEmail: {
    email: 'not-an-email',
    name: 'Invalid Email User',
    role: UserRole.VIEWER as UserRole,
  },
  noName: {
    email: 'noname@example.com',
    role: UserRole.VIEWER as UserRole,
  },
  noRole: {
    email: 'norole@example.com',
    name: 'No Role User',
  },
  weakPassword: {
    email: 'weak@example.com',
    name: 'Weak Password User',
    role: UserRole.VIEWER as UserRole,
  },
};

/**
 * User fixtures for edge cases
 */
export const edgeCaseUsers = {
  veryLongName: {
    email: 'longname@example.com',
    name: 'A'.repeat(300), // Exceeds typical database limits
    role: UserRole.VIEWER as UserRole,
  },
  specialCharsInName: {
    email: 'special@example.com',
    name: "Test O'Connor-Österreich",
    role: UserRole.VIEWER as UserRole,
  },
  unicodeEmail: {
    email: 'test@例え.jp',
    name: 'Unicode User',
    role: UserRole.VIEWER as UserRole,
  },
};

/**
 * Batch user fixtures for load testing
 *
 * @param count - Number of users to generate
 * @param role - Role for all users
 * @returns Array of user fixtures
 */
export function generateUserFixtures(
  count: number,
  role: UserRole = UserRole.VIEWER
): Partial<User>[] {
  const users: Partial<User>[] = [];
  for (let i = 0; i < count; i++) {
    users.push({
      email: `user.${i}@example.com`,
      name: `User ${i}`,
      role,
    });
  }
  return users;
}

/**
 * User fixture with hashed password
 *
 * @param plainPassword - Plain text password to hash
 * @returns User fixture with passwordHash
 */
export async function createUserWithPassword(
  plainPassword: string
): Promise<Partial<User>> {
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  return {
    email: 'user.with.password@example.com',
    name: 'User With Password',
    role: UserRole.VIEWER,
    passwordHash,
  };
}

/**
 * Pre-defined password fixtures for testing
 */
export const passwordFixtures = {
  valid: 'ValidPassword123!',
  weak: '123',
  medium: 'password123',
  strong: 'Str0ng!Pass@#$%',
  veryLong: `${'a'.repeat(100)}1A!`,
};

/**
 * User login scenarios for testing authentication
 */
export const loginScenarios = {
  valid: {
    email: 'valid@example.com',
    password: 'ValidPassword123!',
    shouldSucceed: true,
  },
  wrongPassword: {
    email: 'valid@example.com',
    password: 'WrongPassword123!',
    shouldSucceed: false,
  },
  nonExistentUser: {
    email: 'nonexistent@example.com',
    password: 'SomePassword123!',
    shouldSucceed: false,
  },
  emptyPassword: {
    email: 'valid@example.com',
    password: '',
    shouldSucceed: false,
  },
  emptyEmail: {
    email: '',
    password: 'SomePassword123!',
    shouldSucceed: false,
  },
};

/**
 * User permission scenarios
 */
export const permissionScenarios = {
  admin: {
    role: 'ADMIN' as UserRole,
    canAccessAdminRoutes: true,
    canCreateUsers: true,
    canDeleteUsers: true,
  },
  premium: {
    role: UserRole.EDITOR as UserRole,
    canAccessAdminRoutes: false,
    canCreateUsers: false,
    canDeleteUsers: false,
    canAccessPremiumFeatures: true,
  },
  user: {
    role: UserRole.VIEWER as UserRole,
    canAccessAdminRoutes: false,
    canCreateUsers: false,
    canDeleteUsers: false,
    canAccessPremiumFeatures: false,
  },
};
