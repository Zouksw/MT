"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Form,
  Switch,
  Space,
  Typography,
  Divider,
  message,
  Alert,
} from "antd";
import {
  MailOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

const { Text } = Typography;

interface NotificationPreferences {
  email: {
    enabled: boolean;
    alerts: boolean;
    anomalies: boolean;
    forecasts: boolean;
  };
}

const defaultPreferences: NotificationPreferences = {
  email: {
    enabled: true,
    alerts: true,
    anomalies: true,
    forecasts: false,
  },
};

export default function NotificationsSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      // For now, use default preferences
      // In the future, this would fetch from the backend
      setPreferences(defaultPreferences);
      form.setFieldsValue(defaultPreferences);
    } catch {
      message.error("Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleSave = async (values: NotificationPreferences) => {
    setSaving(true);
    try {
      // For now, save to localStorage
      // In the future, this would send to the backend via /api/auth/me with preferences
      localStorage.setItem("notificationPreferences", JSON.stringify(values));
      setPreferences(values);
      message.success("Notification preferences saved successfully");
    } catch {
      message.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Notification Settings"
        description="Configure how you receive alerts and notifications"
      />

      <Alert
        type="info"
        message="Notification preferences are saved to your browser."
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Alert
        message="Email Notifications"
        description="Configure which events you want to be notified about via email."
        type="info"
        showIcon
        icon={<MailOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={preferences}
      >
        <ContentCard
          title="Email Notifications"
          subtitle={<MailOutlined />}
        >
          <Form.Item
            name={["email", "enabled"]}
            label="Enable Email Notifications"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider style={{ margin: "16px 0" }} />

          <Space direction="vertical" style={{ width: "100%" }}>
            <Text strong>Notification Types:</Text>

            <Form.Item
              name={["email", "alerts"]}
              label="Alert Notifications"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ display: "block", marginTop: -8, marginBottom: 12 }}>
              Receive emails when alerts are triggered
            </Text>

            <Form.Item
              name={["email", "anomalies"]}
              label="Anomaly Detection"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ display: "block", marginTop: -8, marginBottom: 12 }}>
              Get notified when anomalies are detected in your data
            </Text>

            <Form.Item
              name={["email", "forecasts"]}
              label="Forecast Results"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ display: "block", marginTop: -8, marginBottom: 12 }}>
              Receive forecast completion notifications
            </Text>
          </Space>
        </ContentCard>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            icon={<CheckCircleOutlined />}
            size="large"
          >
            Save Preferences
          </Button>
        </div>
      </Form>
    </PageContainer>
  );
}
