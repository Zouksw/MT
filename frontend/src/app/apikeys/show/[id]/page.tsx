/**
 * API Key Detail Page
 *
 * Displays detailed information about a specific API key including:
 * - API key metadata (name, permissions, scopes)
 * - Usage statistics and rate limits
 * - Activity log
 * - Security settings (IP whitelist, expiration)
 */

"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Row,
  Col,
  Statistic,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Descriptions,
  Alert,
  Input,
  message,
  Popconfirm,
  Progress,
} from "antd";
import {
  KeyOutlined,
  CopyOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  SecurityScanOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Breakpoint } from "antd";
import type { ApiKey } from "@/types/api";
import { authFetch } from "@/utils/auth";
import { DetailPageLayout, DetailSection } from "@/components/layout/DetailPageLayout";
import { useIsMobile } from "@/lib/responsive-utils";

interface ApiKeyDetailParams {
  id?: string;
}

interface ApiKeyWithDetails extends Omit<ApiKey, 'permissions' | 'lastUsed' | 'expiresAt'> {
  lastUsed?: string;
  usageCount?: number;
  rateLimit?: {
    limit: number;
    remaining: number;
    window: string;
  };
  permissions?: string[];
  ipWhitelist?: string[];
  expiresAt?: string;
  keyPreview?: string; // Only show first 8 and last 4 characters
}

interface ApiUsageLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  ip: string;
}

export default function ApiKeyDetailPage() {
  const params = useParams() as ApiKeyDetailParams;
  const router = useRouter();
  const [apiKey, setApiKey] = useState<ApiKeyWithDetails | null>(null);
  const [usageLogs, setUsageLogs] = useState<ApiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchApiKey();
    fetchUsageLogs();
  }, [params.id]);

  const fetchApiKey = async () => {
    if (!params.id) {
      setError("API Key ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch(`/api/apikeys/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch API key");
      }
      const data = await response.json();
      setApiKey({
        ...(data.data || data),
        // Create key preview (first 8 and last 4 characters)
        keyPreview: `${(data.data || data).key?.substring(0, 8)}${(data.data || data).key?.slice(-4)}`
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageLogs = async () => {
    if (!params.id) return;

    try {
      const response = await authFetch(`/api/apikeys/${params.id}/usage`);
      if (response.ok) {
        const data = await response.json();
        setUsageLogs(data.data || data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch usage logs:", err);
    }
  };

  const handleCopyKey = () => {
    if (apiKey?.key) {
      navigator.clipboard.writeText(apiKey.key);
      message.success("API key copied to clipboard");
    }
  };

  const handleRegenerate = async () => {
    // TODO: Implement regenerate functionality
    message.info("Key regeneration will be implemented");
  };

  const handleRevoke = async () => {
    if (!params.id) {
      message.error("API Key ID is required");
      return;
    }

    try {
      const response = await authFetch(`/api/apikeys/${params.id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        message.success("API key revoked successfully");
        router.push("/apikeys");
      }
    } catch (err) {
      message.error("Failed to revoke API key");
    }
  };

  if (loading) {
    return (
      <DetailPageLayout
        title="API Key Details"
        loading={loading}
      />
    );
  }

  if (error || !apiKey) {
    return (
      <DetailPageLayout
        title="API Key"
        error={error || "API key not found"}
      />
    );
  }

  const breadcrumb = [
    { label: "API Keys", href: "/apikeys" },
    { label: apiKey.name || "API Key" }
  ];

  const actions = [
    {
      icon: <CopyOutlined />,
      label: "Copy Key",
      onClick: handleCopyKey
    },
    {
      icon: <ReloadOutlined />,
      label: "Regenerate",
      onClick: handleRegenerate
    },
    {
      icon: <EditOutlined />,
      label: "Edit",
      href: `/apikeys/edit/${apiKey.id}`
    },
    {
      icon: <DeleteOutlined />,
      label: "Revoke",
      danger: true,
      onClick: () => {
        // Show confirmation for revoke action
      }
    }
  ];

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();

  return (
    <DetailPageLayout
      title={apiKey.name}
      subtitle={`Created ${new Date(apiKey.createdAt).toLocaleString()}`}
      breadcrumb={breadcrumb}
      actions={actions}
    >
      {isExpired && (
        <Alert
          message="This API key has expired"
          description="Please regenerate or create a new API key to continue using the API"
          type="error"
          showIcon
          closable
          style={{ marginBottom: "24px" }}
        />
      )}

      {/* Key Information Card */}
      <DetailSection title="API Key Information" colSpan={isMobile ? 24 : 12}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Key Name">
              <span className="font-semibold text-gray-900 dark:text-gray-50">{apiKey.name}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Key Preview">
              <Space>
                <code className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">{apiKey.keyPreview}</code>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopyKey}
                >
                  Copy
                </Button>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={isExpired ? "error" : "success"}>
                {isExpired ? "Expired" : "Active"}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          <Statistic
            title="Total Usage"
            value={apiKey.usageCount || 0}
            prefix={<KeyOutlined />}
            suffix="requests"
          />

          {apiKey.lastUsed && (
            <div>
              <span className="text-body-sm text-gray-500 dark:text-gray-400">Last used: </span>
              <span className="text-body text-gray-900 dark:text-gray-50">{new Date(apiKey.lastUsed).toLocaleString()}</span>
            </div>
          )}
        </Space>
      </DetailSection>

      {/* Rate Limit Card */}
      {apiKey.rateLimit && (
        <DetailSection title="Rate Limit" colSpan={isMobile ? 24 : 12}>
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Progress
              percent={(apiKey.rateLimit.remaining / apiKey.rateLimit.limit) * 100}
              status={apiKey.rateLimit.remaining < apiKey.rateLimit.limit * 0.2 ? "exception" : "active"}
            />
            <span className="text-body-sm text-gray-500 dark:text-gray-400">
              {apiKey.rateLimit.remaining} / {apiKey.rateLimit.limit} requests remaining
              ({apiKey.rateLimit.window})
            </span>
          </Space>
        </DetailSection>
      )}

      {/* Permissions Card */}
      <DetailSection
        title="Permissions"
        colSpan={isMobile ? 24 : 12}
        extra={<Button type="link" href={`/apikeys/edit/${apiKey.id}`}>Edit</Button>}
      >
        {apiKey.permissions && apiKey.permissions.length > 0 ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            {apiKey.permissions.map((permission) => (
              <Tag key={permission} color="blue">
                {permission}
              </Tag>
            ))}
          </Space>
        ) : (
          <span className="text-body-sm text-gray-500 dark:text-gray-400">Full permissions</span>
        )}
      </DetailSection>

      {/* Security Settings Card */}
      <DetailSection
        title="Security Settings"
        colSpan={isMobile ? 24 : 12}
        extra={<SecurityScanOutlined />}
      >
        <Descriptions column={1} size="small">
          {apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 && (
            <Descriptions.Item label="IP Whitelist">
              <Space direction="vertical" style={{ width: "100%" }}>
                {apiKey.ipWhitelist.map((ip, index) => (
                  <Tag key={index} color="green">{ip}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          )}
          {apiKey.expiresAt && (
            <Descriptions.Item label="Expires">
              <span className={isExpired ? "text-error" : "text-body-sm text-gray-500 dark:text-gray-400"}>
                {new Date(apiKey.expiresAt).toLocaleString()}
              </span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </DetailSection>

      {/* Usage Log Table */}
      <DetailSection
        title="Recent Usage"
        colSpan={24}
        extra={<Button type="link" onClick={fetchUsageLogs}>Refresh</Button>}
      >
        {usageLogs.length === 0 ? (
          <Card>
            <span className="text-body text-gray-500 dark:text-gray-400">No usage logs available for this API key.</span>
          </Card>
        ) : (
          <Table
            columns={usageLogColumns}
            dataSource={usageLogs}
            rowKey={(record) => record.id}
            pagination={{ pageSize: 10 }}
            scroll={{ x: "max-content" }}
            size={isMobile ? "small" : "large"}
          />
        )}
      </DetailSection>

      {/* Quick Actions */}
      <DetailSection title="Quick Actions" colSpan={24}>
        <Space wrap>
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyKey}
          >
            Copy API Key
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRegenerate}
          >
            Regenerate Key
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => router.push("/docs/api")}
          >
            View API Docs
          </Button>
        </Space>
      </DetailSection>
    </DetailPageLayout>
  );
}

// Table columns for usage logs
const usageLogColumns: ColumnsType<ApiUsageLog> = [
  {
    title: "Timestamp",
    dataIndex: "timestamp",
    key: "timestamp",
    render: (timestamp) => new Date(timestamp).toLocaleString(),
    sorter: true,
    defaultSortOrder: "descend"
  },
  {
    title: "Endpoint",
    dataIndex: "endpoint",
    key: "endpoint",
    responsive: ["lg"] as Breakpoint[]
  },
  {
    title: "Method",
    dataIndex: "method",
    key: "method",
    width: 80,
    render: (method) => (
      <Tag color={method === "GET" ? "green" : method === "POST" ? "blue" : "orange"}>
        {method}
      </Tag>
    )
  },
  {
    title: "Status",
    dataIndex: "statusCode",
    key: "statusCode",
    width: 100,
    render: (status) => {
      const color = status >= 200 && status < 300 ? "success" :
                     status >= 300 && status < 400 ? "warning" : "error";
      return <Tag color={color}>{status}</Tag>;
    }
  },
  {
    title: "Response Time",
    dataIndex: "responseTime",
    key: "responseTime",
    width: 120,
    render: (time) => `${time}ms`,
    sorter: true
  },
  {
    title: "IP Address",
    dataIndex: "ip",
    key: "ip",
    responsive: ["xl"] as Breakpoint[]
  }
];
