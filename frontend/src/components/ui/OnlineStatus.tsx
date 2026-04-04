"use client";

import React from "react";
import { Badge, Space } from "antd";
import {
  CloudServerOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from "@ant-design/icons";
import { useOnlineStatusWithCallbacks, useOnlineStatus } from "@/hooks/useOnlineStatus";

export interface OnlineStatusProps {
  /**
   * Display mode
   * - "badge": Small badge indicator
   * - "text": Text with icon
   * - "icon": Icon only
   * - "dot": Small colored dot
   */
  mode?: "badge" | "text" | "icon" | "dot";

  /**
   * Position (for icon/dot mode)
   * - "fixed": Fixed position in corner
   * - "inline": Inline with other elements
   */
  position?: "fixed" | "inline";

  /**
   * Position when fixed (top-right, top-left, etc.)
   */
  fixedPosition?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center";

  /**
   * Custom online message
   */
  onlineMessage?: string;

  /**
   * Custom offline message
   */
  offlineMessage?: string;

  /**
   * Show status in header (uses compact mode)
   */
  inHeader?: boolean;
}

/**
 * OnlineStatus - Visual network status indicator
 *
 * Displays online/offline status with:
 * - Automatic detection via browser online/offline events
 * - Visual indicators (badge, text, icon, or dot)
 * - Automatic toast notifications on status change
 * - Customizable position and messages
 * - Header-friendly compact mode
 *
 * @example
 * ```tsx
 * // Basic usage
 * <OnlineStatus />
 *
 * // In header with compact mode
 * <OnlineStatus inHeader mode="badge" />
 *
 * // Fixed position indicator
 * <OnlineStatus mode="dot" position="top-right" />
 * ```
 */
export const OnlineStatus: React.FC<OnlineStatusProps> = ({
  mode = "badge",
  position = "inline",
  fixedPosition = "top-right",
  onlineMessage = "Online",
  offlineMessage = "Offline",
  inHeader = false,
}) => {
  const isOnline = useOnlineStatusWithCallbacks({
    showToast: true,
  });

  // Calculate fixed position styles
  const getFixedStyle = (): React.CSSProperties => {
    const positions: Record<string, React.CSSProperties> = {
      "top-right": {
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
      },
      "top-left": {
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 1000,
      },
      "bottom-right": {
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1000,
      },
      "bottom-left": {
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 1000,
      },
      "top-center": {
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
      },
    };
    return positions[fixedPosition] || {};
  };

  // Render based on mode
  if (mode === "badge") {
    return (
      <Badge
        status={isOnline ? "success" : "error"}
        text={isOnline ? onlineMessage : offlineMessage}
        style={{
          ...(position === "fixed" ? getFixedStyle() : {}),
          cursor: "pointer",
        }}
      >
        {isOnline ? (
          <WifiOutlined title="Connected to internet" />
        ) : (
          <DisconnectOutlined title="Disconnected from internet" />
        )}
      </Badge>
    );
  }

  if (mode === "text") {
    return (
      <Space
        style={{
          ...(position === "fixed" ? getFixedStyle() : {}),
          cursor: "pointer",
        }}
      >
        {isOnline ? (
          <>
            <CloudServerOutlined style={{ color: "#52c41a" }} />
            <span>{onlineMessage}</span>
          </>
        ) : (
          <>
            <DisconnectOutlined style={{ color: "#ff4d4f" }} />
            <span>{offlineMessage}</span>
          </>
        )}
      </Space>
    );
  }

  if (mode === "icon") {
    return (
      <div
        style={{
          ...(position === "fixed" ? getFixedStyle() : {}),
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
        title={isOnline ? "Connected to internet" : "Disconnected from internet"}
      >
        {isOnline ? (
          <WifiOutlined
            style={{ color: "#52c41a", fontSize: inHeader ? 16 : 20 }}
          />
        ) : (
          <DisconnectOutlined
            style={{ color: "#ff4d4f", fontSize: inHeader ? 16 : 20 }}
          />
        )}
      </div>
    );
  }

  if (mode === "dot") {
    return (
      <div
        style={{
          ...(position === "fixed" ? getFixedStyle() : {}),
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: isOnline ? "#52c41a" : "#ff4d4f",
          cursor: "pointer",
          boxShadow: `0 0 0 2px ${isOnline ? "rgba(82, 196, 26, 0.3)" : "rgba(255, 77, 79, 0.3)"}`,
          transition: "background-color 0.3s ease",
        }}
        title={isOnline ? "Connected to internet" : "Disconnected from internet"}
      />
    );
  }

  return null;
};

/**
 * Compact online status for use in headers
 */
export const OnlineStatusCompact: React.FC<{ position?: "inline" | "fixed" }> = ({
  position = "inline",
}) => {
  return (
    <OnlineStatus
      mode="icon"
      position={position}
      inHeader={true}
      onlineMessage=""
      offlineMessage=""
    />
  );
};

/**
 * Full status text for use in status pages
 */
export const OnlineStatusText: React.FC<{ className?: string }> = ({
  className,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <div className={className} style={{ textAlign: "center", padding: "24px" }}>
      {isOnline ? (
        <>
          <WifiOutlined style={{ fontSize: 48, color: "#52c41a", marginBottom: 16 }} />
          <h2>You're Online</h2>
          <p style={{ color: "#8c8c8c" }}>
            All features are available. Your connection is stable.
          </p>
        </>
      ) : (
        <>
          <DisconnectOutlined style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }} />
          <h2>You're Offline</h2>
          <p style={{ color: "#8c8c8c" }}>
            Please check your internet connection. Some features may not work.
          </p>
        </>
      )}
    </div>
  );
};

export default OnlineStatus;
