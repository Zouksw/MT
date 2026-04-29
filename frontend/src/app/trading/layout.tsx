import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MT — Commodity Market Intelligence",
  description: "AI-powered commodity price forecasting, multi-factor analysis, and prediction signals",
  openGraph: {
    title: "MT — Commodity Market Intelligence",
    description: "AI-powered commodity price forecasting, multi-factor analysis, and prediction signals",
    type: "website",
  },
};

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
