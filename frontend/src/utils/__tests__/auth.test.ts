/**
 * Tests for auth utility functions
 * Tests the authentication utilities that wrap tokenManager
 */

import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  clearAuthTokens,
  getAuthHeader,
  authFetch,
  isAuthenticated,
  getCachedUser,
  setCachedUser,
  clearCachedUser,
  verifyAuthentication,
} from '../auth';

// Mock dependencies
jest.mock('@/lib/tokenManager', () => ({
  tokenManager: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    removeToken: jest.fn(),
    isTokenValid: jest.fn(),
  },
}));

// csrf module no longer exists — authFetch does not add CSRF headers

// Mock fetch globally
global.fetch = jest.fn();

describe('auth utilities', () => {
  const { tokenManager } = require('@/lib/tokenManager');

  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthToken', () => {
    it('should return token from tokenManager', () => {
      tokenManager.getToken.mockReturnValue('test-jwt-token');
      const result = getAuthToken();
      expect(result).toBe('test-jwt-token');
      expect(tokenManager.getToken).toHaveBeenCalled();
    });

    it('should return null when token does not exist', () => {
      tokenManager.getToken.mockReturnValue(null);
      const result = getAuthToken();
      expect(result).toBeNull();
    });
  });

  describe('setAuthToken', () => {
    it('should set token via tokenManager', () => {
      setAuthToken('new-jwt-token');
      expect(tokenManager.setToken).toHaveBeenCalledWith('new-jwt-token', undefined);
    });

    it('should set token with rememberMe flag', () => {
      setAuthToken('new-jwt-token', true);
      expect(tokenManager.setToken).toHaveBeenCalledWith('new-jwt-token', true);
    });
  });

  describe('removeAuthToken', () => {
    it('should remove token via tokenManager', () => {
      removeAuthToken();
      expect(tokenManager.removeToken).toHaveBeenCalled();
    });
  });

  describe('clearAuthTokens', () => {
    it('should remove token via tokenManager', () => {
      clearAuthTokens();
      expect(tokenManager.removeToken).toHaveBeenCalled();
    });
  });

  describe('getAuthHeader', () => {
    it('should return Authorization header when token exists', () => {
      tokenManager.getToken.mockReturnValue('test-token');
      const result = getAuthHeader();
      expect(result).toEqual({ Authorization: 'Bearer test-token' });
    });

    it('should return undefined when token does not exist', () => {
      tokenManager.getToken.mockReturnValue(null);
      const result = getAuthHeader();
      expect(result).toBeUndefined();
    });
  });

  describe('authFetch', () => {
    it('should make fetch request with auth headers', async () => {
      tokenManager.getToken.mockReturnValue('test-token');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await authFetch('/api/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should make fetch request without auth headers when no token', async () => {
      tokenManager.getToken.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await authFetch('/api/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.not.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });

    it('should merge custom headers with auth headers', async () => {
      tokenManager.getToken.mockReturnValue('test-token');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await authFetch('/api/test', {
        method: 'POST',
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should include content-type header for POST requests', async () => {
      tokenManager.getToken.mockReturnValue('test-token');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await authFetch('/api/test', { method: 'POST' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists and is valid', () => {
      tokenManager.getToken.mockReturnValue('valid-token');
      tokenManager.isTokenValid.mockReturnValue(true);
      expect(isAuthenticated()).toBe(true);
    });

    it('should return false when token does not exist', () => {
      tokenManager.getToken.mockReturnValue(null);
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false when token is invalid', () => {
      tokenManager.getToken.mockReturnValue('invalid-token');
      tokenManager.isTokenValid.mockReturnValue(false);
      expect(isAuthenticated()).toBe(false);
    });

    it('should warn in development when not authenticated', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      tokenManager.getToken.mockReturnValue(null);
      isAuthenticated();

      expect(warnSpy).toHaveBeenCalledWith(
        '[DEPRECATED] isAuthenticated() only checks memory. Use verifyAuthentication() instead.'
      );

      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = originalEnv;
    });
  });

  describe('verifyAuthentication', () => {
    it('should return true when server confirms authentication', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });
      tokenManager.getToken.mockReturnValue('test-token');

      const result = await verifyAuthentication();
      expect(result).toBe(true);
    });

    it('should return false when server returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });
      tokenManager.getToken.mockReturnValue('test-token');

      const result = await verifyAuthentication();
      expect(result).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      tokenManager.getToken.mockReturnValue('test-token');

      const result = await verifyAuthentication();
      expect(result).toBe(false);
    });
  });

  describe('getCachedUser', () => {
    it('should return parsed user object from localStorage', () => {
      const testUser = { id: '1', name: 'Test User', email: 'test@example.com' };
      localStorageMock.setItem('user', JSON.stringify(testUser));

      const result = getCachedUser();

      expect(result).toEqual(testUser);
    });

    it('should return null when user does not exist', () => {
      const result = getCachedUser();
      expect(result).toBeNull();
    });

    it('should return null when user data is invalid JSON', () => {
      localStorageMock.setItem('user', 'invalid-json');
      const result = getCachedUser();
      expect(result).toBeNull();
    });
  });

  describe('setCachedUser', () => {
    it('should store safe user object in localStorage as JSON string', () => {
      const testUser = { id: '1', name: 'Test User', email: 'test@example.com', avatar: 'avatar.jpg', roles: ['USER'] };

      setCachedUser(testUser);

      const stored = localStorageMock.getItem('user');
      const parsedUser = JSON.parse(stored!);
      expect(parsedUser).toEqual({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'avatar.jpg',
        roles: ['USER']
      });
    });

    it('should not store sensitive data like password', () => {
      const testUser = { id: '1', name: 'Test User', email: 'test@test.com', password: 'secret123', apiKey: 'key-123' };

      setCachedUser(testUser as any);

      const stored = localStorageMock.getItem('user');
      const parsedUser = JSON.parse(stored!);
      expect(parsedUser.password).toBeUndefined();
      expect(parsedUser.apiKey).toBeUndefined();
    });
  });

  describe('clearCachedUser', () => {
    it('should remove user from localStorage', () => {
      localStorageMock.setItem('user', JSON.stringify({ id: '1' }));

      clearCachedUser();

      expect(localStorageMock.getItem('user')).toBeNull();
    });
  });
});
