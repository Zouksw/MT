"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  Space,
  Table,
  Tag,
  Popconfirm,
  message,
  Alert,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  DeleteOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

interface Session {
  id: string;
  ipAddress: string;
  userAgent?: string;
  isActive: boolean;
  createdAt: string;
  lastSeen: string;
  isCurrent: boolean;
}

// Mock sessions data (in production, fetch from backend)
const mockSessions: Session[] = [
  {
    id: "1",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    isActive: true,
    createdAt: "2024-02-26T10:00:00Z",
    lastSeen: new Date().toISOString(),
    isCurrent: true,
  },
  {
    id: "2",
    ipAddress: "192.168.1.101",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    isActive: true,
    createdAt: "2024-02-25T14:30:00Z",
    lastSeen: "2024-02-26T08:00:00Z",
    isCurrent: false,
  },
  {
    id: "3",
    ipAddress: "192.168.1.102",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
    isActive: false,
    createdAt: "2024-02-24T09:15:00Z",
    lastSeen: "2024-02-26T07:30:00Z",
    isCurrent: false,
  },
];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
};

export default function SessionsSettingsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from backend
      // const response = await authFetch("/api/auth/sessions");
      // const data = await response.json();

      // Using mock data for now
      setTimeout(() => {
        setSessions(mockSessions);
        setLoading(false);
      }, 500);
    } catch {
      message.error("Failed to load sessions");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      // In production, call backend to revoke session
      // await authFetch(`/api/auth/sessions/${sessionId}`, { method: "DELETE" });

      // Optimistic update
      setSessions(sessions.map(s =>
        s.id === sessionId ? { ...s, isActive: false } : s
      ));
      message.success("Session revoked successfully");
    } catch {
      message.error("Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      // In production, call backend
      // await authFetch("/api/auth/sessions/revoke-others", { method: "POST" });

      // Optimistic update
      setSessions(sessions.map(s =>
        s.isCurrent ? s : { ...s, isActive: false }
      ));
      message.success("All other sessions revoked successfully");
    } catch {
      message.error("Failed to revoke sessions");
    }
  };

  const activeSessions = sessions.filter(s => s.isActive);
  // Current session identified by isCurrent flag
  sessions.find(s => s.isCurrent);

  const columns: ColumnsType<Session> = [
    {
      title: "IP Address",
      dataIndex: "ipAddress",
      key: "ipAddress",
      render: (ip) => <code>{ip}</code>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "status",
      render: (isActive, record) => (
        <Space>
          {record.isCurrent ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Current
            </Tag>
          ) : isActive ? (
            <Tag color="blue">Active</Tag>
          ) : (
            <Tag color="default">Revoked</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => formatDate(date),
    },
    {
      title: "Last Active",
      dataIndex: "lastSeen",
      key: "lastSeen",
      render: (date) => formatDate(date),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        !record.isCurrent && record.isActive ? (
          <Popconfirm
            title="Revoke Session"
            description="Are you sure you want to revoke this session?"
            onConfirm={() => handleRevokeSession(record.id)}
            okText="Revoke"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={revoking === record.id}
              size="small"
            >
              Revoke
            </Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Active Sessions"
        description="View and manage your login sessions"
      />

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Active Sessions"
              value={activeSessions.length}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Total Sessions"
              value={sessions.length}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Alert
        message="For your security, review your active sessions and revoke any you don't recognize."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        closable
      />

      <ContentCard
        title="Active Sessions"
        actions={
          activeSessions.length > 1 ? (
            <Popconfirm
              title="Revoke All Other Sessions"
              description="This will log out all devices except your current one. Are you sure?"
              onConfirm={handleRevokeAllOthers}
              okText="Revoke All"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<ExclamationCircleOutlined />}>
                Revoke All Others
              </Button>
            </Popconfirm>
          ) : null
        }
      >
        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          loading={loading}
          pagination={false}
          rowClassName={(record) => record.isCurrent ? "current-session-row" : ""}
          style={{ overflow: "auto" }}
        />
      </ContentCard>

      <style dangerouslySetInnerHTML={{ __html: `
        .current-session-row {
          background-color: rgba(82, 196, 26, 0.05) !important;
        }
        .current-session-row:hover td {
          background-color: rgba(82, 196, 26, 0.1) !important;
        }
      `}} />
    </PageContainer>
  );
}
