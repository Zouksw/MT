"use client";

import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Select, Typography, DatePicker } from "antd";

import { ContentCard } from "@/components/layout/ContentCard";

const { Text } = Typography;

export default function ApiKeyCreate() {
  const { formProps, saveButtonProps } = useForm({});

  return (
    <Create saveButtonProps={saveButtonProps} title="Create API Key" breadcrumb={false}>
      <Form {...formProps} layout="vertical">
        <ContentCard
          title="API Key Information"
          subtitle="Configure your new API key"
        >
          <Form.Item
            label={<span style={{ fontWeight: 500 }}>Key Name</span>}
            name="name"
            rules={[{ required: true, message: "Please enter a name" }]}
          >
            <Input placeholder="Production API Key" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 500 }}>Scopes</span>}
            name="scopes"
            initialValue={["read:datasets", "read:timeseries"]}
          >
            <Select mode="tags" placeholder="Select scopes">
              <Select.Option value="read:datasets">Read Datasets</Select.Option>
              <Select.Option value="write:datasets">Write Datasets</Select.Option>
              <Select.Option value="read:timeseries">Read Time Series</Select.Option>
              <Select.Option value="write:timeseries">Write Time Series</Select.Option>
              <Select.Option value="train:models">Train Models</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Select the permissions this API key should have. You can add custom scopes by typing.
          </Text>
        </ContentCard>

        <ContentCard
          title="Security Settings"
          subtitle="Configure expiration and access limits"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label={<span style={{ fontWeight: 500 }}>Expiration Date</span>}
            name="expiresAt"
          >
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="Select expiration date"
            />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            API keys that expire provide better security. Consider setting an expiration date for production keys.
          </Text>
        </ContentCard>
      </Form>
    </Create>
  );
}
