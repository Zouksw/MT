import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type React from "react";
import AppProviders from "@/components/AppProviders";
import { WebVitals } from "@/components/WebVitals";
import "@/styles/globals.css";
import { SITE_STATS } from "@/lib/site-stats";
import { cn } from "@/lib/utils";

// Beef-only positioning (PRODUCT-SPEC §一, §六 阶段0). Generic "55+ commodities"
// copy is a pre-beef-focus legacy — the platform is a beef-trade platform.
const BEEF_DESCRIPTION = `AI-powered beef price intelligence: ${SITE_STATS.beefCuts} beef cuts, ${SITE_STATS.sourceCountries} import markets, multi-model price forecasting for the China beef trade`;

export const metadata: Metadata = {
	title: {
		default: "MT — AI-Powered Beef Market Intelligence",
		template: "%s | MT",
	},
	description: BEEF_DESCRIPTION,
	keywords: [
		"beef prices",
		"beef market intelligence",
		"AI price forecasting",
		"beef trade",
		"imported beef",
		"beef cuts",
	],
	authors: [{ name: "MT Team" }],
	icons: {
		icon: "/favicon.ico",
		apple: "/apple-icon.png",
	},
	robots: {
		index: true,
		follow: true,
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://mt.ai",
		title: "MT — AI-Powered Beef Market Intelligence",
		description: BEEF_DESCRIPTION,
		siteName: "MT",
	},
	twitter: {
		card: "summary_large_image",
		title: "MT — AI-Powered Beef Market Intelligence",
		description: "AI-powered beef price analysis and predictive signals",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const cookieStore = await cookies();
	const theme = cookieStore.get("theme");

	return (
		<html
			lang="en"
			data-scroll-behavior="smooth"
			className={cn(GeistSans.variable, GeistMono.variable, "font-sans")}
		>
			<head>
				<style>{`
          .skip-to-content {
            position: absolute;
            top: -40px;
            left: 0;
            background: #171717;
            color: white;
            padding: 8px 16px;
            z-index: 100;
            transition: top 0.3s;
          }
          .skip-to-content:focus {
            top: 0;
          }
        `}</style>
			</head>
			<body className={GeistSans.className}>
				<a href="#main-content" className="skip-to-content">
					Skip to main content
				</a>
				<AppProviders defaultMode={theme?.value}>{children}</AppProviders>

				<WebVitals />
			</body>
		</html>
	);
}
