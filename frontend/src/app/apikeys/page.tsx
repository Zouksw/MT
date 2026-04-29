"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, CircleCheck, Clock, Key } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Tag } from "@/components/ui/Tag";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { authFetch } from "@/utils/auth";
import { useIsMobile } from "@/lib/responsive-utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

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

// --- Stat card sub-component ---

function StatBlock({ title, value, icon, colorClass }: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className="bg-card rounded-lg p-4 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px]">
      <div className="flex items-center gap-2 mb-2">
        <span className={colorClass}>{icon}</span>
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <span className={`text-2xl font-semibold data-text ${colorClass}`}>{value}</span>
    </div>
  );
}

const API_BASE = "";

export default function ApiKeyList() {
  const toast = useToast();
  const isMobile = useIsMobile();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateResponse | null>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/api-keys`);
      if (!response.ok) throw new Error("Failed to fetch API keys");
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch {
      toast.showError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.showError("Please enter a name for the API key");
      return;
    }

    try {
      const body: Record<string, unknown> = { name: newKeyName };
      if (expiryDays && expiryDays > 0) {
        body.expiresIn = expiryDays * 24 * 60 * 60;
      }

      const response = await authFetch(`${API_BASE}/api/api-keys`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to create API key");

      const data: CreateResponse = await response.json();
      setCreatedKey(data);
      setCreateModalVisible(false);
      setNewKeyName("");
      setExpiryDays(null);
      toast.showSuccess("API key created successfully");
      fetchApiKeys();
    } catch {
      toast.showError("Failed to create API key");
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const response = await authFetch(`${API_BASE}/api/api-keys/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete API key");
      toast.showSuccess("API key deleted");
      fetchApiKeys();
    } catch {
      toast.showError("Failed to delete API key");
    }
  };

  // Calculate statistics
  const totalKeys = apiKeys.length;
  const activeKeys = apiKeys.filter((k) => k.isActive).length;
  const totalUsage = apiKeys.reduce((sum, k) => sum + k.usageCount, 0);

  // Table columns
  const columns = [
    {
      key: "name",
      title: "Name",
      dataIndex: "name" as const,
      width: 200,
      render: (_value: string, record: ApiKey) => (
        <div>
          <div className="font-semibold text-foreground">{record.name}</div>
          <div className="text-xs text-muted-foreground">{record.id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      key: "isActive",
      title: "Status",
      dataIndex: "isActive" as const,
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? "success" : "error"}>
          <span className="inline-flex items-center gap-1">
            {isActive ? <CircleCheck className="size-3" /> : <Clock className="size-3.5" />}
            {isActive ? "Active" : "Inactive"}
          </span>
        </Tag>
      ),
    },
    {
      key: "lastCharacters",
      title: "Last Characters",
      dataIndex: "lastCharacters" as const,
      width: 140,
      render: (lastChars: number) => (
        <code className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono">
          ...{lastChars.toString(16).toUpperCase().padStart(8, "0")}
        </code>
      ),
    },
    {
      key: "usageCount",
      title: "Usage",
      dataIndex: "usageCount" as const,
      width: 140,
      render: (count: number, record: ApiKey) => (
        <div>
          <div>{count} requests</div>
          {record.lastUsedAt && (
            <div className="text-xs text-muted-foreground">
              Last: {dayjs(record.lastUsedAt).fromNow()}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "expiresAt",
      title: "Expires",
      dataIndex: "expiresAt" as const,
      width: 140,
      render: (date: string | null) => {
        if (!date) return <span className="text-muted-foreground">Never</span>;
        const isExpired = dayjs(date).isBefore(dayjs());
        return (
          <span className={isExpired ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
            {dayjs(date).format("YYYY-MM-DD")}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      title: "Created",
      dataIndex: "createdAt" as const,
      width: 120,
      render: (date: string) => (
        <span className="text-muted-foreground">{dayjs(date).format("YYYY-MM-DD")}</span>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      width: isMobile ? 80 : 120,
      render: (_value: unknown, record: ApiKey) => (
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="size-3.5" />}
          onClick={() => {
            if (window.confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
              handleDeleteKey(record.id);
            }
          }}
        >
          {!isMobile && "Delete"}
        </Button>
      ),
    },
  ];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "API Keys" },
  ];

  return (
    <div className="min-h-screen bg-muted p-4 md:p-6">
      <div className="mx-auto max-w-[1440px]">
        <div className="rounded-lg overflow-hidden bg-white dark:bg-gray-900 border border-white/10 dark:border-white/5 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] p-6">
          <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  {breadcrumbItems.map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-muted-foreground">/</span>}
                      {item.href ? (
                        <a href={item.href} className="hover:text-primary">{item.title}</a>
                      ) : (
                        <span>{item.title}</span>
                      )}
                    </span>
                  ))}
                </nav>
                <h1 className="text-2xl font-semibold text-foreground">API Keys</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your API keys for programmatic access</p>
              </div>
              <Button
                variant="primary"
                icon={<Plus className="size-3.5" />}
                onClick={() => setCreateModalVisible(true)}
              >
                {!isMobile && "Create API Key"}
              </Button>
            </div>

            {/* Info alert */}
            <Alert variant="info" title="API Keys">
              API keys allow you to authenticate with the MT API programmatically. Keep them secure and never share them publicly.
            </Alert>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatBlock title="Total Keys" value={totalKeys} icon={<Key className="size-4" />} colorClass="text-primary" />
              <StatBlock title="Active Keys" value={activeKeys} icon={<CircleCheck className="size-3" />} colorClass="text-green-600 dark:text-green-400" />
              <StatBlock title="Total Usage" value={totalUsage.toLocaleString()} icon={<Clock className="size-3.5" />} colorClass="text-foreground" />
            </div>

            {/* Data Table */}
            <Table<ApiKey>
              columns={columns}
              dataSource={apiKeys}
              loading={loading}
              rowKey="id"
              emptyText="No API keys found"
            />
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      <Modal
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setNewKeyName("");
          setExpiryDays(null);
        }}
        title="Create New API Key"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setCreateModalVisible(false);
              setNewKeyName("");
              setExpiryDays(null);
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateKey}>Create</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-foreground">Name</span>
              <span className="text-sm text-muted-foreground">(Required)</span>
            </div>
            <Input
              placeholder="e.g., Production App Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              fullWidth
            />
          </div>

          <div>
            <span className="block font-medium text-foreground mb-2">Expiration</span>
            <div className="relative">
              <Input
                type="number"
                placeholder="Enter number of days (optional)"
                value={expiryDays ?? ""}
                onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value, 10) : null)}
                fullWidth
              />
            </div>
          </div>

          <Alert variant="warning" title="Important">
            After creating the API key, you will only be able to see it once. Make sure to save it in a secure location.
          </Alert>
        </div>
      </Modal>

      {/* Created Key Display Modal */}
      <Modal
        open={!!createdKey}
        onClose={() => setCreatedKey(null)}
        title="API Key Created"
        width="max-w-xl"
        footer={
          <Button variant="primary" onClick={() => setCreatedKey(null)}>
            I&apos;ve saved my key
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <Alert variant="warning" title="Save this API key now!">
            You won&apos;t be able to see it again once you close this modal.
          </Alert>

          <div>
            <span className="block font-medium text-foreground mb-2">Your API Key:</span>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={createdKey?.apiKey || ""}
                readOnly
                className="w-full px-3 py-2 rounded-md font-mono text-sm bg-muted border text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Name:</strong> {createdKey?.name}</p>
            <p>
              <strong>Created:</strong>{" "}
              {createdKey?.createdAt && dayjs(createdKey.createdAt).format("YYYY-MM-DD HH:mm:ss")}
            </p>
            {createdKey?.expiresAt && (
              <p>
                <strong>Expires:</strong> {dayjs(createdKey.expiresAt).format("YYYY-MM-DD HH:mm:ss")}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
