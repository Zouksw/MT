"use client";

import { useReportWebVitals } from "next/web-vitals";
import { apiFetch } from "@/lib/apiFetch";

export function WebVitals() {
	useReportWebVitals((metric) => {
		sendToAnalytics(metric);

		if (
			typeof window !== "undefined" &&
			(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
		) {
			// biome-ignore lint/style/noNonNullAssertion: value guaranteed by middleware
			(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag!("event", metric.name, {
				value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
				event_label: metric.id,
				non_interaction: true,
			});
		}
	});

	return null;
}

async function sendToAnalytics(metric: { name: string; value: number; id: string; delta: number }) {
	const ALLOWED = ["LCP", "FID", "CLS", "TTFB", "INP"];
	if (!ALLOWED.includes(metric.name)) return;

	try {
		await apiFetch("/api/metrics/web-vitals", {
			method: "POST",
			body: JSON.stringify({
				name: metric.name,
				value: metric.value,
				path: window.location.pathname,
				timestamp: Date.now(),
			}),
		});
	} catch {
		// Analytics failures must not break the app
	}
}
