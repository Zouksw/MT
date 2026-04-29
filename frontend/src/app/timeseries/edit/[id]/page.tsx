"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOne, useList, updateRecord } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export default function TimeseriesEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // Fetch the existing record
  const { data: record, loading: recordLoading } = useOne<any>("timeseries", id);

  // Fetch datasets for select
  const { data: datasets } = useList<any>("datasets", { pageSize: 1000 });
  const datasetOptions = datasets.map((ds: any) => ({
    value: ds.id,
    label: ds.name,
  }));

  // Form state
  const [form, setForm] = useState({
    datasetId: "",
    name: "",
    slug: "",
    description: "",
    unit: "",
    colorHex: "#B8860B",
    timezone: "UTC",
    isAnomalyDetectionEnabled: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when record loads
  useEffect(() => {
    if (record) {
      setForm({
        datasetId: record.datasetId || "",
        name: record.name || "",
        slug: record.slug || "",
        description: record.description || "",
        unit: record.unit || "",
        colorHex: record.colorHex || "#B8860B",
        timezone: record.timezone || "UTC",
        isAnomalyDetectionEnabled: record.isAnomalyDetectionEnabled || false,
      });
    }
  }, [record]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      const result = await updateRecord("timeseries", id, form);
      toast.showSuccess("Time series updated");
      router.push(`/timeseries/show/${(result as any).id}`);
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to update time series");
    } finally {
      setSaving(false);
    }
  };

  if (recordLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
      </div>
    );
  }

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
            <span className="text-foreground font-medium">Edit</span>
          </nav>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Edit Time Series
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          <Card>
            <CardBody>
              <div className="space-y-4">
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

                <Input
                  label="Slug"
                  value={form.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                  placeholder="temperature"
                  error={errors.slug}
                  fullWidth
                />

                <Textarea
                  label="Description"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  fullWidth
                />

                <Input
                  label="Unit"
                  value={form.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  placeholder="°C, MB, %"
                  fullWidth
                />

                <div className="w-full">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => handleChange("colorHex", e.target.value)}
                    className="w-24 h-10 rounded-md border border-input cursor-pointer"
                  />
                </div>

                <Input
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  fullWidth
                />

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
                  <span className="text-foreground">Anomaly Detection</span>
                </label>
              </div>
            </CardBody>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={saving}>
              Save Changes
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
