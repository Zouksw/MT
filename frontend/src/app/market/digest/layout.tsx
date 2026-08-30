import type { Metadata } from "next";

/**
 * SEO metadata for the public Chinese market digest (v3.3.0 batch 1). The
 * page's acquisition goal is Chinese-language long-tail search for beef
 * import prices — the title/description match what the page actually
 * renders (real series, auto-aggregated, traceable), per the no-fabricated-
 * copy discipline.
 */
export const metadata: Metadata = {
	title: "今日牛肉国际行情摘要",
	description:
		"全球牛肉基准价（IMF 月度）、CME 活牛与架子牛期货、美元/人民币与雷亚尔汇率——全部来自可溯源的国际源序列，自动聚合，免费公开。",
	alternates: { canonical: "/market/digest" },
	openGraph: {
		title: "今日牛肉国际行情摘要",
		description:
			"全球牛肉基准价（IMF 月度）、CME 活牛与架子牛期货、美元/人民币与雷亚尔汇率——全部来自可溯源的国际源序列，自动聚合，免费公开。",
		locale: "zh_CN",
		url: "/market/digest",
		type: "website",
	},
};

export default function MarketDigestLayout({ children }: { children: React.ReactNode }) {
	return children;
}
