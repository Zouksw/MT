"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface NotificationPreferences {
  email: { enabled: boolean; alerts: boolean; anomalies: boolean; forecasts: boolean };
}

const defaultPreferences: NotificationPreferences = {
  email: { enabled: true, alerts: true, anomalies: true, forecasts: false },
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const loadPreferences = useCallback(() => {
    const saved = localStorage.getItem("notificationPreferences");
    if (saved) {
      try { setPreferences(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem("notificationPreferences", JSON.stringify(preferences));
      toast.showSuccess("Notification preferences saved successfully");
    } catch {
      toast.showError("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const updateEmail = (key: keyof NotificationPreferences["email"], value: boolean) => {
    setPreferences((prev) => ({ ...prev, email: { ...prev.email, [key]: value } }));
  };

  return (
    <PageContainer>
      <PageHeader title="Notification Settings" description="Configure how you receive alerts and notifications" />

      <Alert variant="info" className="mb-4">Notification preferences are saved to your browser.</Alert>
      <Alert variant="info" className="mb-6">Email Notifications — Configure which events you want to be notified about via email.</Alert>

      <ContentCard title="Email Notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Enable Email Notifications</span>
            <Toggle checked={preferences.email.enabled} onChange={(v) => updateEmail("enabled", v)} label="Enable email notifications" />
          </div>

          <hr className="border" />

          <p className="text-sm font-semibold text-foreground">Notification Types:</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Alert Notifications</p>
              <p className="text-xs text-muted-foreground">Receive emails when alerts are triggered</p>
            </div>
            <Toggle checked={preferences.email.alerts} onChange={(v) => updateEmail("alerts", v)} label="Alert notifications" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Anomaly Detection</p>
              <p className="text-xs text-muted-foreground">Get notified when anomalies are detected in your data</p>
            </div>
            <Toggle checked={preferences.email.anomalies} onChange={(v) => updateEmail("anomalies", v)} label="Anomaly detection notifications" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Forecast Results</p>
              <p className="text-xs text-muted-foreground">Receive forecast completion notifications</p>
            </div>
            <Toggle checked={preferences.email.forecasts} onChange={(v) => updateEmail("forecasts", v)} label="Forecast result notifications" />
          </div>
        </div>
      </ContentCard>

      <div className="mt-6 text-center">
        <Button variant="primary" size="lg" onClick={handleSave} isLoading={saving}>Save Preferences</Button>
      </div>
    </PageContainer>
  );
}
