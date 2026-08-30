import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Prediction Track Record — Dated, Checkable Forecasts",
	description:
		"Every model's rolling 30-day MAPE leaderboard plus recent auto-verified predictions with their actuals. Forecasts are stamped, outcomes are backfilled automatically — the record speaks for itself.",
	alternates: { canonical: "/ai/track-record" },
};

export default function TrackRecordLayout({ children }: { children: React.ReactNode }) {
	return children;
}
