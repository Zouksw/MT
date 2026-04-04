"use client";

import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Spin } from "antd";
import { ReloadOutlined, CloseOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { StatsCardSkeleton } from "./Skeleton";

export interface LoadingStateProps {
  loading: boolean;
  timeout?: number; // Default 10000ms (10 seconds)
  onTimeout?: () => void;
  onCancel?: () => void;
  skeletonType?: "stats" | "table" | "form" | "card" | "inline";
  children: React.ReactNode;
  className?: string;
}

/**
 * Loading State Component with Timeout Handling
 *
 * Provides intelligent loading feedback:
 * - Shows skeleton screen while loading
 * - Automatically detects timeouts
 * - Shows warning with retry/cancel options after timeout
 * - Prevents infinite loading states
 *
 * @example
 * ```tsx
 * <LoadingState
 *   loading={isLoading}
 *   timeout={10000}
 *   onTimeout={() => console.log('Request timed out')}
 *   onCancel={() => cancelRequest()}
 *   skeletonType="stats"
 * >
 *   <YourContent />
 * </LoadingState>
 * ```
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  timeout = 10000,
  onTimeout,
  onCancel,
  skeletonType = "stats",
  children,
  className,
}) => {
  const [timedOut, setTimedOut] = useState(false);
  const [loadingId, setLoadingId] = useState(0);

  // When loading transitions to false, increment loadingId to reset timeout state
  const prevLoadingRef = useRef(loading);
  if (prevLoadingRef.current !== loading) {
    prevLoadingRef.current = loading;
    if (!loading) {
      setLoadingId(prev => prev + 1);
    }
  }

  const effectiveTimedOut = loading ? timedOut : false;

  useEffect(() => {
    if (!loading) return;

    const timer = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeout);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingId, timeout]);

  // Not loading - show children
  if (!loading) {
    return <>{children}</>;
  }

  // Loading but not timed out - show skeleton
  if (loading && !effectiveTimedOut) {
    return (
      <div className={className}>
        {skeletonType === "stats" && <StatsCardSkeleton />}
        {skeletonType === "table" && (
          <div style={{ padding: "20px" }}>
            <Spin size="large" tip="Loading data..." />
          </div>
        )}
        {skeletonType === "form" && (
          <div style={{ padding: "20px" }}>
            <Spin size="large" tip="Loading form..." />
          </div>
        )}
        {skeletonType === "card" && (
          <div style={{ padding: "20px" }}>
            <Spin size="large" tip="Loading..." />
          </div>
        )}
        {skeletonType === "inline" && (
          <Space>
            <Spin size="small" />
            <span>Loading...</span>
          </Space>
        )}
      </div>
    );
  }

  // Loading and timed out - show timeout warning
  return (
    <div className={className}>
      <Alert
        type="warning"
        icon={<ExclamationCircleOutlined />}
        message="Request Taking Longer Than Expected"
        description={
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <p>
              The request is taking longer than usual ({timeout / 1000}s). This
              might be due to:
            </p>
            <ul>
              <li>Slow network connection</li>
              <li>Server processing heavy load</li>
              <li>Temporary network issues</li>
            </ul>
            <Space>
              {onCancel && (
                <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
                  Cancel
                </Button>
              )}
              {onTimeout && (
                <Button
                  type="primary"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={onTimeout}
                >
                  Retry
                </Button>
              )}
            </Space>
          </Space>
        }
        showIcon
        closable={false}
      />
    </div>
  );
};

/**
 * Simple timeout warning component
 */
export const TimeoutWarning: React.FC<{
  onRetry?: () => void;
  onCancel?: () => void;
  timeout?: number;
}> = ({ onRetry, onCancel, timeout = 10000 }) => {
  return (
    <Alert
      type="warning"
      icon={<ExclamationCircleOutlined />}
      message="Request Timeout"
      description={
        <Space direction="vertical" size="small">
          <p>
            The request exceeded the time limit ({timeout / 1000} seconds). You
            can retry or cancel.
          </p>
          <Space>
            {onCancel && (
              <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onRetry && (
              <Button
                type="primary"
                size="small"
                icon={<ReloadOutlined />}
                onClick={onRetry}
              >
                Retry
              </Button>
            )}
          </Space>
        </Space>
      }
      showIcon
    />
  );
};

export default LoadingState;
