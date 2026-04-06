"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { RefineThemedLayoutHeaderProps } from "@refinedev/antd";
import { useGetIdentity, useGo } from "@refinedev/core";
import {
  Avatar,
  Space,
  Typography,
  theme,
  Badge,
  Dropdown,
  Tooltip,
} from "antd";
import {
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  DashboardOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { OnlineStatusCompact } from "@/components/ui/OnlineStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authFetch } from "@/utils/auth";

const { Text } = Typography;
const { useToken } = theme;

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
  sticky = true,
}) => {
  const { token } = useToken();
  const { data: user } = useGetIdentity<IUser>();
  const go = useGo();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentLocale, setCurrentLocale] = useState<string>("en");

  // Read stored locale preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("locale");
    if (stored === "zh-CN" || stored === "en") {
      setCurrentLocale(stored);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    const next = currentLocale === "en" ? "zh-CN" : "en";
    setCurrentLocale(next);
    localStorage.setItem("locale", next);
  }, [currentLocale]);

  // Fetch unread alert count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await authFetch("/api/alerts/stats");
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        setUnreadCount(data?.unread || 0);
      }
    } catch {
      // Silently ignore - non-critical
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const headerStyles: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(0, 102, 204, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: "64px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  };

  if (sticky) {
    headerStyles.position = "sticky";
    headerStyles.top = 0;
    headerStyles.zIndex = 100;
  }

  const userMenuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
      onClick: () => go({ to: "/dashboard", type: "push" }),
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
      onClick: () => go({ to: "/settings", type: "push" }),
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Sign Out",
      danger: true,
      onClick: () => {
        authFetch("/api/auth/logout", { method: "POST" }).finally(() => {
          window.location.href = "/login";
        });
      },
    },
  ];

  return (
    <header
      className="dark:bg-[rgba(15,23,42,0.9)] dark:border-b-[rgba(59,130,246,0.08)]"
      style={headerStyles}
    >
      {/* Left: Brand Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #0066CC, #3B82F6)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0, 102, 204, 0.2)",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                fontFamily: "var(--font-outfit), sans-serif",
                lineHeight: 1,
              }}
            >
              I
            </span>
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: token.colorText,
              fontFamily: "var(--font-outfit), sans-serif",
            }}
            className="hidden sm:inline"
          >
            IoTDB Enhanced
          </span>
        </a>
      </div>

      {/* Right: Actions */}
      <Space size="middle">
        {/* Online Status */}
        <OnlineStatusCompact position="inline" />

        {/* Notification Bell */}
        <Tooltip title={unreadCount > 0 ? `${unreadCount} unread alerts` : "No new alerts"}>
          <a
            href="/alerts"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              color: token.colorTextSecondary,
              transition: "all 0.2s ease",
              background: "transparent",
            }}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Badge count={unreadCount} size="small" offset={[-2, -2]}>
              <BellOutlined style={{ fontSize: 18 }} />
            </Badge>
          </a>
        </Tooltip>

        {/* Locale Switcher */}
        <Tooltip title={currentLocale === "en" ? "切换到中文" : "Switch to English"}>
          <button
            onClick={toggleLocale}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              color: token.colorTextSecondary,
              background: "transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
              fontSize: 16,
            }}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <GlobalOutlined />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                marginLeft: 4,
                lineHeight: 1,
              }}
            >
              {currentLocale === "en" ? "EN" : "中"}
            </span>
          </button>
        </Tooltip>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Avatar + Dropdown */}
        <Dropdown
          menu={{ items: userMenuItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              padding: "4px 8px 4px 4px",
              borderRadius: 8,
              transition: "background 0.2s ease",
            }}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Avatar
              size={32}
              src={user?.avatar}
              icon={<UserOutlined />}
              style={{
                border: "2px solid",
                borderImage: "linear-gradient(135deg, #0066CC, #3B82F6) 1",
                borderRadius: "50%",
              }}
            />
            {(user?.name) && (
              <Text
                strong
                style={{ fontSize: 13 }}
                className="hidden sm:inline"
              >
                {user.name}
              </Text>
            )}
          </div>
        </Dropdown>
      </Space>
    </header>
  );
};
