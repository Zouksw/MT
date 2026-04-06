"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Form,
  Input,
  Avatar,
  Space,
  Typography,
  Card,
  Row,
  Col,
  message,
  Descriptions,
  Divider,
  Alert,
  Statistic,
  Row as AntRow,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  SaveOutlined,
  CameraOutlined,
  SecurityScanOutlined,
  DatabaseOutlined,
  BranchesOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { authFetch, getAuthToken, setCachedUser } from "@/utils/auth";

const { Title, Text } = Typography;

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt: string;
  _count: {
    datasets: number;
    models: number;
    ownedOrganizations: number;
  };
}

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch profile");

      const data = await response.json();
      setUser(data.user);
      setCachedUser(data.user);
      form.setFieldsValue({
        name: data.user.name,
        avatarUrl: data.user.avatarUrl || "",
      });
    } catch {
      message.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleProfileUpdate = async (values: { name: string; avatarUrl: string }) => {
    setSaving(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: values.name,
          avatarUrl: values.avatarUrl || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      const data = await response.json();
      setUser(data.user);
      setCachedUser(data.user);
      message.success("Profile updated successfully");
    } catch {
      message.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (values: {
    currentPassword: string;
    newPassword: string;
  }) => {
    setChangingPassword(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }

      message.success("Password changed successfully. Please login again.");
      passwordForm.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Card loading />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profile Settings"
        description="Manage your personal information and preferences"
      />

      <Row gutter={[24, 24]}>
        {/* Profile Overview Card */}
        <Col xs={24} lg={8}>
          <Card>
            <Space direction="vertical" style={{ width: "100%" }} align="center" size="large">
              <Avatar
                size={100}
                src={user?.avatarUrl}
                icon={<UserOutlined />}
                style={{ border: "3px solid #1890ff" }}
              />
              <div style={{ textAlign: "center" }}>
                <Title level={4} style={{ fontSize: "18px", marginBottom: 4 }}>
                  {user?.name || "User"}
                </Title>
                <Text type="secondary">{user?.email}</Text>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
                    Role: {user?.role}
                  </Text>
                </div>
              </div>
            </Space>

            <Divider />

            {/* Account Statistics */}
            <AntRow gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="Datasets"
                  value={user?._count.datasets || 0}
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ fontSize: 20, color: "#1890ff" }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Models"
                  value={user?._count.models || 0}
                  prefix={<SecurityScanOutlined />}
                  valueStyle={{ fontSize: 20, color: "#52c41a" }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Orgs"
                  value={user?._count.ownedOrganizations || 0}
                  prefix={<BranchesOutlined />}
                  valueStyle={{ fontSize: 20, color: "#722ed1" }}
                />
              </Col>
            </AntRow>
          </Card>
        </Col>

        {/* Profile Form and Password Change */}
        <Col xs={24} lg={16}>
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            {/* Edit Profile */}
            <ContentCard title="Edit Profile" subtitle={<UserOutlined />}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleProfileUpdate}
                initialValues={{
                  name: user?.name,
                  avatarUrl: user?.avatarUrl || "",
                }}
              >
                <Form.Item
                  label="Display Name"
                  name="name"
                  rules={[{ required: true, message: "Please enter your name" }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Your display name" size="large" />
                </Form.Item>

                <Form.Item
                  label="Email Address"
                  tooltip="Email cannot be changed"
                >
                  <Input
                    prefix={<MailOutlined />}
                    value={user?.email}
                    disabled
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="Avatar URL"
                  name="avatarUrl"
                  tooltip="Enter a URL for your profile image"
                >
                  <Input
                    prefix={<CameraOutlined />}
                    placeholder="https://example.com/avatar.png"
                    size="large"
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={saving}
                    size="large"
                  >
                    Save Changes
                  </Button>
                </Form.Item>
              </Form>
            </ContentCard>

            {/* Change Password */}
            <ContentCard title="Change Password" subtitle={<LockOutlined />}>
              <Alert
                message="Password Security"
                description="After changing your password, you will need to login again on all devices."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handlePasswordChange}
              >
                <Form.Item
                  label="Current Password"
                  name="currentPassword"
                  rules={[{ required: true, message: "Please enter your current password" }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Current password"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="New Password"
                  name="newPassword"
                  rules={[
                    { required: true, message: "Please enter a new password" },
                    { min: 8, message: "Password must be at least 8 characters" },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="New password (min. 8 characters)"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="Confirm New Password"
                  name="confirmPassword"
                  dependencies={["newPassword"]}
                  rules={[
                    { required: true, message: "Please confirm your new password" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("newPassword") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error("Passwords do not match"));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Confirm new password"
                    size="large"
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    danger
                    htmlType="submit"
                    icon={<LockOutlined />}
                    loading={changingPassword}
                    size="large"
                  >
                    Change Password
                  </Button>
                </Form.Item>
              </Form>
            </ContentCard>

            {/* Account Info */}
            <ContentCard title="Account Information" subtitle={<UserOutlined />}>
              <Descriptions column={{ xs: 1, sm: 2 }} bordered size="middle">
                <Descriptions.Item label="User ID">{user?.id}</Descriptions.Item>
                <Descriptions.Item label="Role">{user?.role}</Descriptions.Item>
                <Descriptions.Item label="Account Created">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Last Login">
                  {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "N/A"}
                </Descriptions.Item>
              </Descriptions>
            </ContentCard>
          </Space>
        </Col>
      </Row>
    </PageContainer>
  );
}
