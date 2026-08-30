import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Pricing — Free During Open Beta",
	description:
		"All data, forecasts and tools are open to every registered user during the open beta. Plan tiers are informational only — nothing is behind a paywall today.",
	alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
	return children;
}
