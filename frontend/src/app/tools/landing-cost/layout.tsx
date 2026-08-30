import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "进口牛肉到岸成本计算器",
	description:
		"用活价基准（IMF 全球牛肉、CME 活牛期货）× 实时美元/人民币汇率，自定义关税、增值税、运费与损耗，得出 RMB/kg 到岸参考区间——税率自担，不内置预设。",
	alternates: { canonical: "/tools/landing-cost" },
};

export default function LandingCostLayout({ children }: { children: React.ReactNode }) {
	return children;
}
