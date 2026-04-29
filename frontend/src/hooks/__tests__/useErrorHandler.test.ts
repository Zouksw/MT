import { renderHook, act } from '@testing-library/react';
import { useErrorHandler, isNetworkError, isAuthError } from '../useErrorHandler';

// Mock useToast
const mockToast = {
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showInfo: jest.fn(),
  showWarning: jest.fn(),
};

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => mockToast,
}));

describe('useErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseErrorMessage', () => {
    it('should return string error as is', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage('String error')).toBe('String error');
    });

    it('should extract error property from object', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage({ error: 'API error occurred' })).toBe('API error occurred');
    });

    it('should extract message property from object', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage({ message: 'Message error occurred' })).toBe('Message error occurred');
    });

    it('should extract error from response.data', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage({ response: { data: { error: 'Response error' } } })).toBe('Response error');
    });

    it('should extract message from response.data', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage({ response: { data: { message: 'Response message' } } })).toBe('Response message');
    });

    it('should extract message from Error object', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage(new Error('Error object message'))).toBe('Error object message');
    });

    it('should return default message for unknown error', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage({ unknown: 'value' })).toBe('An unexpected error occurred');
    });

    it('should return default message for null', () => {
      const { result } = renderHook(() => useErrorHandler());
      expect(result.current.parseErrorMessage(null)).toBe('An unexpected error occurred');
    });
  });

  describe('handleError', () => {
    it('should show error toast by default', () => {
      const { result } = renderHook(() => useErrorHandler());
      act(() => { result.current.handleError('Test error'); });
      expect(mockToast.showError).toHaveBeenCalledWith('Test error', undefined);
    });

    it('should log error to console by default', () => {
      const { result } = renderHook(() => useErrorHandler());
      act(() => { result.current.handleError('Test error'); });
      expect(console.error).toHaveBeenCalledWith('Error handled:', 'Test error');
    });

    it('should not log error when logError is false', () => {
      const { result } = renderHook(() => useErrorHandler());
      act(() => { result.current.handleError('Test error', { logError: false }); });
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should return parsed error message', () => {
      const { result } = renderHook(() => useErrorHandler());
      let returnedMessage: string = '';
      act(() => { returnedMessage = result.current.handleError('Test error'); });
      expect(returnedMessage).toBe('Test error');
    });
  });

  describe('withErrorHandling', () => {
    it('should return operation result on success', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const operation = jest.fn().mockResolvedValue('success');
      const value = await act(async () => result.current.withErrorHandling(operation));
      expect(value).toBe('success');
      expect(mockToast.showError).not.toHaveBeenCalled();
    });

    it('should handle error and return null on failure', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const value = await act(async () => result.current.withErrorHandling(operation));
      expect(value).toBeNull();
      expect(mockToast.showError).toHaveBeenCalledWith('Operation failed', undefined);
    });
  });

  describe('showSuccess', () => {
    it('should show success toast', () => {
      const { result } = renderHook(() => useErrorHandler());
      act(() => { result.current.showSuccess('Success!'); });
      expect(mockToast.showSuccess).toHaveBeenCalledWith('Success!');
    });
  });

  describe('showInfo', () => {
    it('should show info toast', () => {
      const { result } = renderHook(() => useErrorHandler());
      act(() => { result.current.showInfo('Info message'); });
      expect(mockToast.showInfo).toHaveBeenCalledWith('Info message');
    });
  });

  describe('showWarning', () => {
    it('should show warning toast', () => {
      const { result } = renderHook(() => useErrorHandler());
      act(() => { result.current.showWarning('Warning!'); });
      expect(mockToast.showWarning).toHaveBeenCalledWith('Warning!');
    });
  });
});

describe('isNetworkError', () => {
  it('should return true for network error message', () => {
    expect(isNetworkError(new Error('Network error'))).toBe(true);
  });
  it('should return true for fetch error message', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
  });
  it('should return false for other errors', () => {
    expect(isNetworkError(new Error('Validation failed'))).toBe(false);
  });
  it('should return false for null', () => {
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('isAuthError', () => {
  it('should return true for 401 status code', () => {
    expect(isAuthError({ statusCode: 401 })).toBe(true);
  });
  it('should return true for 403 status code', () => {
    expect(isAuthError({ statusCode: 403 })).toBe(true);
  });
  it('should return false for other status codes', () => {
    expect(isAuthError({ statusCode: 404 })).toBe(false);
  });
  it('should return true for response with 401 status', () => {
    expect(isAuthError({ response: { status: 401 } })).toBe(true);
  });
  it('should return false for null', () => {
    expect(isAuthError(null)).toBe(false);
  });
});
