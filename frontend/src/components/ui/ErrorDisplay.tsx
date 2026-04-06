"use client";

import React, { useEffect } from "react";
import { Alert, Button, Space } from "antd";
import { ReloadOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useToast } from "./Toast";
import { errorHandler, SafeError } from "@/lib/errorHandler";

export interface ErrorDisplayProps {
  error: SafeError | Error | unknown;
  retry?: () => void;
  context?: string;
  showInline?: boolean; // If true, shows inline error without toast
  className?: string;
}

/**
 * Unified Error Display Component
 *
 * Provides consistent error UX across the application:
 * - Automatically shows toast notification for errors
 * - Displays inline alert for visual feedback
 * - Shows retry button for recoverable errors
 * - Integrates with security-first error handler
 *
 * @example
 * ```tsx
 * {error && <ErrorDisplay error={error} retry={() => refetch()} />}
 * ```
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  retry,
  context,
  showInline = true,
  className,
}) => {
  const { showError } = useToast();

  // Convert error to SafeError
  const safeError: SafeError =
    error instanceof Error && "message" in error && "shouldNotify" in error
      ? (error as SafeError)
      : errorHandler.createSafeError(error);

  // Show toast notification on error (once)
  useEffect(() => {
    if (safeError.shouldNotify) {
      const message = context ? `${context}: ${safeError.message}` : safeError.message;
      showError(message, safeError.code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - show toast only once on mount

  // Don't show inline if showInline is false or if error shouldn't notify
  if (!showInline || !safeError.shouldNotify) {
    return null;
  }

  // Check if error is recoverable
  const isRecoverable = errorHandler.isRecoverable(safeError);

  return (
    <Alert
      className={className}
      type="error"
      icon={<ExclamationCircleOutlined />}
      message={safeError.message}
      description={
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          {safeError.code && (
            <small style={{ color: "rgba(255, 255, 255, 0.65)" }}>
              Error code: {safeError.code}
            </small>
          )}
          {isRecoverable && retry && (
            <Button
              type="primary"
              size="small"
              icon={<ReloadOutlined />}
              onClick={retry}
            >
              Retry
            </Button>
          )}
        </Space>
      }
      showIcon
      closable={!isRecoverable}
    />
  );
};

/**
 * Compact error display for inline use (e.g., in forms, cards)
 */
export const ErrorInline: React.FC<Omit<ErrorDisplayProps, "showInline">> = (
  props
) => {
  return <ErrorDisplay {...props} showInline={true} />;
};

/**
 * Error display with toast only (no inline alert)
 */
export const ErrorToastOnly: React.FC<ErrorDisplayProps> = (props) => {
  return <ErrorDisplay {...props} showInline={false} />;
};

export default ErrorDisplay;
