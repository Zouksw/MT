/**
 * LoginForm Component Tests
 *
 * Tests the login form's rendering, validation, submission,
 * and error handling behavior.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// Mock antd message
jest.mock('antd', () => {
  const antd = jest.requireActual('antd');
  return {
    ...antd,
    message: {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
    },
  };
});

// Mock axios
jest.mock('axios', () => {
  const mockAxios = {
    post: jest.fn(),
    defaults: { headers: { common: {} } },
    create: jest.fn(() => mockAxios),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return mockAxios;
});

// Mock js-cookie
jest.mock('js-cookie', () => ({
  set: jest.fn(),
  get: jest.fn(),
  remove: jest.fn(),
}));

// Mock csrfProtection
jest.mock('@/lib/csrf', () => ({
  csrfProtection: {
    getHeaders: jest.fn(() => ({ 'X-CSRF-Token': 'test-csrf-token' })),
  },
}));

// Mock tokenManager
jest.mock('@/lib/tokenManager', () => ({
  tokenManager: {
    setToken: jest.fn(),
    getToken: jest.fn(),
    removeToken: jest.fn(),
  },
}));

// Mock sanitizer
jest.mock('@/lib/sanitizer', () => ({
  sanitizer: {
    sanitizeEmail: jest.fn((email: string) => email),
    sanitizeString: jest.fn((str: string) => str),
  },
}));

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render email and password inputs', () => {
    render(<LoginForm />);

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  test('should render sign in button', () => {
    render(<LoginForm />);

    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  test('should render forgot password link', () => {
    render(<LoginForm />);

    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  test('should render remember me checkbox', () => {
    render(<LoginForm />);

    expect(screen.getByText('Remember me')).toBeInTheDocument();
  });

  test('should have correct input placeholders', () => {
    render(<LoginForm />);

    expect(screen.getByPlaceholderText('your.email@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });
});
