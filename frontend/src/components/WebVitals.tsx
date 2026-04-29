/**
 * Web Vitals Monitoring Component
 *
 * Monitors Core Web Vitals in production:
 * - LCP (Largest Contentful Paint) - target: < 2.5s
 * - FID (First Input Delay) - target: < 100ms
 * - CLS (Cumulative Layout Shift) - target: < 0.1
 *
 * Sends metrics to analytics endpoint for monitoring.
 */

"use client";

import React from "react";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("Web Vital:", metric);
    }

    // Send to backend metrics API for dashboard (both dev and prod)
    sendToAnalytics(metric);

    // Send to Google Analytics if available
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", metric.name, {
        value: Math.round(
          metric.name === "CLS" ? metric.value * 1000 : metric.value
        ),
        event_label: metric.id,
        non_interaction: true,
      });
    }
  });

  return null;
}

/**
 * Send metric to analytics endpoint
 * Persists data to Redis via the backend metrics API for dashboard consumption
 */
async function sendToAnalytics(metric: { name: string; value: number; id: string; delta: number }) {
  // Only send standard web vitals that the backend accepts
  const ALLOWED = ["LCP", "FID", "CLS", "TTFB", "INP"];
  if (!ALLOWED.includes(metric.name)) return;

  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // Send to the backend metrics endpoint (stored in Redis for dashboard)
    await fetch(`${apiBase}/api/metrics/web-vitals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        path: window.location.pathname,
        timestamp: Date.now(),
      }),
    });
  } catch {
    // Silent fail - don't let analytics errors break the app
  }
}

/**
 * Get rating for a metric based on thresholds
 */
function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  switch (name) {
    case "CLS":
      if (value <= 0.1) return "good";
      if (value <= 0.25) return "needs-improvement";
      return "poor";

    case "FID":
      if (value <= 100) return "good";
      if (value <= 300) return "needs-improvement";
      return "poor";

    case "LCP":
    case "FCP":
    case "TTFB":
      if (value <= 2500) return "good";
      if (value <= 4000) return "needs-improvement";
      return "poor";

    default:
      return "good";
  }
}

/**
 * Custom hook to track web vitals for debugging
 */
export function useWebVitals() {
  const [vitals, setVitals] = React.useState<any>({});

  React.useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    const observeMetric = (name: string, _threshold: number) => {
      const observer = new (PerformanceObserver as any)((list: any) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          setVitals((prev: any) => ({
            ...prev,
            [name]: {
              value: entry.value,
              rating: getRating(name, entry.value),
            },
          }));
        });
      });

      observer.observe({ entryTypes: [name] });

      return observer;
    };

    // Observe Core Web Vitals
    const lcpObserver = observeMetric("largest-contentful-paint", 2500);
    const fidObserver = observeMetric("first-input", 100);
    const clsObserver = observeMetric("layout-shift", 0.1);

    return () => {
      lcpObserver?.disconnect();
      fidObserver?.disconnect();
      clsObserver?.disconnect();
    };
  }, []);

  return vitals;
}

/**
 * Web Vitals Display Component (for development)
 */
export function WebVitalsDisplay() {
  const vitals = useWebVitals();

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
        zIndex: 9999,
      }}
    >
      <div>Web Vitals:</div>
      {Object.entries(vitals).map(([name, data]: [string, any]) => (
        <div key={name}>
          {name}: {data.value?.toFixed(2)} ({data.rating})
        </div>
      ))}
    </div>
  );
}
