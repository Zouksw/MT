"use client";

import React, { createContext, useContext, useCallback, useState } from "react";
import { message, theme } from "antd";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  description?: string;
  onClick?: () => void;
}

/**
 * Toast Notification Context
 *
 * Provides easy access to toast notifications throughout the app.
 * Wraps Ant Design message API with consistent styling.
 */
interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => void;
  showSuccess: (message: string, description?: string) => void;
  showError: (message: string, description?: string) => void;
  showWarning: (message: string, description?: string) => void;
  showInfo: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Toast Provider Component
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messageApi, messageContextHolder] = message.useMessage();

  const showToast = useCallback((msg: string, options: ToastOptions = {}) => {
    const { type = "info", duration = 3, description, onClick } = options;

    // Map types to Ant Design methods
    const methods = {
      success: messageApi.success,
      error: messageApi.error,
      warning: messageApi.warning,
      info: messageApi.info,
    };

    const method = methods[type as keyof typeof methods];

    if (description || onClick) {
      method({ content: msg, duration });
    } else {
      method(msg, duration);
    }
  }, [messageApi]);

  const showSuccess = useCallback(
    (msg: string, description?: string) => {
      showToast(msg, { type: "success", description });
    },
    [showToast]
  );

  const showError = useCallback(
    (msg: string, description?: string) => {
      showToast(msg, { type: "error", duration: 5 });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (msg: string, description?: string) => {
      showToast(msg, { type: "warning", description });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (msg: string, description?: string) => {
      showToast(msg, { type: "info", description });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo }}
    >
      {children}
      {messageContextHolder}
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast notifications
 *
 * @example
 * ```tsx
 * const { showSuccess, showError } = useToast();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     showSuccess("Saved successfully!");
 *   } catch (error) {
 *     showError("Failed to save", error.message);
 *   }
 * };
 * ```
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

/**
 * Convenience hooks for specific toast types
 */
export const useSuccess = () => {
  const { showSuccess } = useToast();
  return showSuccess;
};

export const useError = () => {
  const { showError } = useToast();
  return showError;
};

export const useWarning = () => {
  const { showWarning } = useToast();
  return showWarning;
};

export const useInfo = () => {
  const { showInfo } = useToast();
  return showInfo;
};

export default ToastProvider;
