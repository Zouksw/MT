"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Row, Col, Space, Avatar, Tag, Button as AntButton } from "antd";
import {
  SafetyOutlined,
  UserOutlined,
  KeyOutlined,
  BellOutlined,
  RightOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  LockOutlined,
  ApiOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useGo } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui";
import { authFetch, getAuthToken, getCachedUser } from "@/utils/auth";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  roles?: string[];
  avatar?: string;
  createdAt?: string;
}

export default function SettingsPage() {
  const go = useGo();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch user data");

      const data = await response.json();
      setUser(data.user);
    } catch {
      const cachedUser = getCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const settingsSections = [
    {
      title: "Profile Settings",
      description: "Update your personal information and preferences",
      icon: <UserOutlined />,
      color: "from-primary to-blue-400",
      path: "/settings/profile",
    },
    {
      title: "Notifications",
      description: "Configure how you receive alerts and notifications",
      icon: <BellOutlined />,
      color: "from-amber-500 to-orange-400",
      path: "/settings/notifications",
    },
    {
      title: "Session History",
      description: "View your recent login history and active sessions",
      icon: <ClockCircleOutlined />,
      color: "from-emerald-500 to-teal-400",
      path: "/settings/sessions",
    },
    {
      title: "API Keys",
      description: "Manage your API keys for programmatic access",
      icon: <KeyOutlined />,
      color: "from-purple-500 to-indigo-400",
      path: "/apikeys",
    },
  ];

  const securityItems = [
    { label: "JWT Authentication", enabled: true },
    { label: "API Key Management", enabled: true },
    { label: "Session Monitoring", enabled: true },
    { label: "Two-Factor Auth", enabled: false },
  ];

  const securityScore = securityItems.filter((i) => i.enabled).length / securityItems.length * 100;

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences"
      />

      <Row gutter={[24, 24]}>
        {/* User Profile Card */}
        <Col xs={24} lg={8}>
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            {/* Gradient header strip */}
            <div
              className="h-24 relative"
              style={{ background: "linear-gradient(135deg, #0066CC, #3B82F6)" }}
            >
              {/* Decorative circles */}
              <div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-white/10" />
              <div className="absolute bottom-4 right-24 w-8 h-8 rounded-full bg-white/10" />
            </div>

            {/* Avatar overlapping gradient */}
            <div className="flex flex-col items-center -mt-10 px-6">
              <Avatar
                size={80}
                src={user?.avatar}
                icon={<UserOutlined />}
                className="ring-4 ring-white dark:ring-gray-800 shadow-lg"
                style={{ border: "3px solid #0066CC" }}
              />
              <h4 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mt-3 mb-0.5">
                {user?.name || "User"}
              </h4>
              <p className="text-body text-gray-500 dark:text-gray-400 mb-2">
                {user?.email || "user@example.com"}
              </p>
              <Tag color="blue" className="mb-4">{user?.roles?.[0] || "User"}</Tag>

              <div className="flex items-center gap-2 mb-4">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-body-sm text-green-600 dark:text-green-400 font-medium">Active</span>
              </div>

              <Button
                variant="primary"
                className="w-full mb-6"
                onClick={() => go({ to: "/settings/profile", type: "push" })}
              >
                Edit Profile
              </Button>
            </div>
          </div>
        </Col>

        {/* Settings Navigation */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-primary" />
                <span className="font-display font-semibold">Account Settings</span>
              </div>
            }
            variant="borderless"
            style={{ height: "100%" }}
          >
            <div className="space-y-2">
              {settingsSections.map((section, index) => (
                <button
                  key={index}
                  onClick={() => go({ to: section.path, type: "push" })}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06] group"
                >
                  {/* Icon with gradient background */}
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center text-white shadow-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                    {section.icon}
                  </div>

                  {/* Title + description */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] text-gray-900 dark:text-gray-50">
                      {section.title}
                    </div>
                    <p className="text-body-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {section.description}
                    </p>
                  </div>

                  {/* Chevron */}
                  <RightOutlined className="text-gray-300 dark:text-gray-600 transition-transform duration-200 group-hover:text-primary group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Security Score Section */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={8}>
          <Card variant="borderless" className="text-center">
            <div className="flex items-center gap-2 mb-4 justify-center">
              <div className="w-1.5 h-5 rounded-full bg-green-500" />
              <span className="font-display font-semibold">Security Score</span>
            </div>

            {/* Circular progress */}
            <div className="relative inline-flex items-center justify-center mb-4">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="54" fill="none" stroke="#E5E7EB" strokeWidth="8" className="dark:stroke-gray-700" />
                <circle
                  cx="64" cy="64" r="54" fill="none"
                  stroke="#10B981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${securityScore * 3.39} 339`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-display font-bold text-gray-900 dark:text-gray-50">
                  {Math.round(securityScore)}
                </span>
                <span className="text-xs text-gray-500">out of 100</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <SafetyOutlined className="text-green-500" />
                <span className="font-display font-semibold">Security Status</span>
              </div>
            }
            variant="borderless"
          >
            <div className="space-y-3 mb-6">
              {securityItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {item.enabled ? (
                    <CheckCircleFilled className="text-green-500 text-lg" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                  <span className={`text-body ${item.enabled ? "text-gray-900 dark:text-gray-50" : "text-gray-500 dark:text-gray-400"}`}>
                    {item.label}
                  </span>
                  {item.enabled ? (
                    <Tag color="green" className="ml-auto">Enabled</Tag>
                  ) : (
                    <Tag color="default" className="ml-auto">Coming Soon</Tag>
                  )}
                </div>
              ))}
            </div>

            <Row gutter={12}>
              <Col span={12}>
                <AntButton
                  icon={<KeyOutlined />}
                  onClick={() => go({ to: "/apikeys", type: "push" })}
                  block
                  className="!h-auto !py-3"
                >
                  Manage API Keys
                </AntButton>
              </Col>
              <Col span={12}>
                <AntButton
                  icon={<UserOutlined />}
                  onClick={() => go({ to: "/settings/profile", type: "push" })}
                  block
                  className="!h-auto !py-3"
                >
                  Change Password
                </AntButton>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions Grid */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-primary" />
                <span className="font-display font-semibold">Quick Actions</span>
              </div>
            }
            variant="borderless"
          >
            <Row gutter={[16, 16]}>
              {[
                { icon: <ClockCircleOutlined />, title: "View Sessions", desc: "See active sessions", path: "/settings/sessions", color: "from-emerald-500 to-teal-400" },
                { icon: <BellOutlined />, title: "Notifications", desc: "Configure alerts", path: "/settings/notifications", color: "from-amber-500 to-orange-400" },
                { icon: <ApiOutlined />, title: "API Keys", desc: "Manage access tokens", path: "/apikeys", color: "from-purple-500 to-indigo-400" },
                { icon: <SettingOutlined />, title: "Profile", desc: "Edit personal info", path: "/settings/profile", color: "from-primary to-blue-400" },
              ].map((action, idx) => (
                <Col xs={12} md={6} key={idx}>
                  <button
                    onClick={() => go({ to: action.path, type: "push" })}
                    className="w-full p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-left group hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center text-white text-sm mb-3 transition-transform duration-200 group-hover:scale-110`}>
                      {action.icon}
                    </div>
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-50">{action.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.desc}</div>
                  </button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
