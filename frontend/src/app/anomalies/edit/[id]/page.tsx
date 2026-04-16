"use client";

import React, { useState } from "react";
import { Form, Input, Select, InputNumber, Button, Row, Col, Alert, Space, Divider } from "antd";
import { ArrowLeftOutlined, AlertOutlined } from "@ant-design/icons";
import { useGo, useInvalidate, useNotification } from "@refinedev/core";
import { useOne, useList } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

const SEVERITY_LEVELS = [
  { value: "LOW", label: "Low", color: "green" },
  { value: "MEDIUM", label: "Medium", color: "orange" },
  { value: "HIGH", label: "High", color: "red" },
  { value: "CRITICAL", label: "Critical", color: "purple" },
];

const DETECTION_METHODS = [
  { value: "statistical", label: "Statistical (Z-Score)" },
  { value: "iqr", label: "Interquartile Range (IQR)" },
  { value: "isolation_forest", label: "Isolation Forest" },
  { value: "lstm", label: "LSTM Autoencoder" },
  { value: "manual", label: "Manual Entry" },
];

interface AnomalyShowPageProps {
  params: Promise<{ id: string }>;
}

export default function AnomalyEditPage({ params }: AnomalyShowPageProps) {
  const { id } = React.use(params);
  const go = useGo();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Get anomaly data
  const anomalyResult = useOne({
    resource: "anomalies",
    id,
  });

  const anomaly = anomalyResult?.result?.data;
  const isLoadingAnomaly = anomalyResult?.query?.isLoading ?? false;

  // Get timeseries list
  const timeseriesResult = useList({
    resource: "timeseries",
    pagination: { pageSize: 1000 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const timeseriesList = timeseriesResult?.result?.data ?? [];

  // Set form values when data is loaded
  if (anomaly && !form.isFieldsTouched()) {
    form.setFieldsValue({
      timeseriesId: anomaly.timeseriesId,
      severity: anomaly.severity,
      value: anomaly.value,
      expectedRange: {
        min: anomaly.minExpected,
        max: anomaly.maxExpected,
      },
      detectionMethod: anomaly.detectionMethod,
      notes: anomaly.notes,
    });
  }

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const { tokenManager } = await import('@/lib/tokenManager');
      const token = tokenManager.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/anomalies/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update anomaly");
      }

      open?.({
        type: "success",
        message: "Anomaly Updated Successfully",
        description: `The anomaly record has been updated.`,
      });

      invalidate({
        resource: "anomalies",
        invalidates: ["list"],
      });

      setTimeout(() => {
        go({ to: "/anomalies", type: "push" });
      }, 1000);
    } catch (error: any) {
      open?.({
        type: "error",
        message: "Failed to Update Anomaly",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAnomaly) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert message="Loading anomaly data..." type="info" />
        </ContentCard>
      </PageContainer>
    );
  }

  if (!anomaly) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert message="Anomaly not found" type="error" />
        </ContentCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title="Edit Anomaly Record"
          description={`Editing anomaly ${id.slice(0, 8)}...`}
          actions={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => go({ to: "/anomalies", type: "push" })}
            >
              Back to Anomalies
            </Button>
          }
        />

        <Alert
          message="Read-Only Fields"
          description="Some fields like detection time and initial values cannot be modified."
          type="info"
          showIcon
          icon={<AlertOutlined />}
          style={{ marginBottom: 24 }}
        />

        <ContentCard title="Anomaly Details" subtitle="Update the anomaly information">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {/* Time Series Selection - Read Only */}
            <Row gutter={[24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Time Series</span>}
                  name="timeseriesId"
                >
                  <Select disabled showSearch>
                    {timeseriesList.map((ts: any) => (
                      <Select.Option key={ts.id} value={ts.id}>
                        {ts.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Severity Level */}
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Severity Level</span>}
                  name="severity"
                  rules={[{ required: true, message: "Please select severity level" }]}
                >
                  <Select placeholder="Select severity">
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

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Detection Method</span>}
                  name="detectionMethod"
                  rules={[{ required: true, message: "Please select detection method" }]}
                >
                  <Select disabled>
                    {DETECTION_METHODS.map((method) => (
                      <Select.Option key={method.value} value={method.value}>
                        {method.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            {/* Value Information - Read Only */}
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Anomalous Value</span>}
                  name="value"
                >
                  <InputNumber disabled style={{ width: "100%" }} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Expected Range</span>}
                >
                  <Input.Group compact>
                    <Form.Item name={["expectedRange", "min"]} noStyle>
                      <InputNumber disabled style={{ width: "50%" }} placeholder="Min" />
                    </Form.Item>
                    <Form.Item name={["expectedRange", "max"]} noStyle>
                      <InputNumber disabled style={{ width: "50%" }} placeholder="Max" />
                    </Form.Item>
                  </Input.Group>
                </Form.Item>
              </Col>
            </Row>

            {/* Notes - Editable */}
            <Form.Item
              label={<span style={{ fontWeight: 500 }}>Notes</span>}
              name="notes"
            >
              <Input.TextArea rows={4} placeholder="Add notes or investigation results..." />
            </Form.Item>

            <Divider style={{ margin: "24px 0" }} />

            <Form.Item>
              <Button type="primary" size="large" htmlType="submit" loading={loading} block>
                Update Anomaly Record
              </Button>
            </Form.Item>
          </Form>
        </ContentCard>
      </div>
    </PageContainer>
  );
}
