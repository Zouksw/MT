import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Beef Market Intelligence & Verifiable AI Price Forecasts",
	description:
		"Live international beef price series (IMF benchmark, CME cattle futures), 85+ beef cuts, and a 9-model forecasting engine with automatic accuracy verification — built for the China beef import trade.",
	alternates: { canonical: "/landing" },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
	return children;
}
