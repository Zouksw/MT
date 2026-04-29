"use client";

import { useState, useEffect, useCallback } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

interface Session {
  id: string;
  ipAddress: string;
  userAgent?: string;
  isActive: boolean;
  createdAt: string;
  lastSeen: string;
  isCurrent: boolean;
}

const mockSessions: Session[] = [
  { id: "1", ipAddress: "192.168.1.100", userAgent: "Mozilla/5.0 (Windows NT 10.0)", isActive: true, createdAt: "2024-02-26T10:00:00Z", lastSeen: new Date().toISOString(), isCurrent: true },
  { id: "2", ipAddress: "192.168.1.101", userAgent: "Mozilla/5.0 (Macintosh)", isActive: true, createdAt: "2024-02-25T14:30:00Z", lastSeen: "2024-02-26T08:00:00Z", isCurrent: false },
  { id: "3", ipAddress: "192.168.1.102", userAgent: "Mozilla/5.0 (iPhone)", isActive: false, createdAt: "2024-02-24T09:15:00Z", lastSeen: "2024-02-26T07:30:00Z", isCurrent: false },
];

const formatDate = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(dateString).toLocaleDateString();
};

export default function SessionsSettingsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [_loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const toast = useToast();

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setTimeout(() => { setSessions(mockSessions); setLoading(false); }, 500);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      setSessions(sessions.map(s => s.id === sessionId ? { ...s, isActive: false } : s));
      toast.showSuccess("Session revoked successfully");
    } catch {
      toast.showError("Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      setSessions(sessions.map(s => s.isCurrent ? s : { ...s, isActive: false }));
      toast.showSuccess("All other sessions revoked successfully");
    } catch {
      toast.showError("Failed to revoke sessions");
    }
  };

  const activeSessions = sessions.filter(s => s.isActive);

  return (
    <PageContainer>
      <PageHeader title="Active Sessions" description="View and manage your login sessions" />

      <Alert variant="info" className="mb-4">
        Session history is stored locally. Connect to the backend API for full session management.
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border rounded-xl p-6">
          <div className="text-sm text-gray-500 mb-1">Active Sessions</div>
          <div className="text-2xl font-semibold text-primary">{activeSessions.length}</div>
        </div>
        <div className="bg-card border rounded-xl p-6">
          <div className="text-sm text-gray-500 mb-1">Total Sessions</div>
          <div className="text-2xl font-semibold text-purple-500">{sessions.length}</div>
        </div>
      </div>

      <Alert variant="info" closable className="mb-6">
        For your security, review your active sessions and revoke any you don&apos;t recognize.
      </Alert>

      <ContentCard
        title="Active Sessions"
        actions={
          activeSessions.length > 1 ? (
            <Button variant="danger" onClick={() => { if (confirm("Revoke all other sessions?")) handleRevokeAllOthers(); }}>
              Revoke All Others
            </Button>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Active</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((s) => (
                <tr key={s.id} className={`hover:bg-accent/50 ${s.isCurrent ? "bg-green-50/50 dark:bg-green-900/10" : ""}`}>
                  <td className="px-4 py-3 text-sm font-mono">{s.ipAddress}</td>
                  <td className="px-4 py-3 text-sm">
                    {s.isCurrent ? <Tag color="success">Current</Tag> : s.isActive ? <Tag color="primary">Active</Tag> : <Tag>Revoked</Tag>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(s.lastSeen)}</td>
                  <td className="px-4 py-3 text-sm">
                    {!s.isCurrent && s.isActive && (
                      <Button variant="danger" size="sm" isLoading={revoking === s.id} onClick={() => { if (confirm("Revoke this session?")) handleRevokeSession(s.id); }}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentCard>
    </PageContainer>
  );
}
