"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { authFetch, getAuthToken, setCachedUser } from "@/utils/auth";
import { User } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt: string;
  _count: { datasets: number; models: number; ownedOrganizations: number };
}

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const _router = useRouter();

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch profile");
      const data = await response.json();
      setUser(data.user);
      setCachedUser(data.user);
      setName(data.user.name || "");
      setAvatarUrl(data.user.avatarUrl || "");
    } catch {
      toast.showError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [toast.showError]);

  useEffect(() => { fetchUserProfile(); }, [fetchUserProfile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }
    setSaving(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, avatarUrl: avatarUrl || undefined }),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      const data = await response.json();
      setUser(data.user);
      setCachedUser(data.user);
      toast.showSuccess("Profile updated successfully");
    } catch {
      toast.showError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Current password is required";
    if (!newPassword || newPassword.length < 8) errs.newPassword = "Must be at least 8 characters";
    if (newPassword !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setChangingPassword(true);
    try {
      const token = getAuthToken();
      const response = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }
      toast.showSuccess("Password changed successfully. Please login again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Profile Settings" description="Manage your personal information and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <div>
          <div className="bg-card border rounded-xl p-6">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full border-3 border-primary flex items-center justify-center bg-muted overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="size-10 text-gray-400" />
                )}
              </div>
              <h4 className="text-lg font-semibold text-foreground mt-4 mb-0.5">{user?.name || "User"}</h4>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">Role: {user?.role}</p>
            </div>

            <hr className="my-4 border" />

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-semibold text-primary">{user?._count.datasets || 0}</div>
                <div className="text-xs text-gray-500">Datasets</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-green-500">{user?._count.models || 0}</div>
                <div className="text-xs text-gray-500">Models</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-purple-500">{user?._count.ownedOrganizations || 0}</div>
                <div className="text-xs text-gray-500">Orgs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="lg:col-span-2 space-y-6">
          <ContentCard title="Edit Profile">
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <Input label="Display Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} fullWidth />
              <Input label="Email Address" value={user?.email || ""} disabled fullWidth />
              <Input label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://your-avatar-url.com/image.png" fullWidth />
              <Button type="submit" variant="primary" isLoading={saving}>Save Changes</Button>
            </form>
          </ContentCard>

          <ContentCard title="Change Password">
            <Alert variant="info" className="mb-4">
              After changing your password, you will need to login again on all devices.
            </Alert>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={errors.currentPassword} fullWidth />
              <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={errors.newPassword} placeholder="Min. 8 characters" fullWidth />
              <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} fullWidth />
              <Button type="submit" variant="danger" isLoading={changingPassword}>Change Password</Button>
            </form>
          </ContentCard>

          <ContentCard title="Account Information">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-gray-500 mb-1">User ID</div>
                <div className="text-sm font-mono">{user?.id}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Role</div>
                <div className="text-sm">{user?.role}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Account Created</div>
                <div className="text-sm">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Last Login</div>
                <div className="text-sm">{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "N/A"}</div>
              </div>
            </div>
          </ContentCard>
        </div>
      </div>
    </PageContainer>
  );
}
