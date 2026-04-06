"use client";

import { useState } from "react";
import { Form, Input, Select, InputNumber, Button, Row, Col, Typography, Alert, Space, Divider } from "antd";
import { ArrowLeftOutlined, AlertOutlined } from "@ant-design/icons";
import { useGo, useInvalidate, useNotification } from "@refinedev/core";
import { useList } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

const { Text } = Typography;

const SEVERITY_LEVELS = [
  { value: "LOW", label: "Low", color: "green", description: "Minor deviation from expected values" },
  { value: "MEDIUM", label: "Medium", color: "orange", description: "Notable anomaly worth investigating" },
  { value: "HIGH", label: "High", color: "red", description: "Significant deviation requiring attention" },
  { value: "CRITICAL", label: "Critical", color: "purple", description: "Extreme deviation, immediate action needed" },
];

const DETECTION_METHODS = [
  { value: "statistical", label: "Statistical (Z-Score)" },
  { value: "iqr", label: "Interquartile Range (IQR)" },
  { value: "isolation_forest", label: "Isolation Forest" },
  { value: "lstm", label: "LSTM Autoencoder" },
  { value: "manual", label: "Manual Entry" },
];

export default function AnomalyCreate() {
  const go = useGo();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Get timeseries list
  const timeseriesResult = useList({
    resource: "timeseries",
    pagination: { pageSize: 1000 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const timeseriesList = timeseriesResult?.result?.data ?? [];

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const { timeseriesId, severity, value, expectedRange, detectionMethod, notes } = values;

      // Get timeseries path
      const timeseries = timeseriesList.find((ts: any) => ts.id === timeseriesId);
      if (!timeseries) {
        throw new Error("Time series not found");
      }

      const timeseriesPath = timeseries.slug || timeseries.name;

      // Call API to create anomaly
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/anomalies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          timeseriesId,
          timeseriesPath,
          severity,
          value,
          expectedRange: {
            min: expectedRange?.min,
            max: expectedRange?.max,
          },
          detectionMethod,
          notes,
          detectedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create anomaly");
      }

      open?.({
        type: "success",
        message: "Anomaly Created Successfully",
        description: `The anomaly record has been created.`,
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
        message: "Failed to Create Anomaly",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title="Create Anomaly Record"
          description="Manually record an anomaly detected in your time series data"
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
          message="Manual Anomaly Entry"
          description="This form allows you to manually record anomalies that were detected outside the automated system. Use this for documenting known issues or manually identified anomalies."
          type="info"
          showIcon
          icon={<AlertOutlined />}
          style={{ marginBottom: 24 }}
        />

        <ContentCard title="Anomaly Details" subtitle="Enter the anomaly information">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              severity: "MEDIUM",
              detectionMethod: "manual",
            }}
          >
            {/* Time Series Selection */}
            <Row gutter={[24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Time Series</span>}
                  name="timeseriesId"
                  rules={[{ required: true, message: "Please select a time series" }]}
                  tooltip="Select the time series where the anomaly was detected"
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
                          {ts.unit && <Text type="secondary">({ts.unit})</Text>}
                        </Space>
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
                  tooltip="How severe is this anomaly?"
                >
                  <Select placeholder="Select severity" size="large">
                    {SEVERITY_LEVELS.map((level) => (
                      <Select.Option key={level.value} value={level.value}>
                        <Space>
                          <span style={{ color: level.color }}>{level.label}</span>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            - {level.description}
                          </Text>
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
                  <Select placeholder="Select detection method" size="large">
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

            {/* Value Information */}
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Anomalous Value</span>}
                  name="value"
                  rules={[{ required: true, message: "Please enter the anomalous value" }]}
                  tooltip="The actual value that was detected as anomalous"
                >
                  <InputNumber
                    placeholder="e.g., 45.7"
                    style={{ width: "100%" }}
                    size="large"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>Expected Range</span>}
                  tooltip="The normal expected range of values"
                >
                  <Input.Group compact>
                    <Form.Item
                      name={["expectedRange", "min"]}
                      noStyle
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <InputNumber
                        placeholder="Min"
                        style={{ width: "50%" }}
                        addonBefore="Min"
                      />
                    </Form.Item>
                    <Form.Item
                      name={["expectedRange", "max"]}
                      noStyle
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <InputNumber
                        placeholder="Max"
                        style={{ width: "50%" }}
                        addonBefore="Max"
                      />
                    </Form.Item>
                  </Input.Group>
                </Form.Item>
              </Col>
            </Row>

            {/* Notes */}
            <Form.Item
              label={<span style={{ fontWeight: 500 }}>Notes</span>}
              name="notes"
              tooltip="Any additional context about this anomaly"
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe the anomaly, potential causes, or any relevant context..."
              />
            </Form.Item>

            <Divider style={{ margin: "24px 0" }} />

            <Form.Item>
              <Button type="primary" size="large" htmlType="submit" loading={loading} block>
                Create Anomaly Record
              </Button>
            </Form.Item>
          </Form>
        </ContentCard>
      </div>
    </PageContainer>
  );
}
