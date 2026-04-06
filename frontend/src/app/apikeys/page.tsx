"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Space,
  Typography,
  Tag,
  message,
  Modal,
  Input,
  Popconfirm,
  Alert,
  Row,
  Col,
} from "antd";
import type { Breakpoint } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import GlassCard from "@/components/ui/GlassCard";
import { authFetch } from "@/utils/auth";
import { useIsMobile } from "@/lib/responsive-utils";

const { Text } = Typography;

interface ApiKey {
  id: string;
  name: string;
  lastCharacters: number;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateResponse {
  id: string;
  apiKey: string;
  name: string;
  lastCharacters: number;
  expiresAt: string | null;
  createdAt: string;
}

const API_BASE = ""; // Use relative paths for Next.js rewrites

export default function ApiKeyList() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateResponse | null>(null);
  const isMobile = useIsMobile();

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/api-keys`);

      if (!response.ok) {
        throw new Error("Failed to fetch API keys");
      }

      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch {
      message.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      message.error("Please enter a name for the API key");
      return;
    }

    try {
      const body: any = { name: newKeyName };

      if (expiryDays && expiryDays > 0) {
        body.expiresIn = expiryDays * 24 * 60 * 60;
      }

      const response = await authFetch(`${API_BASE}/api/api-keys`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to create API key");
      }

      const data: CreateResponse = await response.json();
      setCreatedKey(data);
      setCreateModalVisible(false);
      setNewKeyName("");
      setExpiryDays(null);
      message.success("API key created successfully");
      fetchApiKeys();
    } catch {
      message.error("Failed to create API key");
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const response = await authFetch(`${API_BASE}/api/api-keys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      message.success("API key deleted");
      fetchApiKeys();
    } catch {
      message.error("Failed to delete API key");
    }
  };

  // Calculate statistics
  const totalKeys = apiKeys.length;
  const activeKeys = apiKeys.filter((k) => k.isActive).length;
  const totalUsage = apiKeys.reduce((sum, k) => sum + k.usageCount, 0);

  // Define table columns
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 200,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (name: string, record: ApiKey) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.id.slice(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (isActive: boolean) => (
        <Tag
          icon={isActive ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={isActive ? "green" : "red"}
          style={{ margin: 0 }}
        >
          {isActive ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Last Characters",
      dataIndex: "lastCharacters",
      key: "lastCharacters",
      width: 140,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (lastChars: number) => (
        <Text code style={{ fontSize: 12 }}>
          ...{lastChars.toString(16).toUpperCase().padStart(8, "0")}
        </Text>
      ),
    },
    {
      title: "Usage",
      dataIndex: "usageCount",
      key: "usageCount",
      width: 140,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (count: number, record: ApiKey) => (
        <Space direction="vertical" size={0}>
          <Text>{count} requests</Text>
          {record.lastUsedAt && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Last: {dayjs(record.lastUsedAt).fromNow()}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Expires",
      dataIndex: "expiresAt",
      key: "expiresAt",
      width: 140,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (date: string | null) => {
        if (!date) return <Text type="secondary">Never</Text>;
        const isExpired = dayjs(date).isBefore(dayjs());
        return (
          <Text type={isExpired ? "danger" : "secondary"}>
            {dayjs(date).format("YYYY-MM-DD")}
          </Text>
        );
      },
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).format("YYYY-MM-DD")}</Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: isMobile ? 80 : 120,
      fixed: "right" as const,
      render: (_: any, record: ApiKey) => (
        <Space size="small">
          <Popconfirm
            title="Delete API key"
            description="Are you sure you want to delete this API key? This action cannot be undone."
            onConfirm={() => handleDeleteKey(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} danger size="small">
              {!isMobile && "Delete"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "API Keys" },
  ];

  return (
    <PageContainer>
      <GlassCard intensity="light">
        <Space direction="vertical" size={isMobile ? "middle" : "large"} style={{ width: "100%" }}>
          <PageHeader
            title="API Keys"
            description="Manage your API keys for programmatic access"
            breadcrumbs={breadcrumbItems}
            actions={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                {!isMobile && "Create API Key"}
              </Button>
            }
          />

          <Alert
            message="API Keys"
            description="API keys allow you to authenticate with the IoTDB Enhanced API programmatically. Keep them secure and never share them publicly."
            type="info"
            showIcon
          />

          {/* Statistics Cards */}
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 16 : 24 }}>
            <Col xs={12} sm={8}>
              <StatCard
                title="Total Keys"
                value={totalKeys}
                icon={<KeyOutlined />}
                variant="primary"
              />
            </Col>
            <Col xs={12} sm={8}>
              <StatCard
                title="Active Keys"
                value={activeKeys}
                icon={<CheckCircleOutlined />}
                variant="success"
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                title="Total Usage"
                value={totalUsage.toLocaleString()}
                icon={<ClockCircleOutlined />}
                variant="default"
              />
            </Col>
          </Row>

          <DataTable
            columns={columns}
            dataSource={apiKeys}
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
        </Space>
      </GlassCard>

      {/* Create API Key Modal */}
      <Modal
        title="Create New API Key"
        open={createModalVisible}
        onOk={handleCreateKey}
        onCancel={() => {
          setCreateModalVisible(false);
          setNewKeyName("");
          setExpiryDays(null);
        }}
        okText="Create"
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Space>
              <Text strong>Name</Text>
              <Text type="secondary">
                (Required)
              </Text>
            </Space>
            <Input
              placeholder="e.g., Production App Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>

          <div>
            <Text strong>Expiration</Text>
            <Input
              type="number"
              placeholder="Enter number of days (optional)"
              value={expiryDays ?? ""}
              onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : null)}
              style={{ marginTop: 8 }}
              suffix="days"
            />
          </div>

          <Alert
            message="Important"
            description="After creating the API key, you will only be able to see it once. Make sure to save it in a secure location."
            type="warning"
            showIcon
          />
        </Space>
      </Modal>

      {/* Created Key Display Modal */}
      <Modal
        title="API Key Created"
        open={!!createdKey}
        onOk={() => setCreatedKey(null)}
        onCancel={() => setCreatedKey(null)}
        okText="I've saved my key"
        width={600}
        footer={[
          <Button key="close" type="primary" onClick={() => setCreatedKey(null)}>
            I've saved my key
          </Button>,
        ]}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Alert
            message="Save this API key now!"
            description="You won&apos;t be able to see it again once you close this modal."
            type="warning"
            showIcon
          />

          <div>
            <Text strong>Your API Key:</Text>
            <Input.Password
              value={createdKey?.apiKey}
              readOnly
              style={{ marginTop: 8, fontFamily: "monospace", fontSize: 13 }}
              visibilityToggle
            />
          </div>

          <div>
            <Text type="secondary">
              <strong>Name:</strong> {createdKey?.name}
            </Text>
            <br />
            <Text type="secondary">
              <strong>Created:</strong>{" "}
              {createdKey?.createdAt && dayjs(createdKey.createdAt).format("YYYY-MM-DD HH:mm:ss")}
            </Text>
            {createdKey?.expiresAt && (
              <>
                <br />
                <Text type="secondary">
                  <strong>Expires:</strong> {dayjs(createdKey.expiresAt).format("YYYY-MM-DD HH:mm:ss")}
                </Text>
              </>
            )}
          </div>
        </Space>
      </Modal>
    </PageContainer>
  );
}
