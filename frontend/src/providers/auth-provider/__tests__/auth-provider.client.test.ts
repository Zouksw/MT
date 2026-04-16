/**
 * Tests for auth-provider.client.ts
 */

import Cookies from 'js-cookie';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    post: jest.fn(() => Promise.resolve({ data: {} })),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
  };
});

// Mock js-cookie
jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

// Mock tokenManager
jest.mock('@/lib/tokenManager', () => ({
  tokenManager: {
    setToken: jest.fn(),
    getToken: jest.fn(() => null),
    removeToken: jest.fn(),
    isTokenValid: jest.fn(() => true),
  },
}));

// Mock errorHandler
jest.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handleApiError: jest.fn((error) => ({
      message: error.response?.data?.error || error.message || 'An error occurred',
      statusCode: error.response?.status || 500,
    })),
    createSafeError: jest.fn((error) => ({
      message: error.response?.data?.error || error.message || 'An error occurred',
      statusCode: error.response?.status || 500,
    })),
    requiresReauth: jest.fn(() => false),
  },
}));

describe('authProviderClient', () => {
  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['user'],
  };
  const mockToken = 'test-jwt-token-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (Cookies.get as jest.Mock).mockReturnValue(null);
  });

  describe('login', () => {
    it('should successfully login and set auth cookie', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();

      (axios.post as jest.Mock).mockResolvedValue({
        data: { user: mockUser, token: mockToken },
      });

      const result = await authProviderClient.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        success: true,
        redirectTo: '/',
      });
      expect(Cookies.set).toHaveBeenCalledWith(
        'auth',
        JSON.stringify({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          roles: mockUser.roles,
        }),
        expect.objectContaining({
          expires: 7,
          path: '/',
          secure: false,
          sameSite: 'strict',
        })
      );
    });

    it('should handle login errors', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();
      (axios.post as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Invalid credentials' } },
      });

      const result = await authProviderClient.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should successfully register and set auth cookie', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();
      (axios.post as jest.Mock).mockResolvedValue({
        data: { user: mockUser, token: mockToken },
      });

      const result = await authProviderClient.register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(result).toEqual({
        success: true,
        redirectTo: '/',
      });
      expect(Cookies.set).toHaveBeenCalled();
    });

    it('should handle registration errors', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();
      (axios.post as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Email already exists' } },
      });

      const result = await authProviderClient.register({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Email already exists');
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear auth cookie', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();
      (axios.post as jest.Mock).mockResolvedValue({});

      const result = await authProviderClient.logout();

      expect(result).toEqual({
        success: true,
        redirectTo: '/login',
      });
      expect(Cookies.remove).toHaveBeenCalledWith('auth', { path: '/' });
    });

    it('should handle logout API errors gracefully', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 500 },
      });

      const result = await authProviderClient.logout();

      expect(result).toEqual({
        success: true,
        redirectTo: '/login',
      });
      expect(Cookies.remove).toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('should return authenticated when valid auth cookie and token exist', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(
        JSON.stringify(mockUser)
      );

      const { tokenManager } = require('@/lib/tokenManager');
      tokenManager.getToken.mockReturnValue('valid-token');
      tokenManager.isTokenValid.mockReturnValue(true);

      const { authProviderClient } = await import('../auth-provider.client');
      const axios = (await import('axios')).default.create();

      (axios.get as jest.Mock).mockResolvedValue({ data: { valid: true } });

      const result = await authProviderClient.check();

      expect(result).toEqual({
        authenticated: true,
      });
    });

    it('should return unauthenticated when no auth cookie exists', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(null);

      const { authProviderClient } = await import('../auth-provider.client');
      const result = await authProviderClient.check();

      expect(result).toEqual({
        authenticated: false,
      });
    });

    it('should return unauthenticated when auth cookie is invalid JSON', async () => {
      (Cookies.get as jest.Mock).mockReturnValue('invalid-json{');

      // Token must also be absent for unauthenticated
      const { tokenManager } = require('@/lib/tokenManager');
      tokenManager.getToken.mockReturnValue(null);

      const { authProviderClient } = await import('../auth-provider.client');
      const result = await authProviderClient.check();

      expect(result).toEqual({
        authenticated: false,
      });
    });
  });

  describe('getPermissions', () => {
    it('should return user roles from auth cookie', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(
        JSON.stringify({ ...mockUser, roles: ['admin', 'user'] })
      );

      const { authProviderClient } = await import('../auth-provider.client');
      const result = await authProviderClient.getPermissions();

      expect(result).toEqual(['admin', 'user']);
    });

    it('should return empty array when no auth cookie exists', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(null);

      const { authProviderClient } = await import('../auth-provider.client');
      const result = await authProviderClient.getPermissions();

      expect(result).toEqual([]);
    });
  });

  describe('getIdentity', () => {
    it('should return user identity from auth cookie', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(
        JSON.stringify({
          ...mockUser,
          avatar: 'https://example.com/avatar.jpg',
        })
      );

      const { authProviderClient } = await import('../auth-provider.client');
      const result = await authProviderClient.getIdentity();

      expect(result).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        roles: ['user'],
      });
    });

    it('should return null when no auth cookie exists', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(null);

      const { authProviderClient } = await import('../auth-provider.client');
      const result = await authProviderClient.getIdentity();

      expect(result).toBeNull();
    });
  });

  describe('onError', () => {
    it('should return logout true for 401 errors', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const error = {
        response: { status: 401 },
      } as any;

      const result = await authProviderClient.onError(error);

      expect(result).toEqual({
        logout: true,
      });
    });

    it('should return error object for other errors', async () => {
      const { authProviderClient } = await import('../auth-provider.client');
      const error = {
        response: { status: 403, data: { error: 'Forbidden' } },
      } as any;

      const result = await authProviderClient.onError(error);

      // Implementation returns an Error object with properties attached
      expect(result).toHaveProperty('error');
      expect(result.error).toBeInstanceOf(Error);
      // Message comes from errorHandler mock: error.response?.data?.error
      expect((result.error as any).message).toBe('Forbidden');
    });
  });
});
