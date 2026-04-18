import type { Metadata } from "next";
import { cookies } from "next/headers";
import React from "react";
import { Outfit, DM_Sans, Roboto_Mono, JetBrains_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AppProviders from "@/components/AppProviders";
import { WebVitals } from "@/components/WebVitals";
import "@ant-design/v5-patch-for-react-19";
import "@refinedev/antd/dist/reset.css";
import "@/styles/globals.css";

const outfit = Outfit({
  weight: '700',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
});

const dmSans = DM_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const robotoMono = Roboto_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: {
    default: "TradeMind AI — AI-Powered Commodity Trading Intelligence",
    template: "%s | TradeMind AI"
  },
  description: "AI-powered commodity price forecasting and trading signals for beef, grain, and forex markets",
  keywords: ["commodity trading", "AI forecasting", "trading signals", "beef prices", "grain prices", "forex"],
  authors: [{ name: "TradeMind AI Team" }],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://trademind.ai",
    title: "TradeMind AI — AI-Powered Commodity Trading Intelligence",
    description: "AI-powered commodity price forecasting and trading signals for beef, grain, and forex markets",
    siteName: "TradeMind AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeMind AI — AI-Powered Commodity Trading Intelligence",
    description: "AI-powered commodity price forecasting and trading signals",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme");

  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} ${robotoMono.variable} ${jetbrainsMono.variable}`}>
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
      <body className={dmSans.className}>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <AntdRegistry>
          <AppProviders defaultMode={theme?.value}>
            {children}
          </AppProviders>
        </AntdRegistry>

        <WebVitals />
      </body>
    </html>
  );
}
