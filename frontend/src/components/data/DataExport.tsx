"use client";

import React, { useState } from "react";
import {
  Button,
  Dropdown,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Spin,
  message,
  Progress,
  Space,
  Typography,
  Tag,
  Alert,
  Divider,
  Row,
  Col,
  Card,
} from "antd";
import {
  DownloadOutlined,
  FileTextOutlined,
  FileOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
// Native download function (no external dependency needed)
const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface ExportFormat {
  id: string;
  name: string;
  icon: React.ReactNode;
  extension: string;
  mimeType: string;
  description: string;
}

interface ExportConfig {
  timeseries: string;
  format: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  aggregation?: string;
}

interface DataPoint {
  timestamp: number;
  value: number;
}

interface DataExportProps {
  timeseries?: string;
  onExportComplete?: (filename: string, recordCount: number) => void;
}

const exportFormats: ExportFormat[] = [
  {
    id: "csv",
    name: "CSV",
    icon: <FileTextOutlined />,
    extension: "csv",
    mimeType: "text/csv",
    description: "Comma-separated values, compatible with Excel",
  },
  {
    id: "json",
    name: "JSON",
    icon: <FileOutlined />,
    extension: "json",
    mimeType: "application/json",
    description: "JavaScript Object Notation",
  },
  {
    id: "txt",
    name: "Plain Text",
    icon: <FileTextOutlined />,
    extension: "txt",
    mimeType: "text/plain",
    description: "Simple text format with timestamp and value",
  },
];

export const DataExport: React.FC<DataExportProps> = ({
  timeseries: defaultTimeseries = "root.test2",
  onExportComplete,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [form] = Form.useForm();

  const exportData = async (config: ExportConfig) => {
    setExporting(true);
    setProgress(0);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("timeseries", config.timeseries);
      if (config.limit) params.append("limit", config.limit.toString());
      if (config.startTime) params.append("start_time", config.startTime.toString());
      if (config.endTime) params.append("end_time", config.endTime.toString());

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Fetch data
      const response = await fetch(`/api/iotdb/query?${params.toString()}`);

      clearInterval(progressInterval);
      setProgress(95);

      if (!response.ok) {
        throw new Error("Failed to fetch data for export");
      }

      const result = await response.json();
      const data: DataPoint[] = result.data || [];

      if (data.length === 0) {
        message.warning("No data available for the specified criteria");
        setExporting(false);
        setProgress(0);
        return;
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const sanitizedTimeseries = config.timeseries.replace(/[^a-zA-Z0-9_-]/g, "_");
      const formatConfig = exportFormats.find((f) => f.id === config.format)!;
      const filename = `${sanitizedTimeseries}_export_${timestamp}.${formatConfig.extension}`;

      // Export based on format
      switch (config.format) {
        case "csv":
          await exportToCSV(data, filename);
          break;
        case "json":
          await exportToJSON(data, filename);
          break;
        case "txt":
          await exportToTxt(data, filename);
          break;
        default:
          throw new Error("Unsupported export format");
      }

      setProgress(100);
      message.success(`Exported ${data.length} records to ${filename}`);

      onExportComplete?.(filename, data.length);

      setTimeout(() => {
        setModalVisible(false);
        setExporting(false);
        setProgress(0);
        form.resetFields();
      }, 1000);
    } catch (error: any) {
      message.error(`Export failed: ${error.message}`);
      setExporting(false);
      setProgress(0);
    }
  };

  const exportToCSV = async (data: DataPoint[], filename: string) => {
    // Create CSV manually (no external dependency)
    const header = "timestamp,value\n";
    const rows = data
      .map(
        (point) =>
          `${new Date(point.timestamp).toISOString()},${point.value.toFixed(6)}`
      )
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadFile(blob, filename);
  };

  const exportToJSON = async (data: DataPoint[], filename: string) => {
    const json = JSON.stringify(
      {
        timeseries: form.getFieldValue("timeseries"),
        exportTime: new Date().toISOString(),
        recordCount: data.length,
        data: data.map((point) => ({
          timestamp: new Date(point.timestamp).toISOString(),
          value: point.value,
        })),
      },
      null,
      2
    );
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    downloadFile(blob, filename);
  };

  const exportToTxt = async (data: DataPoint[], filename: string) => {
    const txt = data
      .map(
        (point) =>
          `${new Date(point.timestamp).toISOString()}\t${point.value.toFixed(6)}`
      )
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8;" });
    downloadFile(blob, filename);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      const config: ExportConfig = {
        timeseries: values.timeseries,
        format: values.format,
        limit: values.limit,
      };

      // Add time range if specified
      if (values.timeRange && values.timeRange.length === 2) {
        config.startTime = values.timeRange[0].valueOf();
        config.endTime = values.timeRange[1].valueOf();
      }

      exportData(config);
    } catch {
      // Validation failed
    }
  };

  const exportMenuItems = exportFormats.map((format) => ({
    key: format.id,
    label: (
      <Space>
        {format.icon}
        <span>{format.name}</span>
        <Text type="secondary" style={{ fontSize: 12 }}>
          ({format.extension})
        </Text>
      </Space>
    ),
    onClick: () => {
      form.setFieldsValue({ format: format.id });
      setModalVisible(true);
    },
  }));

  return (
    <>
      <Dropdown menu={{ items: exportMenuItems }} trigger={["click"]}>
        <Button
          type="primary"
          icon={<CloudDownloadOutlined />}
          size="large"
          style={{
            background: "#0066CC",
            border: "none",
            borderRadius: "3px",
            fontWeight: 600,
          }}
        >
          Export Data
        </Button>
      </Dropdown>

      <Modal
        title={
          <Space>
            <DownloadOutlined />
            <span>Export Data</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => {
          if (!exporting) {
            setModalVisible(false);
            form.resetFields();
          }
        }}
        onOk={handleModalOk}
        okText={exporting ? "Exporting..." : "Export"}
        okButtonProps={{ loading: exporting, disabled: exporting }}
        cancelButtonProps={{ disabled: exporting }}
        width={600}
      >
        <Spin spinning={exporting} tip="Preparing export...">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              timeseries: defaultTimeseries,
              format: "csv",
              limit: 10000,
            }}
          >
            <Form.Item
              label="Time Series"
              name="timeseries"
              rules={[{ required: true, message: "Please enter time series path" }]}
            >
              <Input placeholder="e.g., root.test2" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Export Format"
                  name="format"
                  rules={[{ required: true, message: "Please select format" }]}
                >
                  <Select>
                    {exportFormats.map((format) => (
                      <Select.Option key={format.id} value={format.id}>
                        <Space>
                          {format.icon}
                          <span>{format.name}</span>
                        </Space>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Max Records"
                  name="limit"
                  rules={[{ required: true, message: "Please enter limit" }]}
                  tooltip="Maximum number of records to export"
                >
                  <InputNumber min={1} max={1000000} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Time Range"
              name="timeRange"
              tooltip="Optional: specify a time range to filter data"
            >
              <RangePicker
                showTime
                style={{ width: "100%" }}
                placeholder={["Start Time", "End Time"]}
              />
            </Form.Item>

            {exporting && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Export Progress</Text>
                </div>
                <Progress percent={progress} status="active" />
                <div style={{ marginTop: 12 }}>
                  {progress === 100 && (
                    <Alert
                      message="Export completed successfully!"
                      type="success"
                      icon={<CheckCircleOutlined />}
                      showIcon
                    />
                  )}
                </div>
              </>
            )}

            <Divider />

            <Card size="small" style={{ background: "#f9fafb" }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>Export Format Info</Text>
              </div>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.format !== curr.format}>
                {() => {
                  const format = exportFormats.find((f) => f.id === form.getFieldValue("format"));
                  return format ? (
                    <>
                      <Paragraph style={{ marginBottom: 8, fontSize: 13 }}>
                        {format.description}
                      </Paragraph>
                      <Space>
                        <Tag>{format.extension.toUpperCase()}</Tag>
                        <Tag>MIME: {format.mimeType}</Tag>
                      </Space>
                    </>
                  ) : null;
                }}
              </Form.Item>
            </Card>

            <Alert
              message="Export Tips"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>Large datasets may take longer to process</li>
                  <li>CSV format is recommended for Excel compatibility</li>
                  <li>Use time range filter to reduce export size</li>
                </ul>
              }
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Form>
        </Spin>
      </Modal>
    </>
  );
};

export default DataExport;
