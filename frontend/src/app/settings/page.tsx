"use client";

import { useState, useEffect } from "react";
import { Card, Row, Col, Button, Space, Divider, Avatar, Badge, Tag } from "antd";
import {
  SafetyOutlined,
  UserOutlined,
  KeyOutlined,
  BellOutlined,
  RightOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useGo } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { authFetch, getAuthToken, getCachedUser } from "@/utils/auth";

interface SettingsItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  status?: "complete" | "incomplete" | "warning";
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  roles?: string[];
  avatar?: string;
}

export default function SettingsPage() {
  const go = useGo();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch user data");

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      // Try cached user as fallback
      const cachedUser = getCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
      }
    } finally {
      setLoading(false);
    }
  };

  const settingsSections: SettingsItem[] = [
    {
      title: "Profile Settings",
      description: "Update your personal information and preferences",
      icon: <UserOutlined style={{ fontSize: 24, color: "#52c41a" }} />,
      path: "/settings/profile",
      status: "complete",
    },
    {
      title: "Notifications",
      description: "Configure how you receive alerts and notifications",
      icon: <BellOutlined style={{ fontSize: 24, color: "#1890ff" }} />,
      path: "/settings/notifications",
      status: "complete",
    },
    {
      title: "Session History",
      description: "View your recent login history and active sessions",
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: "#722ed1" }} />,
      path: "/settings/sessions",
      status: "complete",
    },
    {
      title: "API Keys",
      description: "Manage your API keys for programmatic access",
      icon: <KeyOutlined style={{ fontSize: 24, color: "#faad14" }} />,
      path: "/apikeys",
      status: "complete",
    },
  ];

  const getStatusIcon = (status?: string) => {
    if (status === "complete") {
      return <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />;
    }
    return null;
  };

  const getStatusColor = (status?: string) => {
    if (status === "complete") {
      return "#52c41a";
    }
    return undefined;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences"
      />

      <Row gutter={[24, 24]}>
        {/* User Profile Card */}
        <Col xs={24} lg={8}>
          <Card loading={loading}>
            <Space direction="vertical" style={{ width: "100%" }} align="center" size="large">
              <Avatar
                size={80}
                src={user?.avatar}
                icon={<UserOutlined />}
                style={{ border: "3px solid #3B82F6" }}
              />
              <div className="text-center">
                <h4 className="text-h4 font-display font-semibold text-gray-900 dark:text-gray-50 mb-1">
                  {user?.name || "User"}
                </h4>
                <p className="text-body text-gray-500 dark:text-gray-400">
                  {user?.email || "user@example.com"}
                </p>
                <div className="mt-2">
                  <Tag color="blue">{user?.roles?.[0] || "User"}</Tag>
                </div>
              </div>
              <Button
                type="primary"
                icon={<UserOutlined />}
                onClick={() => go({ to: "/settings/profile", type: "push" })}
                block
                style={{
                  background: "#0066CC",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                Edit Profile
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Settings Navigation */}
        <Col xs={24} lg={16}>
          <Card
            title="Account Settings"
            variant="borderless"
            style={{ height: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {settingsSections.map((section, index) => (
                <div key={index}>
                  <Button
                    block
                    size="large"
                    onClick={() => go({ to: section.path, type: "push" })}
                    className="h-auto px-5 py-4 text-left flex items-center justify-between"
                    style={{
                      height: "auto",
                      padding: "16px 20px",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Space size="middle" style={{ flex: 1 }}>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {section.icon}
                          {section.status && (
                            <div className="absolute bottom-[-4px] right-[-4px]">
                              {getStatusIcon(section.status)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-[15px] text-gray-900 dark:text-gray-50">
                              {section.title}
                            </div>
                            {section.badge && (
                              <Tag color={getStatusColor(section.status)} className="m-0">
                                {section.badge}
                              </Tag>
                            )}
                          </div>
                          <p className="text-body-sm text-gray-500 dark:text-gray-400 mt-0">
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </Space>
                    <RightOutlined className="text-gray-400" />
                  </Button>
                  {index < settingsSections.length - 1 && <Divider className="my-2" />}
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Additional Information */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card title="Account Security" variant="borderless">
            <Space direction="vertical" style={{ width: "100%" }}>
              <p className="text-body text-gray-700 dark:text-gray-300">
                <SafetyOutlined className="text-success mr-2" />
                <span className="font-semibold text-gray-900 dark:text-gray-50">Security Status:</span>{" "}
                <span className="text-success">Your account is secure with JWT authentication</span>
              </p>
              <Space wrap>
                <Button
                  icon={<KeyOutlined />}
                  onClick={() => go({ to: "/apikeys", type: "push" })}
                >
                  Manage API Keys
                </Button>
                <Button
                  icon={<UserOutlined />}
                  onClick={() => go({ to: "/settings/profile", type: "push" })}
                >
                  Change Password
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card title="Quick Actions" variant="borderless">
            <Space wrap>
              <Button onClick={() => go({ to: "/settings/sessions", type: "push" })}>
                View Active Sessions
              </Button>
              <Button onClick={() => go({ to: "/settings/notifications", type: "push" })}>
                Configure Notifications
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
