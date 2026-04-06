/**
 * Responsive Navigation Component
 *
 * Provides different navigation experiences for desktop and mobile:
 * - Desktop: Sidebar with expandable sections
 * - Mobile: Bottom tab bar with quick access
 */

"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DashboardOutlined,
  DatabaseOutlined,
  AlertOutlined,
  ExperimentOutlined,
  FundOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { useIsMobile } from "@/lib/responsive-utils";
import { Dropdown, Badge } from "antd";

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <DashboardOutlined />,
    path: "/",
  },
  {
    key: "datasets",
    label: "Datasets",
    icon: <DatabaseOutlined />,
    path: "/datasets",
  },
  {
    key: "timeseries",
    label: "Time Series",
    icon: <FundOutlined />,
    path: "/timeseries",
  },
  {
    key: "alerts",
    label: "Alerts",
    icon: <AlertOutlined />,
    path: "/alerts",
    badge: 3,
  },
  {
    key: "anomalies",
    label: "Anomalies",
    icon: <ExperimentOutlined />,
    path: "/anomalies",
  },
];

const USER_MENU_ITEMS = [
  {
    key: "profile",
    label: "Profile",
    icon: <UserOutlined />,
    path: "/profile",
  },
  {
    key: "settings",
    label: "Settings",
    icon: <SettingOutlined />,
    path: "/settings",
  },
  {
    key: "logout",
    label: "Logout",
    icon: <LogoutOutlined />,
    path: "/logout",
    danger: true,
  },
];

/**
 * Desktop Sidebar Navigation
 */
interface DesktopSidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  collapsed = false,
  onCollapse: _onCollapse,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavClick = (item: NavItem) => {
    router.push(item.path);
  };

  const handleUserMenuClick = ({ key }: { key: string }) => {
    const item = USER_MENU_ITEMS.find((i) => i.key === key);
    if (item) {
      router.push(item.path);
    }
  };

  return (
    <aside
      className="desktop-sidebar"
      style={{
        width: collapsed ? 72 : 256,
        transition: "width 0.2s ease",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "16px 12px" : "16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: "#0066CC",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          I
        </div>
        {!collapsed && (
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            IoTDB Enhanced
          </span>
        )}
      </div>

      {/* Navigation Items */}
      <nav>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");

          return (
            <div
              key={item.key}
              className={`desktop-nav-item ${isActive ? "active" : ""}`}
              onClick={() => handleNavClick(item)}
              style={{
                padding: collapsed ? "12px" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                position: "relative",
              }}
              title={collapsed ? item.label : undefined}
            >
              <span
                style={{
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge count={item.badge} size="small" />
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Menu */}
      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
        <Dropdown
          menu={{
            items: USER_MENU_ITEMS,
            onClick: handleUserMenuClick,
          }}
          trigger={["click"]}
          placement="topLeft"
        >
          <div
            className="desktop-nav-item"
            style={{
              padding: collapsed ? "12px" : "10px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <UserOutlined style={{ fontSize: 16 }} />
            {!collapsed && <span>User Menu</span>}
          </div>
        </Dropdown>
      </div>
    </aside>
  );
};

/**
 * Mobile Bottom Tab Bar
 */
export const MobileTabBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [, setActiveTab] = useState(pathname);

  const handleTabClick = (item: NavItem) => {
    setActiveTab(item.path);
    router.push(item.path);
  };

  // Show only top 4 items on mobile
  const mobileNavItems = NAV_ITEMS.slice(0, 4);

  return (
    <nav className="mobile-tab-bar">
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.path;

        return (
          <div
            key={item.key}
            className={`mobile-tab-item ${isActive ? "active" : ""}`}
            onClick={() => handleTabClick(item)}
          >
            <span className="mobile-tab-item-icon">
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.badge && item.badge > 0 && (
              <Badge
                count={item.badge}
                size="small"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 8,
                }}
              />
            )}
          </div>
        );
      })}

      {/* More menu for additional items */}
      <div
        className="mobile-tab-item"
        onClick={() => router.push("/more")}
      >
        <MenuFoldOutlined className="mobile-tab-item-icon" />
        <span>More</span>
      </div>
    </nav>
  );
};

/**
 * Mobile Header
 */
interface MobileHeaderProps {
  title?: string;
  action?: React.ReactNode;
  onBack?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  action,
  onBack,
}) => {
  const router = useRouter();

  return (
    <header className="mobile-header">
      {onBack && (
        <div
          className="mobile-header-action"
          onClick={onBack}
          style={{ marginRight: 8 }}
        >
          ←
        </div>
      )}

      <h1
        className="mobile-header-title"
        style={{
          flex: 1,
          margin: 0,
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        {title || "IoTDB Enhanced"}
      </h1>

      {action || (
        <div
          className="mobile-header-action"
          onClick={() => router.push("/notifications")}
        >
          <Badge count={3} size="small">
            <BellOutlined style={{ fontSize: 18 }} />
          </Badge>
        </div>
      )}
    </header>
  );
};

/**
 * Responsive Navigation Container
 *
 * Automatically renders the appropriate navigation based on device type.
 */
export interface ResponsiveNavProps {
  renderHeader?: boolean;
  headerTitle?: string;
  headerAction?: React.ReactNode;
  onBack?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarCollapse?: (collapsed: boolean) => void;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({
  renderHeader = true,
  headerTitle,
  headerAction,
  onBack,
  sidebarCollapsed,
  onSidebarCollapse,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {renderHeader && (
          <MobileHeader
            title={headerTitle}
            action={headerAction}
            onBack={onBack}
          />
        )}
        <MobileTabBar />
      </>
    );
  }

  return (
    <>
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onCollapse={onSidebarCollapse}
      />
    </>
  );
};

/**
 * Navigation Layout Wrapper
 *
 * Wraps page content with appropriate layout based on device.
 */
export interface NavLayoutProps {
  children: React.ReactNode;
  renderHeader?: boolean;
  headerTitle?: string;
  headerAction?: React.ReactNode;
  onBack?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarCollapse?: (collapsed: boolean) => void;
}

export const NavLayout: React.FC<NavLayoutProps> = ({
  children,
  renderHeader = true,
  headerTitle,
  headerAction,
  onBack,
  sidebarCollapsed,
  onSidebarCollapse,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="mobile-with-tab-bar">
        {renderHeader && (
          <MobileHeader
            title={headerTitle}
            action={headerAction}
            onBack={onBack}
          />
        )}
        <main style={{ padding: "16px" }}>
          {children}
        </main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="desktop-layout-with-sidebar">
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onCollapse={onSidebarCollapse}
      />
      <main className="desktop-main-content">
        {children}
      </main>
    </div>
  );
};
