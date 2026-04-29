"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOne, useList, updateRecord } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft } from "lucide-react";

const SEVERITY_LEVELS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const DETECTION_METHODS = [
  { value: "statistical", label: "Statistical (Z-Score)" },
  { value: "iqr", label: "Interquartile Range (IQR)" },
  { value: "isolation_forest", label: "Isolation Forest" },
  { value: "lstm", label: "LSTM Autoencoder" },
  { value: "manual", label: "Manual Entry" },
];

interface AnomalyEditPageProps {
  params: Promise<{ id: string }>;
}

export default function AnomalyEditPage({ params }: AnomalyEditPageProps) {
  const { id } = React.use(params);
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Form state
  const [severity, setSeverity] = useState("");
  const [detectionMethod, setDetectionMethod] = useState("");
  const [value, setValue] = useState("");
  const [expectedRangeMin, setExpectedRangeMin] = useState("");
  const [expectedRangeMax, setExpectedRangeMax] = useState("");
  const [notes, setNotes] = useState("");

  // Get anomaly data
  const { data: anomaly, loading: isLoadingAnomaly } = useOne<any>("anomalies", id);

  // Get timeseries list (for display)
  const { data: timeseriesList } = useList<any>("timeseries", {
    pageSize: 1000,
    sort: "name",
    order: "asc",
  });

  // Populate form when anomaly data loads
  useEffect(() => {
    if (anomaly) {
      setSeverity(anomaly.severity || "");
      setDetectionMethod(anomaly.detectionMethod || "");
      setValue(anomaly.value != null ? String(anomaly.value) : "");
      setExpectedRangeMin(anomaly.minExpected != null ? String(anomaly.minExpected) : "");
      setExpectedRangeMax(anomaly.maxExpected != null ? String(anomaly.maxExpected) : "");
      setNotes(anomaly.notes || "");
    }
  }, [anomaly]);

  // Find timeseries name for display
  const timeseriesName = (timeseriesList || []).find(
    (ts: any) => ts.id === anomaly?.timeseriesId
  )?.name || anomaly?.timeseriesId || "-";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateRecord("anomalies", id, {
        severity,
        notes,
      });

      toast.showSuccess(
        "Anomaly Updated Successfully",
        "The anomaly record has been updated."
      );

      setTimeout(() => {
        router.push("/anomalies");
      }, 1000);
    } catch (error: any) {
      toast.showError("Failed to Update Anomaly", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAnomaly) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="mx-auto max-w-225">
          <Alert variant="info">Loading anomaly data...</Alert>
        </div>
      </div>
    );
  }

  if (!anomaly) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="mx-auto max-w-225">
          <Alert variant="error">Anomaly not found</Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="mx-auto max-w-225">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Edit Anomaly Record
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Editing anomaly {id.slice(0, 8)}...
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push("/anomalies")}
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Anomalies
          </Button>
        </div>

        <Alert variant="info" title="Read-Only Fields" className="mb-6">
          Some fields like detection time and initial values cannot be modified.
        </Alert>

        {/* Form Card */}
        <div className="bg-card rounded-lg shadow-sm border">
          {/* Card header */}
          <div className="px-6 py-4 border-b border">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-900 inline-block" />
              <h2 className="text-lg font-semibold text-foreground">
                Anomaly Details
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Update the anomaly information
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Time Series - Read Only */}
            <Input
              label="Time Series"
              value={timeseriesName}
              disabled
              fullWidth
            />

            {/* Severity & Detection Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                label="Severity Level"
                options={SEVERITY_LEVELS}
                value={severity}
                onChange={setSeverity}
                fullWidth
              />
              <Select
                label="Detection Method"
                options={DETECTION_METHODS}
                value={detectionMethod}
                onChange={setDetectionMethod}
                disabled
                fullWidth
              />
            </div>

            <hr className="border" />

            {/* Value Information - Read Only */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Anomalous Value"
                type="text"
                value={value}
                disabled
                fullWidth
              />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Expected Range
                </label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Min"
                    value={expectedRangeMin}
                    disabled
                    fullWidth
                  />
                  <Input
                    type="text"
                    placeholder="Max"
                    value={expectedRangeMax}
                    disabled
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* Notes - Editable */}
            <Textarea
              label="Notes"
              rows={4}
              placeholder="Add notes or investigation results..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
            />

            <hr className="border" />

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={loading}
            >
              Update Anomaly Record
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
