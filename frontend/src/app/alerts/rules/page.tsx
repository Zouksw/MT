"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Space,
  Typography,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Alert,
  message,
  Popconfirm,
  Row,
  Col,
  Card,
} from "antd";
import type { Breakpoint } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  BellOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { authFetch } from "@/utils/auth";
import { useIsMobile } from "@/lib/responsive-utils";

const { Text } = Typography;

interface AlertRule {
  id: string;
  name: string;
  type: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
  condition: AlertCondition;
  severity: "INFO" | "WARNING" | "ERROR";
  enabled: boolean;
  notificationChannels: NotificationChannel[];
  cooldownMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

interface AlertCondition {
  type: "threshold" | "anomaly" | "pattern" | "forecast";
  operator?: ">" | "<" | "=" | "!=" | ">=" | "<=";
  value?: number;
  anomalySeverity?: string[];
  windowMinutes?: number;
}

interface NotificationChannel {
  type: "email" | "webhook" | "slack";
  config: {
    email?: string;
    webhookUrl?: string;
    slackWebhookUrl?: string;
  };
}

interface Timeseries {
  id: string;
  name: string;
  dataset: {
    name: string;
  };
}

const API_BASE = ""; // Use relative paths for Next.js rewrites

export default function AlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [timeseries, setTimeseries] = useState<Timeseries[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const isMobile = useIsMobile();

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      // Since rules are stored in user preferences, we need to get user data
      const response = await authFetch(`${API_BASE}/api/auth/me`);

      if (!response.ok) throw new Error("Failed to fetch alert rules");

      const userData = await response.json();
      const preferences = userData.user?.preferences || {};
      const alertRules = preferences.alertRules || [];

      setRules(alertRules);
    } catch {
      message.error("Failed to load alert rules");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTimeseries = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/timeseries`);

      if (!response.ok) throw new Error("Failed to fetch timeseries");

      const data = await response.json();
      setTimeseries(data.timeseries || data.data || []);
    } catch {
      message.error("Failed to fetch timeseries");
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchTimeseries();
  }, [fetchRules, fetchTimeseries]);

  const handleCreate = () => {
    setEditingRule(null);
    setModalVisible(true);
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setModalVisible(true);
  };

  const handleDelete = async (ruleId: string) => {
    try {
      const response = await authFetch(`${API_BASE}/api/alerts/rules/${ruleId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete alert rule");

      message.success("Alert rule deleted");
      fetchRules();
    } catch {
      message.error("Failed to delete alert rule");
    }
  };

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      await authFetch(`${API_BASE}/api/alerts/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      fetchRules();
      message.success(`Alert rule ${!rule.enabled ? "enabled" : "disabled"}`);
    } catch {
      message.error("Failed to update alert rule");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 180,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (name: string, record: AlertRule) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.id.slice(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (type: string) => {
        const colors: Record<string, string> = {
          ANOMALY: "red",
          FORECAST_READY: "blue",
          SYSTEM: "green",
        };
        const icons: Record<string, string> = {
          ANOMALY: "🚨",
          FORECAST_READY: "📈",
          SYSTEM: "⚙️",
        };
        return (
          <Tag color={colors[type]} style={{ margin: 0 }}>
            {icons[type]} {type.replace(/_/g, " ")}
          </Tag>
        );
      },
    },
    {
      title: "Condition",
      dataIndex: "condition",
      key: "condition",
      width: 140,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (condition: AlertCondition) => {
        if (condition.type === "threshold") {
          return (
            <Tag style={{ margin: 0 }}>
              Value {condition.operator} {condition.value}
            </Tag>
          );
        }
        if (condition.type === "anomaly") {
          return <Tag color="orange" style={{ margin: 0 }}>Anomaly</Tag>;
        }
        return <Tag style={{ margin: 0 }}>{condition.type}</Tag>;
      },
    },
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      width: 100,
      align: "center" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (severity: string) => {
        const colors: Record<string, string> = {
          INFO: "blue",
          WARNING: "orange",
          ERROR: "red",
        };
        return (
          <Tag color={colors[severity]} style={{ margin: 0 }}>
            {severity}
          </Tag>
        );
      },
    },
    {
      title: "Notifications",
      dataIndex: "notificationChannels",
      key: "notificationChannels",
      width: 140,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (channels: NotificationChannel[]) => (
        <Space size={4} wrap>
          {channels.map((ch, idx) => (
            <Tag key={idx} icon={<BellOutlined />} style={{ margin: 0 }}>
              {ch.type}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Cooldown",
      dataIndex: "cooldownMinutes",
      key: "cooldownMinutes",
      width: 100,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (cooldown?: number) => (cooldown ? `${cooldown} min` : "-"),
    },
    {
      title: "Status",
      dataIndex: "enabled",
      key: "enabled",
      width: 100,
      align: "center" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (enabled: boolean) => (
        <Tag color={enabled ? "green" : "default"} style={{ margin: 0 }}>
          {enabled ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: isMobile ? 80 : 160,
      fixed: "right" as const,
      render: (_: any, record: AlertRule) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {!isMobile && "Edit"}
          </Button>
          <Switch
            size="small"
            checked={record.enabled}
            onChange={() => handleToggleEnabled(record)}
          />
          {!isMobile && (
            <Popconfirm
              title="Delete Alert Rule"
              description="Are you sure you want to delete this alert rule?"
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "Alerts & Notifications", href: "/alerts" },
    { title: "Alert Rules" },
  ];

  // Statistics
  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.enabled).length;
  const errorSeverityRules = rules.filter((r) => r.severity === "ERROR").length;

  return (
    <PageContainer>
      <PageHeader
        title="Alert Rules"
        description="Configure automated alert rules for monitoring your time series data"
        breadcrumbs={breadcrumbItems}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {!isMobile && "Create Rule"}
          </Button>
        }
      />

      {/* Statistics Cards */}
      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Col xs={12} sm={12} md={8}>
          <StatCard
            title="Total Rules"
            value={totalRules}
            icon={<BellOutlined />}
            variant="primary"
          />
        </Col>
        <Col xs={12} sm={12} md={8}>
          <StatCard
            title="Active Rules"
            value={activeRules}
            icon={<CheckCircleOutlined />}
            variant="success"
          />
        </Col>
        <Col xs={12} sm={12} md={8}>
          <StatCard
            title="Error Severity"
            value={errorSeverityRules}
            icon={<WarningOutlined />}
            variant="error"
          />
        </Col>
      </Row>

      {/* Info Alert */}
      <Alert
        message="About Alert Rules"
        description="Alert rules automatically monitor your timeseries data and send notifications when specific conditions are met. You can set up rules based on thresholds, anomalies, or forecast availability."
        type="info"
        showIcon
        style={{ marginBottom: isMobile ? 16 : 24 }}
      />

      {/* Rules Table */}
      <DataTable
        columns={columns}
        dataSource={rules}
        loading={loading}
        rowKey="id"
        enableZebraStriping={true}
        stickyHeader={true}
        scroll={{ x: isMobile ? "max-content" : undefined }}
        pagination={{
          pageSize: isMobile ? 10 : 20,
          showSizeChanger: !isMobile,
          simple: isMobile,
        }}
      />

      {/* Create/Edit Modal */}
      <AlertRuleModal
        visible={modalVisible}
        editingRule={editingRule}
        timeseries={timeseries}
        onClose={() => setModalVisible(false)}
        onSave={() => {
          setModalVisible(false);
          fetchRules();
        }}
      />
    </PageContainer>
  );
}

// Alert Rule Modal Component
interface AlertRuleModalProps {
  visible: boolean;
  editingRule: AlertRule | null;
  timeseries: Timeseries[];
  onClose: () => void;
  onSave: () => void;
}

function AlertRuleModal({ visible, editingRule, timeseries, onClose, onSave }: AlertRuleModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [conditionType, setConditionType] = useState<string>("threshold");
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([
    { type: "email", config: {} },
  ]);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (visible && editingRule) {
      form.setFieldsValue(editingRule);
      setConditionType(editingRule.condition.type || "threshold");
      setNotificationChannels(editingRule.notificationChannels || [{ type: "email", config: {} }]);
    } else if (visible) {
      form.resetFields();
      setConditionType("threshold");
      setNotificationChannels([{ type: "email", config: {} }]);
    }
  }, [visible, editingRule, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        condition: {
          type: conditionType,
          ...values.condition,
        },
        notificationChannels,
      };

      const url = editingRule
        ? `${API_BASE}/api/alerts/rules/${editingRule.id}`
        : `${API_BASE}/api/alerts/rules`;

      const response = await authFetch(url, {
        method: editingRule ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save alert rule");

      message.success(editingRule ? "Alert rule updated" : "Alert rule created");
      onSave();
    } catch {
      message.error("Failed to save alert rule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={isMobile ? "95%" : 700}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Rule Name"
          rules={[{ required: true, message: "Please enter a name" }]}
        >
          <Input placeholder="e.g., High Temperature Alert" />
        </Form.Item>

        <Form.Item
          name="timeseriesId"
          label="Timeseries"
          rules={[{ required: true, message: "Please select a timeseries" }]}
        >
          <Select placeholder="Select a timeseries" showSearch optionFilterProp="children">
            {timeseries.map((ts) => (
              <Select.Option key={ts.id} value={ts.id}>
                {ts.name} ({ts.dataset.name})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="type"
          label="Alert Type"
          rules={[{ required: true, message: "Please select alert type" }]}
        >
          <Select>
            <Select.Option value="ANOMALY">Anomaly Detection</Select.Option>
            <Select.Option value="FORECAST_READY">Forecast Ready</Select.Option>
            <Select.Option value="SYSTEM">System Event</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Condition">
          <Input.Group compact>
            <Form.Item
              name={["condition", "type"]}
              noStyle
              rules={[{ required: true, message: "Required" }]}
            >
              <Select
                style={{ width: "40%" }}
                onChange={(value) => setConditionType(value)}
              >
                <Select.Option value="threshold">Threshold</Select.Option>
                <Select.Option value="anomaly">Anomaly</Select.Option>
                <Select.Option value="forecast">Forecast Ready</Select.Option>
              </Select>
            </Form.Item>

            {conditionType === "threshold" && (
              <>
                <Form.Item name={["condition", "operator"]} noStyle initialValue=">">
                  <Select style={{ width: "30%" }}>
                    <Select.Option value=">">Greater than</Select.Option>
                    <Select.Option value="<">Less than</Select.Option>
                    <Select.Option value="=">Equals</Select.Option>
                    <Select.Option value=">=">Greater or equal</Select.Option>
                    <Select.Option value="<=">Less or equal</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  name={["condition", "value"]}
                  noStyle
                  rules={[{ required: true, message: "Required" }]}
                >
                  <InputNumber style={{ width: "30%" }} placeholder="Value" />
                </Form.Item>
              </>
            )}
          </Input.Group>
        </Form.Item>

        <Form.Item
          name="severity"
          label="Severity"
          rules={[{ required: true, message: "Please select severity" }]}
        >
          <Select>
            <Select.Option value="INFO">Info</Select.Option>
            <Select.Option value="WARNING">Warning</Select.Option>
            <Select.Option value="ERROR">Error</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="cooldownMinutes"
          label="Cooldown (minutes)"
          tooltip="Minimum time between alerts for this rule"
        >
          <InputNumber min={0} placeholder="e.g., 5" style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Notification Channels">
          <Space direction="vertical" style={{ width: "100%" }}>
            {notificationChannels.map((channel, index) => (
              <Card key={index} size="small">
                <Form.Item label="Channel Type" style={{ marginBottom: 8 }}>
                  <Select
                    value={channel.type}
                    onChange={(value) => {
                      const newChannels = [...notificationChannels];
                      newChannels[index] = { type: value, config: {} };
                      setNotificationChannels(newChannels);
                    }}
                  >
                    <Select.Option value="email">Email</Select.Option>
                    <Select.Option value="webhook">Webhook</Select.Option>
                    <Select.Option value="slack">Slack</Select.Option>
                  </Select>
                </Form.Item>

                {channel.type === "email" && (
                  <Form.Item label="Email Address" style={{ marginBottom: 0 }}>
                    <Input
                      placeholder="your-email@example.com"
                      value={channel.config.email}
                      onChange={(e) => {
                        const newChannels = [...notificationChannels];
                        newChannels[index] = {
                          ...channel,
                          config: { ...channel.config, email: e.target.value },
                        };
                        setNotificationChannels(newChannels);
                      }}
                    />
                  </Form.Item>
                )}

                {channel.type === "webhook" && (
                  <Form.Item label="Webhook URL" style={{ marginBottom: 0 }}>
                    <Input
                      placeholder="https://your-webhook-url.com"
                      value={channel.config.webhookUrl}
                      onChange={(e) => {
                        const newChannels = [...notificationChannels];
                        newChannels[index] = {
                          ...channel,
                          config: { ...channel.config, webhookUrl: e.target.value },
                        };
                        setNotificationChannels(newChannels);
                      }}
                    />
                  </Form.Item>
                )}

                {channel.type === "slack" && (
                  <Form.Item label="Slack Webhook URL" style={{ marginBottom: 0 }}>
                    <Input
                      placeholder="https://hooks.slack.com/services/..."
                      value={channel.config.slackWebhookUrl}
                      onChange={(e) => {
                        const newChannels = [...notificationChannels];
                        newChannels[index] = {
                          ...channel,
                          config: { ...channel.config, slackWebhookUrl: e.target.value },
                        };
                        setNotificationChannels(newChannels);
                      }}
                    />
                  </Form.Item>
                )}
              </Card>
            ))}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
