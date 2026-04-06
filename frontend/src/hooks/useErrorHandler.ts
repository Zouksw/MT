/**
 * Standardized Error Handling Hook
 *
 * Provides consistent error handling patterns across the application.
 * Wraps Ant Design's message/notification for user-friendly error display.
 */

import { message, notification } from "antd";
import { useCallback } from "react";

export interface ErrorHandlerOptions {
  /**
   * Whether to show the error as a notification instead of a message
   * @default false
   */
  useNotification?: boolean;

  /**
   * Duration in seconds to display the message
   * @default 5
   */
  duration?: number;

  /**
   * Additional description to show with the error
   */
  description?: string;

  /**
   * Whether to log the error to console
   * @default true
   */
  logError?: boolean;
}

export interface ApiError {
  message?: string;
  error?: string;
  statusCode?: number;
  details?: unknown;
}

/**
 * Hook for handling errors consistently across the application
 */
export function useErrorHandler() {
  /**
   * Parse an error object to extract the error message
   */
  const parseErrorMessage = useCallback(
    (error: unknown): string => {
      if (typeof error === "string") {
        return error;
      }

      if (error && typeof error === "object") {
        // Check for API error response format
        if ("error" in error && typeof error.error === "string") {
          return error.error;
        }

        if ("message" in error && typeof error.message === "string") {
          return error.message;
        }

        // Check for Axios/Fetch error
        if ("response" in error) {
          const response = (error as { response: { data?: ApiError } }).response;
          if (response.data?.error) {
            return response.data.error;
          }
          if (response.data?.message) {
            return response.data.message;
          }
        }

        // Check for Error object
        if (error instanceof Error) {
          return error.message;
        }
      }

      return "An unexpected error occurred";
    },
    []
  );

  /**
   * Handle an error with appropriate user feedback
   */
  const handleError = useCallback(
    (error: unknown,
     options: ErrorHandlerOptions = {}
   ) => {
    const {
      useNotification: useNotif = false,
      duration = 5,
      description,
      logError = true,
    } = options;

    const errorMessage = parseErrorMessage(error);

    if (logError) {
      // eslint-disable-next-line no-console
      console.error("Error handled:", error);
    }

    if (useNotif) {
      notification.error({
        message: errorMessage,
        description: description || undefined,
        duration,
        placement: "topRight",
      });
    } else {
      message.error(errorMessage, duration);
    }

    return errorMessage;
  },
    [parseErrorMessage]
  );

  /**
   * Handle an async operation with error handling
   */
  const withErrorHandling = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options: ErrorHandlerOptions = {}
    ): Promise<T | null> => {
      try {
        return await operation();
      } catch (error) {
        handleError(error, options);
        return null;
      }
    },
    [handleError]
  );

  /**
   * Show a success message
   */
  const showSuccess = useCallback(
    (successMessage: string,
     options: Omit<ErrorHandlerOptions, "logError"> = {}
   ) => {
      const {
        useNotification: useNotif = false,
        duration = 3,
        description,
      } = options;

      if (useNotif) {
        notification.success({
          message: successMessage,
          description: description || undefined,
          duration,
          placement: "topRight",
        });
      } else {
        message.success(successMessage, duration);
      }
    },
    []
  );

  /**
   * Show an info message
   */
  const showInfo = useCallback(
    (infoMessage: string,
     options: Omit<ErrorHandlerOptions, "logError"> = {}
   ) => {
    const {
      useNotification: useNotif = false,
      duration = 3,
      description,
    } = options;

    if (useNotif) {
      notification.info({
        message: infoMessage,
        description: description || undefined,
        duration,
        placement: "topRight",
      });
    } else {
      message.info(infoMessage, duration);
    }
  },
    []
  );

  /**
   * Show a warning message
   */
  const showWarning = useCallback(
    (warningMessage: string,
     options: Omit<ErrorHandlerOptions, "logError"> = {}
  ) => {
    const {
      useNotification: useNotif = false,
      duration = 4,
      description,
    } = options;

    if (useNotif) {
      notification.warning({
        message: warningMessage,
        description: description || undefined,
        duration,
        placement: "topRight",
      });
    } else {
      message.warning(warningMessage, duration);
    }
  },
    []
  );

  return {
    handleError,
    withErrorHandling,
    parseErrorMessage,
    showSuccess,
    showInfo,
    showWarning,
  };
}

/**
 * Utility function to check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === "object") {
    // Check for typical network error patterns
    if ("message" in error && typeof error.message === "string") {
      const msg = error.message.toLowerCase();
      return (
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("connection") ||
        msg.includes("timeout")
      );
    }
  }
  return false;
}

/**
 * Utility function to check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error && typeof error === "object") {
    // Check for status code
    if ("statusCode" in error) {
      return error.statusCode === 401 || error.statusCode === 403;
    }

    // Check for response status
    if ("response" in error) {
      const response = (error as { response: { status?: number } }).response;
      return response.status === 401 || response.status === 403;
    }
  }
  return false;
}
