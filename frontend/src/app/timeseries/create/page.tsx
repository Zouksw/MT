"use client";

import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, Switch, Row, Col } from "antd";

import { ContentCard } from "@/components/layout/ContentCard";

export default function TimeseriesCreate() {
  const { formProps, saveButtonProps } = useForm({
    redirect: "show",
  });

  const { selectProps: datasetSelectProps } = useSelect({
    resource: "datasets",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Create saveButtonProps={saveButtonProps} title="Create Time Series" breadcrumb={false}>
      <Form {...formProps} layout="vertical">
        <ContentCard
          title="Basic Information"
          subtitle="Configure the basic properties of your time series"
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="font-semibold">Dataset</span>}
                name="datasetId"
                rules={[{ required: true, message: "Please select a dataset" }]}
              >
                <Select {...datasetSelectProps} placeholder="Select dataset" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="font-semibold">Name</span>}
                name="name"
                rules={[{ required: true, message: "Please enter a name" }]}
              >
                <Input placeholder="Temperature" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="font-semibold">Slug</span>}
                name="slug"
                rules={[
                  { required: true, message: "Please enter a slug" },
                  {
                    pattern: /^[a-z0-9-]+$/,
                    message: "Only lowercase letters, numbers, and hyphens",
                  },
                ]}
              >
                <Input placeholder="temperature" prefix="/" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="font-semibold">Unit</span>}
                name="unit"
                tooltip="The unit of measurement for this time series"
              >
                <Input placeholder="°C, MB, %" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={<span className="font-semibold">Description</span>}
            name="description"
          >
            <Input.TextArea
              rows={3}
              placeholder="Describe what this time series measures..."
            />
          </Form.Item>
        </ContentCard>

        <ContentCard
          title="Display Settings"
          subtitle="Configure how this time series appears in visualizations"
          style={{ marginTop: 24 }}
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="font-semibold">Color</span>}
                name="colorHex"
                initialValue="#F59E0B"
                tooltip="Color used in charts and visualizations"
              >
                <Input
                  type="color"
                  style={{ width: "100%", height: 40 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="font-semibold">Timezone</span>}
                name="timezone"
                initialValue="UTC"
                tooltip="Timezone for timestamp display"
              >
                <Input placeholder="UTC" />
              </Form.Item>
            </Col>
          </Row>
        </ContentCard>

        <ContentCard
          title="Advanced Options"
          subtitle="Configure additional features for this time series"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label={<span className="font-semibold">Anomaly Detection</span>}
            name="isAnomalyDetectionEnabled"
            valuePropName="checked"
            initialValue={false}
            tooltip="Enable automatic anomaly detection for this time series"
          >
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>

          <p className="text-body-sm text-gray-500 dark:text-gray-400">
            When enabled, the system will automatically analyze this time series for anomalies using machine learning algorithms.
          </p>
        </ContentCard>
      </Form>
    </Create>
  );
}
