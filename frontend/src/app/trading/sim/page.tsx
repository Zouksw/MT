"use client";

import React, { useState } from "react";
import {
  ConfigProvider,
  Card,
  Button,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Modal,
  Form,
  InputNumber,
  Select,
  Space,
  Spin,
  Empty,
  message,
} from "antd";
import {
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useSimAccounts, useSimAccount } from "@/lib/simulation";

export default function SimulationPage() {
  const { accounts, loading, mutate } = useSimAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = async (values: { name: string; initialBalance: number }) => {
    const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${base}/api/sim/accounts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...values, initialBalance: 0 }),
    });

    if (res.ok) {
      message.success("Account created");
      setCreateOpen(false);
      mutate();
    } else {
      message.error("Failed to create account");
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#F59E0B",
          colorPrimaryBg: "#FEF3C7",
          colorPrimaryBgHover: "#FDE68A",
        },
      }}
    >
      <PageContainer>
        <PageHeader
          title="Prediction Backtest"
          description="Verify AI prediction accuracy against historical price movements"
          actions={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              New Backtest
            </Button>
          }
        />

        {loading ? (
          <Spin />
        ) : accounts.length === 0 ? (
          <Card>
            <Empty description="No backtest accounts yet. Create one to start verifying predictions!">
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                Create Backtest
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {/* Account cards */}
            <Col xs={24} lg={8}>
              <div className="space-y-3">
                {accounts.map((a) => (
                  <Card
                    key={a.id}
                    hoverable
                    className={selectedId === a.id ? "ring-2 ring-amber-400" : ""}
                    onClick={() => setSelectedId(a.id)}
                    size="small"
                  >
                    <div className="font-medium mb-2">{a.name}</div>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Statistic
                          title="Predictions"
                          value={a.tradeCount}
                          valueStyle={{ fontSize: 14 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="Score"
                          value={a.pnl}
                          precision={2}
                          valueStyle={{
                            fontSize: 14,
                            color: a.pnl >= 0 ? "#22c55e" : "#ef4444",
                          }}
                          prefix={a.pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        />
                      </Col>
                    </Row>
                    <div className="mt-2 text-xs text-gray-400">
                      {a.tradeCount} predictions · {a.orderCount} entries
                    </div>
                  </Card>
                ))}
              </div>
            </Col>

            {/* Account detail */}
            <Col xs={24} lg={16}>
              {selectedId ? (
                <AccountDetail accountId={selectedId} />
              ) : (
                <Card>
                  <Empty description="Select an account" />
                </Card>
              )}
            </Col>
          </Row>
        )}

        <Modal
          title="Create Backtest Account"
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          footer={null}
        >
          <Form onFinish={handleCreate} layout="vertical">
            <Form.Item name="name" label="Account Name" rules={[{ required: true }]}>
              <input className="w-full border rounded px-3 py-2" placeholder="My Backtest" />
            </Form.Item>
            <Form.Item name="initialBalance" initialValue={0} hidden><input /></Form.Item>
            <Button type="primary" htmlType="submit" block>
              Create
            </Button>
          </Form>
        </Modal>
      </PageContainer>
    </ConfigProvider>
  );
}

function AccountDetail({ accountId }: { accountId: string }) {
  const { account, loading } = useSimAccount(accountId);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  if (loading || !account) return <Spin />;

  const tradeColumns = [
    {
      title: "Commodity",
      dataIndex: ["commodity", "name"],
      key: "commodity",
    },
    {
      title: "Side",
      dataIndex: "side",
      key: "side",
      render: (side: string) => (
        <Tag color={side === "BUY" ? "green" : "red"}>{side}</Tag>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "Entry",
      dataIndex: "entryPrice",
      key: "entry",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "Result",
      dataIndex: "realizedPnl",
      key: "pnl",
      render: (v: number | null) =>
        v != null ? (
          <Tag color={v >= 0 ? "green" : "red"}>
            {v >= 0 ? "Correct" : "Incorrect"}
          </Tag>
        ) : (
          <Tag color="blue">Pending</Tag>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card size="small">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Predictions" value={account.openTradeCount + account.pendingOrderCount} />
          </Col>
          <Col span={6}>
            <Statistic
              title="Score"
              value={account.totalPnl}
              precision={2}
              valueStyle={{ color: account.totalPnl >= 0 ? "#22c55e" : "#ef4444" }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="Open Predictions" value={account.openTradeCount} />
          </Col>
          <Col span={6}>
            <Space direction="vertical" align="end">
              <Button icon={<ThunderboltOutlined />} onClick={() => setOrderModalOpen(true)}>
                Enter Prediction
              </Button>
              <span className="text-xs text-gray-400">{account.pendingOrderCount} pending</span>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="Recent Predictions" size="small">
        {account.recentTrades.length === 0 ? (
          <Empty description="No predictions yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={account.recentTrades}
            columns={tradeColumns}
            rowKey="id"
            size="small"
            pagination={false}
          />
        )}
      </Card>

      <OrderModal
        accountId={accountId}
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
      />
    </div>
  );
}

function OrderModal({
  accountId,
  open,
  onClose,
}: {
  accountId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: { commodityId: string; side: string; type: string; quantity: number }) => {
    setSubmitting(true);
    try {
      const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${base}/api/sim/accounts/${accountId}/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success("Prediction entered");
        onClose();
        form.resetFields();
      } else {
        const data = await res.json();
        message.error(data.error?.message || "Failed to enter prediction");
      }
    } catch {
      message.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New Prediction" open={open} onCancel={onClose} footer={null}>
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item name="commodityId" label="Commodity" rules={[{ required: true }]}>
          <Select placeholder="Select commodity" />
        </Form.Item>
        <Form.Item name="side" label="Direction" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="BUY">Predict Up</Select.Option>
            <Select.Option value="SELL">Predict Down</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
          <InputNumber min={0.01} className="w-full" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          Enter Prediction
        </Button>
      </Form>
    </Modal>
  );
}
