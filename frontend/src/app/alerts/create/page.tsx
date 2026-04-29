"use client";

import { useState, } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useList } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/lib/responsive-utils";

import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { tokenManager } from "@/lib/tokenManager";

const ALERT_TYPES = [
  { value: "ANOMALY", label: "Anomaly Detection - Alerts when anomalies are detected" },
  { value: "FORECAST_READY", label: "Forecast Ready - Alerts when forecast results are available" },
  { value: "SYSTEM", label: "System Event - System-level notifications" },
  { value: "THRESHOLD", label: "Threshold Breach - Alerts when values exceed thresholds" },
];

const SEVERITY_LEVELS = [
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
  { value: "ERROR", label: "Error" },
];

const OPERATOR_OPTIONS = [
  { value: ">", label: "Greater than" },
  { value: "<", label: "Less than" },
  { value: ">=", label: "Greater or equal" },
  { value: "<=", label: "Less or equal" },
];

export default function AlertCreate() {
  const router = useRouter();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("INFO");
  const [timeseriesId, setTimeseriesId] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [conditionOperator, setConditionOperator] = useState(">");
  const [conditionValue, setConditionValue] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState("5");

  // Get timeseries list
  const { data: timeseriesList } = useList<{ id: string; name: string; unit?: string }>("timeseries", {
    pageSize: 1000,
    sort: "name",
    order: "asc",
  });

  const timeseriesOptions = timeseriesList.map((ts: { id: string; name: string; unit?: string }) => ({
    value: ts.id,
    label: ts.unit ? `${ts.name} (${ts.unit})` : ts.name,
  }));

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Alert name is required";
    } else if (name.trim().length < 3) {
      errors.name = "Alert name must be at least 3 characters";
    } else if (name.length > 100) {
      errors.name = "Alert name must be at most 100 characters";
    }

    if (!type) {
      errors.type = "Please select alert type";
    }

    if (!severity) {
      errors.severity = "Please select severity";
    }

    if (!timeseriesId) {
      errors.timeseriesId = "Please select a time series";
    }

    if (type === "THRESHOLD" && conditionValue && Number.isNaN(Number(conditionValue))) {
      errors.conditionValue = "Threshold value must be a number";
    }

    if (description.length > 1000) {
      errors.description = "Description must be at most 1000 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const sanitizedValues = {
        name: sanitizer.sanitizeString(name, 100),
        type,
        severity,
        timeseriesId,
        condition: type === "THRESHOLD"
          ? {
              operator: sanitizer.sanitizeString(conditionOperator, 10),
              value: sanitizer.sanitizeNumber(Number(conditionValue), -Infinity, Infinity),
            }
          : undefined,
        cooldownMinutes: sanitizer.sanitizeNumber(Number(cooldownMinutes), 0, 10080),
        description: sanitizer.sanitizeString(description, 1000),
        enabled,
      };

      const token = tokenManager.getToken();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(sanitizedValues),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create alert");
      }

      toast.showSuccess("Alert Created Successfully", "The alert has been configured.");

      setTimeout(() => {
        router.push("/alerts");
      }, 1000);
    } catch (error: unknown) {
      const safeError = errorHandler.handleApiError(error);
      toast.showError("Failed to Create Alert", safeError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <a href="/" className="hover:text-gray-700 dark:hover:text-gray-200">Home</a>
          <ChevronRight className="size-3" />
          <a href="/alerts" className="hover:text-gray-700 dark:hover:text-gray-200">Alerts & Notifications</a>
          <ChevronRight className="size-3" />
          <span className="text-foreground">Create Alert</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Create Alert</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure a new alert for monitoring your time series data</p>
          </div>
          <Button variant="ghost" onClick={() => router.push("/alerts")}>
            <ArrowLeft className="size-4 mr-1.5" />
            {!isMobile && "Back to Alerts"}
          </Button>
        </div>

        {/* Info Banner */}
        <div className="mb-6">
          <Alert variant="info">
            Configure alerts to notify you when specific events occur in your time series data. Alerts can be sent via email, webhook, or viewed in the alerts dashboard.
          </Alert>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">Alert Details</h3>
            <p className="text-sm text-muted-foreground">Configure alert settings</p>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Alert Name */}
              <Input
                label="Alert Name"
                placeholder="e.g., High Temperature Alert"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                error={formErrors.name}
                fullWidth
              />

              {/* Alert Type and Severity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Alert Type"
                  placeholder="Select alert type"
                  value={type}
                  onChange={setType}
                  options={ALERT_TYPES}
                  error={formErrors.type}
                />
                <Select
                  label="Severity Level"
                  placeholder="Select severity"
                  value={severity}
                  onChange={setSeverity}
                  options={SEVERITY_LEVELS}
                  error={formErrors.severity}
                />
              </div>

              {/* Time Series Selection */}
              <Select
                label="Time Series"
                placeholder="Select a time series"
                value={timeseriesId}
                onChange={setTimeseriesId}
                options={timeseriesOptions}
                error={formErrors.timeseriesId}
              />

              <hr className="border" />

              {/* Threshold Configuration (for THRESHOLD type) */}
              {type === "THRESHOLD" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="Operator"
                    value={conditionOperator}
                    onChange={setConditionOperator}
                    options={OPERATOR_OPTIONS}
                  />
                  <Input
                    label="Threshold Value"
                    placeholder="e.g., 100"
                    type="number"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    error={formErrors.conditionValue}
                    fullWidth
                  />
                  <Input
                    label="Cooldown (minutes)"
                    type="number"
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(e.target.value)}
                    helperText="Minimum time between alert notifications"
                    fullWidth
                  />
                </div>
              )}

              {/* Description */}
              <Textarea
                label="Description"
                placeholder="Describe what this alert monitors and when it should trigger..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                error={formErrors.description}
                fullWidth
                rows={3}
              />

              {/* Enable/Disable */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
                <span className="text-sm font-medium text-foreground">
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <hr className="border" />

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={loading}
              >
                Create Alert
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
