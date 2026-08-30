import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "About — Data Sources & Methodology",
	description:
		"How the platform collects international beef price data (FRED, CME, USDA, MLA and 14 more sources) and verifies every forecast against actual outcomes.",
	alternates: { canonical: "/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
	return children;
}
