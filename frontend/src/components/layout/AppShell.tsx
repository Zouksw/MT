"use client";

import {
	Bell,
	ChartLine,
	Database,
	LayoutGrid,
	Menu,
	Newspaper,
	Search,
	Settings,
	TrendingUp,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Navigation model (PRODUCT-SPEC.md §4 — beef-focused IA) ─────────────

interface NavItem {
	label: string;
	href: string;
	icon: React.ElementType;
}
interface NavSection {
	label: string;
	items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
	{
		label: "行情",
		items: [
			{ label: "价格总览", href: "/dashboard", icon: LayoutGrid },
			{ label: "牛肉行情", href: "/beef", icon: TrendingUp },
		],
	},
	{
		label: "资讯",
		items: [{ label: "市场动态", href: "/market-news", icon: Newspaper }],
	},
	{
		label: "分析",
		items: [
			{ label: "价格走势", href: "/trading", icon: ChartLine },
			{ label: "相关性分析", href: "/dashboard/analysis", icon: TrendingUp },
		],
	},
	{
		label: "AI 预测",
		items: [
			{ label: "价格预测", href: "/ai/predict", icon: TrendingUp },
			{ label: "模型准确率", href: "/ai/accuracy", icon: TrendingUp },
			{ label: "异常检测", href: "/ai/anomalies", icon: Bell },
		],
	},
	{
		label: "数据",
		items: [
			{ label: "数据源", href: "/settings/data-sources", icon: Database },
			{ label: "数据集", href: "/datasets", icon: Database },
			{ label: "时间序列", href: "/timeseries", icon: Database },
		],
	},
	{
		label: "系统",
		items: [
			{ label: "告警", href: "/alerts", icon: Bell },
			{ label: "设置", href: "/settings", icon: Settings },
		],
	},
];

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Active when the current path is the item's href, or a child of it. */
function isActive(pathname: string, href: string): boolean {
	if (href === "/dashboard") return pathname === "/dashboard";
	return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Sidebar content (shared between desktop rail + mobile drawer) ───────

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
	return (
		<nav className="flex flex-col gap-6 px-3 py-4" aria-label="Main navigation">
			{NAV_SECTIONS.map((section) => (
				<div key={section.label}>
					<p className="px-3 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
						{section.label}
					</p>
					<ul className="space-y-0.5">
						{section.items.map((item) => {
							const active = isActive(pathname, item.href);
							const Icon = item.icon;
							return (
								<li key={item.href}>
									<Link
										href={item.href}
										onClick={onNavigate}
										className={cn(
											"flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
											active
												? "bg-primary/10 text-primary font-medium"
												: "text-foreground/70 hover:bg-muted hover:text-foreground",
										)}
										aria-current={active ? "page" : undefined}
									>
										<Icon className="size-4 flex-shrink-0" />
										{item.label}
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}

// ─── Brand mark ──────────────────────────────────────────────────────────

function BrandMark() {
	return (
		<Link href="/dashboard" className="flex items-center gap-2 px-5 h-14 border-b border-border">
			<span className="flex items-center justify-center size-7 rounded-md bg-primary text-primary-foreground font-semibold text-sm">
				MT
			</span>
			<span className="font-semibold text-sm">MT 牛肉行情</span>
		</Link>
	);
}

// ─── Top bar ─────────────────────────────────────────────────────────────

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
	return (
		<header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-background sticky top-0 z-30">
			{/* Mobile menu toggle */}
			<button
				type="button"
				onClick={onOpenMenu}
				className="lg:hidden -ml-1 p-1.5 rounded-md hover:bg-muted"
				aria-label="Open navigation menu"
			>
				<Menu className="size-5" />
			</button>

			{/* Search (decorative — wired later) */}
			<div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
				<Search className="size-4" />
				<span>搜索部位 / 产地…</span>
			</div>

			<div className="flex-1" />

			{/* Alerts shortcut */}
			<Link
				href="/alerts"
				className="relative p-1.5 rounded-md hover:bg-muted text-foreground/70 hover:text-foreground"
				aria-label="查看告警"
			>
				<Bell className="size-5" />
			</Link>
		</header>
	);
}

// ─── Shell ───────────────────────────────────────────────────────────────

export interface AppShellProps {
	children: React.ReactNode;
}

/**
 * Application shell: persistent sidebar (desktop) + top bar + mobile drawer.
 * Wraps authenticated page content. Mounted via PageContainer so no route
 * changes are needed (marketing/auth pages don't use PageContainer and stay
 * fullscreen).
 */
export const AppShell: React.FC<AppShellProps> = ({ children }) => {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<div className="flex min-h-screen bg-background">
			{/* Desktop sidebar — fixed, hidden on <lg */}
			<aside className="hidden lg:flex flex-col w-60 border-r border-border bg-background flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
				<BrandMark />
				<SidebarNav pathname={pathname} />
			</aside>

			{/* Mobile drawer */}
			{mobileOpen && (
				<div className="lg:hidden fixed inset-0 z-50 flex">
					{/* Backdrop */}
					<button
						type="button"
						className="absolute inset-0 bg-black/50"
						aria-label="关闭菜单"
						onClick={() => setMobileOpen(false)}
					/>
					{/* Drawer panel */}
					<aside className="relative w-72 max-w-[80vw] bg-background border-r border-border overflow-y-auto animate-in slide-in-from-left">
						<div className="flex items-center justify-between">
							<BrandMark />
							<button
								type="button"
								onClick={() => setMobileOpen(false)}
								className="p-1.5 mr-2 rounded-md hover:bg-muted"
								aria-label="关闭菜单"
							>
								<X className="size-5" />
							</button>
						</div>
						<SidebarNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
					</aside>
				</div>
			)}

			{/* Main column */}
			<div className="flex-1 flex flex-col min-w-0">
				<TopBar onOpenMenu={() => setMobileOpen(true)} />
				<main id="main-content" className="flex-1 min-w-0">
					{children}
				</main>
			</div>
		</div>
	);
};

export default AppShell;
