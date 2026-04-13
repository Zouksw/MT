"use client";

import React, { useState } from "react";
import { Form, Input, Select, Switch, Button, Row, Col, Typography, Space, Divider, InputNumber } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useGo, useInvalidate, useNotification } from "@refinedev/core";
import { useOne, useList } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

const ALERT_TYPES = [
  { value: "ANOMALY", label: "Anomaly Detection" },
  { value: "FORECAST_READY", label: "Forecast Ready" },
  { value: "SYSTEM", label: "System Event" },
  { value: "THRESHOLD", label: "Threshold Breach" },
];

const SEVERITY_LEVELS = [
  { value: "INFO", label: "Info", color: "blue" },
  { value: "WARNING", label: "Warning", color: "orange" },
  { value: "ERROR", label: "Error", color: "red" },
];

interface AlertEditPageProps {
  params: Promise<{ id: string }>;
}

export default function AlertEditPage({ params }: AlertEditPageProps) {
  const { id } = React.use(params);
  const go = useGo();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Get alert data
  const alertResult = useOne({
    resource: "alerts",
    id,
  });

  const alert = alertResult?.result?.data;
  const isLoadingAlert = alertResult?.query?.isLoading ?? false;

  // Get timeseries list
  const timeseriesResult = useList({
    resource: "timeseries",
    pagination: { pageSize: 1000 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const timeseriesList = timeseriesResult?.result?.data ?? [];

  // Set form values when data is loaded
  if (alert && !form.isFieldsTouched()) {
    form.setFieldsValue({
      name: alert.name,
      type: alert.type,
      severity: alert.severity,
      timeseriesId: alert.timeseriesId,
      description: alert.description,
      enabled: alert.isRead !== false,
      condition: alert.condition,
      cooldownMinutes: alert.cooldownMinutes,
    });
  }

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update alert");
      }

      open?.({
        type: "success",
        message: "Alert Updated Successfully",
        description: `The alert configuration has been updated.`,
      });

      invalidate({
        resource: "alerts",
        invalidates: ["list"],
      });

      setTimeout(() => {
        go({ to: "/alerts", type: "push" });
      }, 1000);
    } catch (error: any) {
      open?.({
        type: "error",
        message: "Failed to Update Alert",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAlert) {
    return (
      <PageContainer>
        <ContentCard>
          <Typography.Text>Loading alert data...</Typography.Text>
        </ContentCard>
      </PageContainer>
    );
  }

  if (!alert) {
    return (
      <PageContainer>
        <ContentCard>
          <Typography.Text type="danger">Alert not found</Typography.Text>
        </ContentCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title="Edit Alert"
          description={`Editing alert: ${alert.name || id.slice(0, 8)}...`}
          actions={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => go({ to: "/alerts", type: "push" })}
            >
              Back to Alerts
            </Button>
          }
        />

        <ContentCard title="Alert Configuration" subtitle="Update alert settings">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {/* Alert Name */}
            <Row gutter={[24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Alert Name</span>}
                  name="name"
                  rules={[{ required: true, message: "Please enter an alert name" }]}
                >
                  <Input placeholder="e.g., High Temperature Alert" size="large" />
                </Form.Item>
              </Col>
            </Row>

            {/* Alert Type and Severity */}
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Alert Type</span>}
                  name="type"
                  rules={[{ required: true, message: "Please select alert type" }]}
                >
                  <Select placeholder="Select alert type" size="large">
                    {ALERT_TYPES.map((type) => (
                      <Select.Option key={type.value} value={type.value}>
                        {type.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Severity Level</span>}
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
              label={<span style={{ fontWeight: 500 }}>Time Series</span>}
              name="timeseriesId"
              rules={[{ required: true, message: "Please select a time series" }]}
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
                    {ts.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Divider />

            {/* Threshold Configuration */}
            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
              {({ getFieldValue }) =>
                getFieldValue("type") === "THRESHOLD" ? (
                  <Row gutter={[24, 16]}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label={<span style={{ fontWeight: 500 }}>Operator</span>}
                        name={["condition", "operator"]}
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
                        label={<span style={{ fontWeight: 500 }}>Threshold Value</span>}
                        name={["condition", "value"]}
                      >
                        <InputNumber style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label={<span style={{ fontWeight: 500 }}>Cooldown (minutes)</span>}
                        name="cooldownMinutes"
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
              label={<span style={{ fontWeight: 500 }}>Description</span>}
              name="description"
            >
              <Input.TextArea rows={3} placeholder="Alert description..." />
            </Form.Item>

            {/* Enable/Disable */}
            <Form.Item
              label={<span style={{ fontWeight: 500 }}>Status</span>}
              name="enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            </Form.Item>

            <Divider style={{ margin: "24px 0" }} />

            <Form.Item>
              <Button type="primary" size="large" htmlType="submit" loading={loading} block>
                Update Alert
              </Button>
            </Form.Item>
          </Form>
        </ContentCard>
      </div>
    </PageContainer>
  );
}
