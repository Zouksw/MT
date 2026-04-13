"use client";

import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, Switch } from "antd";

export default function TimeseriesEdit() {
  const { formProps, saveButtonProps } = useForm({
    redirect: "show",
  });

  const { selectProps: datasetSelectProps } = useSelect({
    resource: "datasets",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Edit saveButtonProps={saveButtonProps} breadcrumb={false}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Dataset"
          name="datasetId"
          rules={[{ required: true }]}
        >
          <Select {...datasetSelectProps} placeholder="Select dataset" />
        </Form.Item>

        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true }]}
        >
          <Input placeholder="Temperature" />
        </Form.Item>

        <Form.Item
          label="Slug"
          name="slug"
          rules={[
            { required: true },
            { pattern: /^[a-z0-9-]+$/, message: "Only lowercase letters, numbers, and hyphens" }
          ]}
        >
          <Input placeholder="temperature" />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
        >
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item
          label="Unit"
          name="unit"
        >
          <Input placeholder="°C, MB, %" />
        </Form.Item>

        <Form.Item
          label="Color"
          name="colorHex"
          initialValue="#0a72ef"
        >
          <Input type="color" style={{ width: 100, height: 40 }} />
        </Form.Item>

        <Form.Item
          label="Timezone"
          name="timezone"
          initialValue="UTC"
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Anomaly Detection"
          name="isAnomalyDetectionEnabled"
          valuePropName="checked"
          initialValue={false}
        >
          <Switch />
        </Form.Item>
      </Form>
    </Edit>
  );
}
