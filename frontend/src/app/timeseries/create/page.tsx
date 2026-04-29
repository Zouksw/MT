"use client";

import { useState, } from "react";
import { useRouter } from "next/navigation";
import { useList, createRecord } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export default function TimeseriesCreate() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    datasetId: "",
    name: "",
    slug: "",
    unit: "",
    description: "",
    colorHex: "#F59E0B",
    timezone: "UTC",
    isAnomalyDetectionEnabled: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch datasets for select
  const { data: datasets } = useList<any>("datasets", { pageSize: 1000 });
  const datasetOptions = datasets.map((ds: any) => ({
    value: ds.id,
    label: ds.name,
  }));

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.datasetId) newErrors.datasetId = "Please select a dataset";
    if (!form.name) newErrors.name = "Please enter a name";
    if (!form.slug) newErrors.slug = "Please enter a slug";
    if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) {
      newErrors.slug = "Only lowercase letters, numbers, and hyphens";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const result = await createRecord("timeseries", form);
      toast.showSuccess("Time series created");
      router.push(`/timeseries/show/${(result as any).id}`);
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to create time series");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-6">
      <div className="mx-auto max-w-[1440px]">
        {/* Header */}
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <a href="/" className="hover:text-gray-700 dark:hover:text-gray-200">Home</a>
            <span>/</span>
            <a href="/timeseries" className="hover:text-gray-700 dark:hover:text-gray-200">Time Series</a>
            <span>/</span>
            <span className="text-foreground font-medium">Create</span>
          </nav>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Create Time Series
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure the basic properties of your time series
              </p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Dataset"
                  options={datasetOptions}
                  value={form.datasetId}
                  onChange={(v) => handleChange("datasetId", v)}
                  placeholder="Select dataset"
                  error={errors.datasetId}
                  fullWidth
                />
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Temperature"
                  error={errors.name}
                  fullWidth
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input
                  label="Slug"
                  value={form.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                  placeholder="temperature"
                  error={errors.slug}
                  helperText="Only lowercase letters, numbers, and hyphens"
                  fullWidth
                />
                <Input
                  label="Unit"
                  value={form.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  placeholder="°C, MB, %"
                  helperText="The unit of measurement for this time series"
                  fullWidth
                />
              </div>

              <div className="mt-4">
                <Textarea
                  label="Description"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Describe what this time series measures..."
                  rows={3}
                  fullWidth
                />
              </div>
            </CardBody>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how this time series appears in visualizations
              </p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => handleChange("colorHex", e.target.value)}
                    className="w-full h-10 rounded-md border border-input cursor-pointer"
                    title="Color used in charts and visualizations"
                  />
                </div>
                <Input
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  placeholder="UTC"
                  helperText="Timezone for timestamp display"
                  fullWidth
                />
              </div>
            </CardBody>
          </Card>

          {/* Advanced Options */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Options</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure additional features for this time series
              </p>
            </CardHeader>
            <CardBody>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isAnomalyDetectionEnabled}
                  onClick={() => handleChange("isAnomalyDetectionEnabled", !form.isAnomalyDetectionEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isAnomalyDetectionEnabled
                      ? "bg-primary"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.isAnomalyDetectionEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="font-semibold text-foreground">
                  Anomaly Detection
                </span>
              </label>
              <p className="mt-2 text-sm text-muted-foreground">
                When enabled, the system will automatically analyze this time series for anomalies using machine learning algorithms.
              </p>
            </CardBody>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={saving}>
              Create Time Series
            </Button>
            <Button variant="ghost" onClick={() => router.push("/timeseries")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
