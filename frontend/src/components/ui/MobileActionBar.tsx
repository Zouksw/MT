/**
 * Mobile Action Bar
 *
 * Fixed bottom action bar for mobile devices.
 * Provides primary and secondary actions in a thumb-friendly layout.
 */

"use client";

import React from "react";
import { Button, Space, Divider } from "antd";
import { PlusOutlined, MoreOutlined } from "@ant-design/icons";

export interface Action {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  type?: "primary" | "default" | "danger" | "link";
  disabled?: boolean;
  loading?: boolean;
}

export interface MobileActionBarProps {
  primary?: Action;
  secondary?: Action[];
  visible?: boolean;
  position?: "bottom" | "top";
}

/**
 * MobileActionBar Component
 *
 * Fixed bottom bar with primary and secondary actions.
 * Optimized for thumb reachability on mobile.
 *
 * @example
 * <MobileActionBar
 *   primary={{
 *     key: "create",
 *     label: "Create",
 *     icon: <PlusOutlined />,
 *     onClick: handleCreate,
 *     type: "primary"
 *   }}
 *   secondary={[
 *     { key: "export", label: "Export", onClick: handleExport }
 *   ]}
 * />
 */
export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  primary,
  secondary = [],
  visible = true,
  position = "bottom",
}) => {
  if (!visible || (!primary && secondary.length === 0)) {
    return null;
  }

  const isBottom = position === "bottom";

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        [isBottom ? "bottom" : "top"]: 0,
        zIndex: 1000,
        background: "#FFFFFF",
        borderTop: isBottom ? "1px solid #E5E7EB" : "none",
        borderBottom: !isBottom ? "1px solid #E5E7EB" : "none",
        boxShadow: isBottom
          ? "0 -2px 8px rgba(0, 0, 0, 0.05)"
          : "0 2px 8px rgba(0, 0, 0, 0.05)",
        padding: "12px 16px",
        paddingBottom: isBottom ? "calc(12px + env(safe-area-inset-bottom))" : "12px",
      }}
    >
      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
        {primary && secondary.length > 0 ? (
          // Primary + Secondary actions
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Button
              block
              type={primary.type === "danger" ? "primary" : (primary.type || "primary")}
              danger={primary.type === "danger"}
              icon={primary.icon}
              onClick={primary.onClick}
              disabled={primary.disabled}
              loading={primary.loading}
              style={{
                borderRadius: 4,
                height: "44px",
                fontSize: "16px",
                fontWeight: 600,
                background: primary.type === "primary" ? "#0066CC" : undefined,
                borderColor: primary.type === "primary" ? "#0066CC" : undefined,
                flex: 1,
              }}
            >
              {primary.label}
            </Button>

            {secondary.length <= 2 && (
              <Space size={8}>
                {secondary.map((action) => (
                  <Button
                    key={action.key}
                    type={action.type === "danger" ? "primary" : (action.type || "default")}
                    danger={action.type === "danger"}
                    icon={action.icon}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    loading={action.loading}
                    style={{
                      borderRadius: 4,
                      height: "44px",
                      minWidth: "44px",
                      padding: "0 16px",
                    }}
                  >
                    {action.icon && !action.label ? null : action.label}
                  </Button>
                ))}
              </Space>
            )}

            {secondary.length > 2 && (
              <Button
                icon={<MoreOutlined />}
                style={{
                  borderRadius: 4,
                  height: "44px",
                  width: "44px",
                  padding: 0,
                }}
              >
                {/* Would open a popover/drawer with all secondary actions */}
              </Button>
            )}
          </div>
        ) : primary ? (
          // Primary action only (full width)
          <Button
            block
            type={primary.type === "danger" ? "primary" : (primary.type || "primary")}
            danger={primary.type === "danger"}
            icon={primary.icon}
            onClick={primary.onClick}
            disabled={primary.disabled}
            loading={primary.loading}
            style={{
              borderRadius: 4,
              height: "48px",
              fontSize: "16px",
              fontWeight: 600,
              background: primary.type === "primary" ? "#0066CC" : undefined,
              borderColor: primary.type === "primary" ? "#0066CC" : undefined,
            }}
          >
            {primary.label}
          </Button>
        ) : (
          // Secondary actions only
          <Space size={8} style={{ width: "100%", justifyContent: "center" }}>
            {secondary.map((action) => (
              <Button
                key={action.key}
                type={action.type === "danger" ? "primary" : (action.type || "default")}
                danger={action.type === "danger"}
                icon={action.icon}
                onClick={action.onClick}
                disabled={action.disabled}
                loading={action.loading}
                style={{
                  borderRadius: 4,
                  height: "44px",
                  padding: "0 20px",
                }}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        )}
      </div>

      {/* Safe area spacer for bottom bar */}
      {isBottom && (
        <div
          style={{
            height: "env(safe-area-inset-bottom)",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

/**
 * MobileFloatingActionButton - FAB for single primary action
 */
export interface MobileFloatingActionButtonProps {
  icon?: React.ReactNode;
  onClick: () => void;
  label?: string;
  position?: "right" | "center";
  disabled?: boolean;
  loading?: boolean;
}

export const MobileFloatingActionButton: React.FC<MobileFloatingActionButtonProps> = ({
  icon = <PlusOutlined />,
  onClick,
  label,
  position = "right",
  disabled = false,
  loading = false,
}) => {
  const positionStyle = {
    right:
      position === "right"
        ? "calc(16px + env(safe-area-inset-right))"
        : "auto",
    left:
      position === "center"
        ? "50%"
        : position === "right"
        ? "auto"
        : "calc(16px + env(safe-area-inset-left))",
    transform: position === "center" ? "translateX(-50%)" : undefined,
  };

  return (
    <Button
      type="primary"
      icon={icon}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      style={{
        position: "fixed",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        ...positionStyle,
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        boxShadow: "0 4px 12px rgba(0, 102, 204, 0.4)",
        fontSize: "24px",
        background: "#0066CC",
        borderColor: "#0066CC",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label && (
        <span
          style={{
            position: "absolute",
            top: "-40px",
            background: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      )}
    </Button>
  );
};

/**
 * MobilePageLayout - Full page layout with action bar
 */
export interface MobilePageLayoutProps {
  children: React.ReactNode;
  actionBar?: MobileActionBarProps;
  contentPadding?: string | number;
}

export const MobilePageLayout: React.FC<MobilePageLayoutProps> = ({
  children,
  actionBar,
  contentPadding = "16px",
}) => {
  const hasBottomBar = actionBar?.position !== "top" && actionBar?.visible;

  return (
    <>
      <div
        style={{
          paddingBottom: hasBottomBar
            ? "calc(80px + env(safe-area-inset-bottom))"
            : undefined,
          minHeight: "100vh",
        }}
      >
        <div style={{ padding: contentPadding }}>{children}</div>
      </div>

      {actionBar && <MobileActionBar {...actionBar} />}
    </>
  );
};
