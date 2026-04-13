"use client";

import React, { useState } from "react";
import { Form, Input, Button, Row, Col, Typography, Space, Alert, Switch } from "antd";
import { ArrowLeftOutlined, KeyOutlined } from "@ant-design/icons";
import { useGo, useInvalidate, useNotification } from "@refinedev/core";
import { useOne } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

const { Text } = Typography;

interface ApiKeyEditPageProps {
  params: Promise<{ id: string }>;
}

export default function ApiKeyEditPage({ params }: ApiKeyEditPageProps) {
  const { id } = React.use(params);
  const go = useGo();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Get API key data
  const apiKeyResult = useOne({
    resource: "apikeys",
    id,
  });

  const apiKey = apiKeyResult?.result?.data;
  const isLoadingKey = apiKeyResult?.query?.isLoading ?? false;

  // Set form values when data is loaded
  if (apiKey && !form.isFieldsTouched()) {
    form.setFieldsValue({
      name: apiKey.name,
      isActive: apiKey.isActive,
    });
  }

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/api-keys/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update API key");
      }

      open?.({
        type: "success",
        message: "API Key Updated Successfully",
        description: `The API key has been updated.`,
      });

      invalidate({
        resource: "apikeys",
        invalidates: ["list"],
      });

      setTimeout(() => {
        go({ to: "/apikeys", type: "push" });
      }, 1000);
    } catch (error: any) {
      open?.({
        type: "error",
        message: "Failed to Update API Key",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingKey) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert message="Loading API key data..." type="info" />
        </ContentCard>
      </PageContainer>
    );
  }

  if (!apiKey) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert message="API key not found" type="error" />
        </ContentCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <PageHeader
          title="Edit API Key"
          description={`Update API key: ${apiKey.name}`}
          actions={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => go({ to: "/apikeys", type: "push" })}
            >
              Back to API Keys
            </Button>
          }
        />

        <Alert
          message="API Key Settings"
          description="You can update the name or active status of your API key. The key value itself cannot be changed for security reasons."
          type="info"
          showIcon
          icon={<KeyOutlined />}
          style={{ marginBottom: 24 }}
        />

        <ContentCard title="API Key Details" subtitle="Update API key information">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {/* API Key Name */}
            <Row gutter={[24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span style={{ fontWeight: 500 }}>API Key Name</span>}
                  name="name"
                  rules={[{ required: true, message: "Please enter a name" }]}
                >
                  <Input
                    placeholder="e.g., Production App Key"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Key Information - Read Only */}
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Key ID</Text>
                <div style={{ fontSize: 14, fontFamily: "monospace", marginTop: 4 }}>
                  {apiKey.id.slice(0, 8)}...
                </div>
              </Col>
              <Col xs={24} md={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Last Characters</Text>
                <div style={{ fontSize: 14, fontFamily: "monospace", marginTop: 4 }}>
                  ...{apiKey.lastCharacters?.toString(16).toUpperCase().padStart(8, "0") || "N/A"}
                </div>
              </Col>
            </Row>

            {/* Active Status */}
            <Form.Item
              label={<span style={{ fontWeight: 500 }}>Status</span>}
              name="isActive"
              valuePropName="checked"
              tooltip="Enable or disable this API key"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>

            {/* Usage Statistics - Read Only */}
            {apiKey.usageCount !== undefined && (
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Usage Statistics</Text>
                <div style={{ marginTop: 8 }}>
                  <Text>Total requests: </Text>
                  <Text strong>{apiKey.usageCount}</Text>
                </div>
                {apiKey.lastUsedAt && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Last used: </Text>
                    <Text>{new Date(apiKey.lastUsedAt).toLocaleString()}</Text>
                  </div>
                )}
              </div>
            )}

            <Space style={{ width: "100%", marginTop: 24 }}>
              <Button type="primary" size="large" htmlType="submit" loading={loading} style={{ flex: 1 }}>
                Update API Key
              </Button>
              <Button size="large" onClick={() => go({ to: "/apikeys", type: "push" })}>
                Cancel
              </Button>
            </Space>
          </Form>
        </ContentCard>
      </div>
    </PageContainer>
  );
}
