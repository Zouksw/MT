import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type React from "react";
import AppProviders from "@/components/AppProviders";
import { WebVitals } from "@/components/WebVitals";
import "@/styles/globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: {
		default: "MT — AI-Powered Commodity Market Intelligence",
		template: "%s | MT",
	},
	description:
		"AI-powered commodity price analysis, multi-factor market intelligence, and predictive signals for 55+ commodities",
	keywords: [
		"commodity analysis",
		"AI forecasting",
		"market signals",
		"commodity prices",
		"multi-factor analysis",
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
		title: "MT — AI-Powered Commodity Market Intelligence",
		description:
			"AI-powered commodity price analysis, multi-factor market intelligence, and predictive signals for 55+ commodities",
		siteName: "MT",
	},
	twitter: {
		card: "summary_large_image",
		title: "MT — AI-Powered Commodity Market Intelligence",
		description: "AI-powered commodity price analysis and predictive signals",
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
			className={cn(GeistSans.variable, GeistMono.variable, "font-sans", geist.variable)}
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
