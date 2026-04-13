"use client";

import { useState } from "react";
import { Form, Input, Select, Switch, Button, Row, Col, Alert, Space, Divider, InputNumber } from "antd";
import { ArrowLeftOutlined, BellOutlined } from "@ant-design/icons";
import { useGo, useInvalidate, useNotification } from "@refinedev/core";
import { useList } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { useIsMobile } from "@/lib/responsive-utils";

// Security imports
import { validationRules, required } from "@/lib/validation";
import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { tokenManager } from "@/lib/tokenManager";
import { csrfProtection } from "@/lib/csrf";

const ALERT_TYPES = [
  { value: "ANOMALY", label: "Anomaly Detection", description: "Alerts when anomalies are detected" },
  { value: "FORECAST_READY", label: "Forecast Ready", description: "Alerts when forecast results are available" },
  { value: "SYSTEM", label: "System Event", description: "System-level notifications" },
  { value: "THRESHOLD", label: "Threshold Breach", description: "Alerts when values exceed thresholds" },
];

const SEVERITY_LEVELS = [
  { value: "INFO", label: "Info", color: "blue" },
  { value: "WARNING", label: "Warning", color: "orange" },
  { value: "ERROR", label: "Error", color: "red" },
];

export default function AlertCreate() {
  const go = useGo();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const isMobile = useIsMobile();

  // Get timeseries list
  const timeseriesResult = useList({
    resource: "timeseries",
    pagination: { pageSize: 1000 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const timeseriesList = timeseriesResult?.result?.data ?? [];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "Alerts & Notifications", href: "/alerts" },
    { title: "Create Alert" },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      // Type condition object
      const condition = values.condition as Record<string, unknown> | undefined;

      // Sanitize inputs
      const sanitizedValues = {
        name: sanitizer.sanitizeString(values.name as string || "", 100),
        type: values.type,
        severity: values.severity,
        timeseriesId: values.timeseriesId,
        condition: condition
          ? {
              operator: sanitizer.sanitizeString(condition.operator as string || "", 10),
              value: sanitizer.sanitizeNumber(condition.value, -Infinity, Infinity),
            }
          : undefined,
        cooldownMinutes: sanitizer.sanitizeNumber(values.cooldownMinutes as number, 0, 10080),
        description: sanitizer.sanitizeString(values.description as string || "", 1000),
        enabled: values.enabled,
      };

      const token = tokenManager.getToken();
      const csrfHeaders = csrfProtection.getHeaders();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...csrfHeaders,
        },
        credentials: "include",
        body: JSON.stringify(sanitizedValues),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create alert");
      }

      open?.({
        type: "success",
        message: "Alert Created Successfully",
        description: `The alert has been configured.`,
      });

      invalidate({
        resource: "alerts",
        invalidates: ["list"],
      });

      setTimeout(() => {
        go({ to: "/alerts", type: "push" });
      }, 1000);
    } catch (error: unknown) {
      const safeError = errorHandler.handleApiError(error);
      open?.({
        type: "error",
        message: "Failed to Create Alert",
        description: safeError.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title="Create Alert"
          description="Configure a new alert for monitoring your time series data"
          breadcrumbs={breadcrumbItems}
          actions={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => go({ to: "/alerts", type: "push" })}
            >
              {!isMobile && "Back to Alerts"}
            </Button>
          }
        />

        <Alert
          message="Alert Configuration"
          description="Configure alerts to notify you when specific events occur in your time series data. Alerts can be sent via email, webhook, or viewed in the alerts dashboard."
          type="info"
          showIcon
          icon={<BellOutlined />}
          style={{ marginBottom: isMobile ? 16 : 24 }}
        />

        <ContentCard title="Alert Details" subtitle="Configure alert settings" style={{ padding: isMobile ? 16 : 24 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              severity: "INFO",
              enabled: true,
            }}
          >
            {/* Alert Name */}
            <Row gutter={[isMobile ? 16 : 24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span className="font-semibold">Alert Name</span>}
                  name="name"
                  rules={[
                    validationRules.getAntRule(required("Alert name")),
                    validationRules.getAntRule(validationRules.createMinLengthValidator(3, "Alert name")),
                    validationRules.getAntRule(validationRules.createMaxLengthValidator(100, "Alert name")),
                  ]}
                  normalize={(value) => sanitizer.sanitizeString(value, 100)}
                >
                  <Input
                    placeholder="e.g., High Temperature Alert"
                    size="large"
                    maxLength={100}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Alert Type and Severity */}
            <Row gutter={[isMobile ? 16 : 24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span className="font-semibold">Alert Type</span>}
                  name="type"
                  rules={[{ required: true, message: "Please select alert type" }]}
                >
                  <Select placeholder="Select alert type" size="large">
                    {ALERT_TYPES.map((type) => (
                      <Select.Option key={type.value} value={type.value}>
                        <div>
                          <div>{type.label}</div>
                          <span className="text-body-sm text-gray-500 dark:text-gray-400">
                            {type.description}
                          </span>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span className="font-semibold">Severity Level</span>}
                  name="severity"
                  rules={[{ required: true, message: "Please select severity" }]}
                >
                  <Select placeholder="Select severity" size="large">
                    {SEVERITY_LEVELS.map((level) => (
                      <Select.Option key={level.value} value={level.value}>
                        <Space>
                          <span style={{ color: level.color }}>{level.label}</span>
                        </Space>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Time Series Selection */}
            <Form.Item
              label={<span className="font-semibold">Time Series</span>}
              name="timeseriesId"
              rules={[{ required: true, message: "Please select a time series" }]}
              tooltip="Select the time series to monitor"
            >
              <Select
                placeholder="Select a time series"
                showSearch
                size="large"
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(String(input).toLowerCase())
                }
              >
                {timeseriesList.map((ts: any) => (
                  <Select.Option key={ts.id} value={ts.id}>
                    <Space>
                      <span>{ts.name}</span>
                      {ts.unit && <span className="text-body-sm text-gray-500 dark:text-gray-400">({ts.unit})</span>}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Divider />

            {/* Threshold Configuration (for THRESHOLD type) */}
            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
              {({ getFieldValue }) =>
                getFieldValue("type") === "THRESHOLD" ? (
                  <Row gutter={[isMobile ? 16 : 24, 16]}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label={<span className="font-semibold">Operator</span>}
                        name={["condition", "operator"]}
                        initialValue=">"
                      >
                        <Select>
                          <Select.Option value=">">Greater than</Select.Option>
                          <Select.Option value="<">Less than</Select.Option>
                          <Select.Option value=">=">Greater or equal</Select.Option>
                          <Select.Option value="<=">Less or equal</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label={<span className="font-semibold">Threshold Value</span>}
                        name={["condition", "value"]}
                        rules={[{ required: true, message: "Required" }]}
                      >
                        <InputNumber style={{ width: "100%" }} placeholder="e.g., 100" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label={<span className="font-semibold">Cooldown (minutes)</span>}
                        name="cooldownMinutes"
                        initialValue={5}
                        tooltip="Minimum time between alert notifications"
                      >
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : null
              }
            </Form.Item>

            {/* Description */}
            <Form.Item
              label={<span className="font-semibold">Description</span>}
              name="description"
              rules={[
                validationRules.getAntRule(validationRules.createMaxLengthValidator(1000, "Description")),
              ]}
              normalize={(value) => sanitizer.sanitizeString(value, 1000)}
            >
              <Input.TextArea
                rows={3}
                placeholder="Describe what this alert monitors and when it should trigger..."
                maxLength={1000}
                showCount
              />
            </Form.Item>

            {/* Enable/Disable */}
            <Form.Item
              label={<span className="font-semibold">Status</span>}
              name="enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            </Form.Item>

            <Divider style={{ margin: "24px 0" }} />

            <Form.Item>
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  background: "#171717",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                }}
              >
                Create Alert
              </Button>
            </Form.Item>
          </Form>
        </ContentCard>
      </div>
    </PageContainer>
  );
}
