/**
 * Responsive Navigation Component
 *
 * Provides different navigation experiences for desktop and mobile:
 * - Desktop: Sidebar with expandable sections
 * - Mobile: Bottom tab bar with quick access
 */

"use client";

import {
	Activity,
	Beef,
	Bell,
	BrainCircuit,
	Database,
	FlaskConical,
	LayoutGrid,
	LogOut,
	Menu,
	Settings,
	Target,
	Terminal,
	TrendingUp,
	User,
	Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/lib/responsive-utils";

export interface NavItem {
	key: string;
	label: string;
	icon: React.ReactNode;
	path: string;
	badge?: number;
	children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
	{
		key: "dashboard",
		label: "Dashboard",
		icon: <LayoutGrid className="w-[18px] h-[18px]" />,
		path: "/",
	},
	{
		key: "trading",
		label: "Market",
		icon: <TrendingUp className="w-[18px] h-[18px]" />,
		path: "/trading",
		children: [
			{
				key: "trading-chart",
				label: "Charts",
				icon: <Activity className="w-[18px] h-[18px]" />,
				path: "/trading",
			},
			{
				key: "trading-watchlist",
				label: "Watchlists",
				icon: <Zap className="w-[18px] h-[18px]" />,
				path: "/trading/watchlist",
			},
			{
				key: "trading-portfolio",
				label: "Analysis Groups",
				icon: <LayoutGrid className="w-[18px] h-[18px]" />,
				path: "/trading/portfolio",
			},
			{
				key: "trading-sim",
				label: "Backtest",
				icon: <FlaskConical className="w-[18px] h-[18px]" />,
				path: "/trading/sim",
			},
			{
				key: "trading-analytics",
				label: "Analytics",
				icon: <Activity className="w-[18px] h-[18px]" />,
				path: "/trading/analytics",
			},
			{
				key: "trading-community",
				label: "Community",
				icon: <User className="w-[18px] h-[18px]" />,
				path: "/trading/community",
			},
		],
	},
	{
		key: "datasets",
		label: "Datasets",
		icon: <Database className="w-[18px] h-[18px]" />,
		path: "/datasets",
	},
	{
		key: "timeseries",
		label: "Time Series",
		icon: <Activity className="w-[18px] h-[18px]" />,
		path: "/timeseries",
	},
	{
		key: "alerts",
		label: "Alerts",
		icon: <Bell className="w-[18px] h-[18px]" />,
		path: "/alerts",
	},
	{
		key: "beef",
		label: "Beef Data",
		icon: <Beef className="w-[18px] h-[18px]" />,
		path: "/beef",
	},
	{
		key: "ai",
		label: "AI Signals",
		icon: <BrainCircuit className="w-[18px] h-[18px]" />,
		path: "/ai",
		children: [
			{
				key: "ai-models",
				label: "Models",
				icon: <Zap className="w-[18px] h-[18px]" />,
				path: "/ai/models",
			},
			{
				key: "ai-accuracy",
				label: "Accuracy",
				icon: <Target className="w-[18px] h-[18px]" />,
				path: "/ai/accuracy",
			},
			{
				key: "ai-backtest",
				label: "Backtest",
				icon: <FlaskConical className="w-[18px] h-[18px]" />,
				path: "/ai/backtest",
			},
		],
	},
];

const USER_MENU_ITEMS = [
	{
		key: "profile",
		label: "Profile",
		icon: <User className="w-[18px] h-[18px]" />,
		path: "/settings/profile",
	},
	{
		key: "settings",
		label: "Settings",
		icon: <Settings className="w-[18px] h-[18px]" />,
		path: "/settings",
	},
	{
		key: "logout",
		label: "Logout",
		icon: <LogOut className="w-[18px] h-[18px]" />,
		path: "/login",
		danger: true,
	},
];

/**
 * Desktop Sidebar Navigation
 */
interface DesktopSidebarProps {
	collapsed?: boolean;
	onCollapse?: (collapsed: boolean) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
	collapsed = false,
	onCollapse: _onCollapse,
}) => {
	const router = useRouter();
	const pathname = usePathname();

	const handleNavClick = (item: NavItem) => {
		router.push(item.path);
	};

	const handleUserMenuClick = (item: (typeof USER_MENU_ITEMS)[number]) => {
		router.push(item.path);
	};

	return (
		<aside
			className="desktop-sidebar"
			style={{
				width: collapsed ? 72 : 256,
				transition: "width 0.2s ease",
			}}
		>
			{/* Logo */}
			<div className={`flex items-center mb-4 ${collapsed ? "px-3 py-4 gap-0" : "p-4 gap-3"}`}>
				<div className="w-8 h-8 bg-[#171717] dark:bg-foreground rounded-md flex items-center justify-center text-white dark:text-background text-lg font-semibold shrink-0">
					T
				</div>
				{!collapsed && (
					<span className="text-base font-semibold text-gray-900 dark:text-foreground">MT</span>
				)}
			</div>

			{/* Navigation Items */}
			<nav>
				{NAV_ITEMS.map((item) => {
					const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
					const hasChildren = item.children && item.children.length > 0;

					return (
						<div key={item.key}>
													<div
								role="button"
								tabIndex={0}
								className={`desktop-nav-item ${isActive && !hasChildren ? "active" : ""} ${collapsed ? "p-3 justify-center" : "py-2.5 px-3 justify-start"} relative`}
								onClick={() => handleNavClick(item)}
								onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNavClick(item); }}
								title={collapsed ? item.label : undefined}
							>
								<span className="text-[18px] shrink-0">{item.icon}</span>
								{!collapsed && (
									<>
										<span className="flex-1">{item.label}</span>
										{item.badge && item.badge > 0 && (
											<span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
												{item.badge}
											</span>
										)}
									</>
								)}
							</div>
							{!collapsed && hasChildren && isActive && (
								<div className="pl-5">
									{item.children?.map((child) => {
										const childActive = pathname === child.path;
										return (
																					<div
												key={child.key}
												role="button"
												tabIndex={0}
												className={`desktop-nav-item ${childActive ? "active" : ""} py-1.5 px-3 text-[13px]`}
												onClick={() => handleNavClick(child)}
												onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNavClick(child); }}
											>
												<span className="text-sm shrink-0">{child.icon}</span>
												<span className="flex-1">{child.label}</span>
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</nav>

			{/* User Menu */}
			<div className="mt-auto pt-4 border-t border-gray-200 dark:border-border">
				<DropdownMenu>
					<DropdownMenuTrigger className="w-full">
						<div
							className={`desktop-nav-item cursor-pointer ${collapsed ? "p-3 justify-center" : "py-2.5 px-3 justify-start"}`}
						>
							<User className="w-[18px] h-[18px]" />
							{!collapsed && <span>User Menu</span>}
						</div>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="start" className="w-48">
						{USER_MENU_ITEMS.map((item) =>
							item.danger ? (
								<React.Fragment key={item.key}>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onClick={() => handleUserMenuClick(item)}>
										{item.icon}
										{item.label}
									</DropdownMenuItem>
								</React.Fragment>
							) : (
								<DropdownMenuItem key={item.key} onClick={() => handleUserMenuClick(item)}>
									{item.icon}
									{item.label}
								</DropdownMenuItem>
							),
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</aside>
	);
};

/**
 * Mobile Bottom Tab Bar
 */
export const MobileTabBar: React.FC = () => {
	const router = useRouter();
	const pathname = usePathname();
	const [, setActiveTab] = useState(pathname);

	const handleTabClick = (item: NavItem) => {
		setActiveTab(item.path);
		router.push(item.path);
	};

	const mobileNavItems = [
		NAV_ITEMS[0], // Dashboard
		NAV_ITEMS[1], // Market
		NAV_ITEMS[5], // Beef Data
		NAV_ITEMS[6], // AI Signals
	];

	return (
		<nav className="mobile-tab-bar">
			{mobileNavItems.map((item) => {
				const isActive = pathname === item.path;

				return (
									<div
						key={item.key}
						role="button"
						tabIndex={0}
						className={`mobile-tab-item ${isActive ? "active" : ""}`}
						onClick={() => handleTabClick(item)}
						onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleTabClick(item); }}
					>
						<span className="mobile-tab-item-icon">{item.icon}</span>
						<span>{item.label}</span>
						{item.badge && item.badge > 0 && (
							<span className="absolute top-1 right-2 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
								{item.badge}
							</span>
						)}
					</div>
				);
			})}

			{/* More menu */}
			<DropdownMenu>
				<DropdownMenuTrigger className="mobile-tab-item outline-none">
					<Menu className="mobile-tab-item-icon" />
					<span>More</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent side="top" align="end" className="w-48">
					<DropdownMenuItem onClick={() => router.push("/datasets")}>
						<Database className="size-4" />
						Datasets
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push("/timeseries")}>
						<Activity className="size-4" />
						Time Series
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push("/alerts")}>
						<Bell className="size-4" />
						Alerts
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push("/anomalies")}>
						<FlaskConical className="size-4" />
						Anomalies
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push("/forecasts")}>
						<Activity className="size-4" />
						Forecasts
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => router.push("/apikeys")}>
						<Terminal className="size-4" />
						API Keys
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push("/settings")}>
						<Settings className="size-4" />
						Settings
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</nav>
	);
};

/**
 * Mobile Header
 */
interface MobileHeaderProps {
	title?: string;
	action?: React.ReactNode;
	onBack?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ title, action, onBack }) => {
	const router = useRouter();

	return (
		<header className="mobile-header">
			{onBack && (
							<div role="button" tabIndex={0} className="mobile-header-action mr-2" onClick={onBack}
				onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onBack?.(); }}>
					←
				</div>
			)}

			<h1 className="mobile-header-title flex-1 m-0 text-h4 font-semibold">{title || "MT"}</h1>

			{action || (
							<div
					role="button"
					tabIndex={0}
					className="mobile-header-action"
					onClick={() => router.push("/settings/notifications")}
				onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push("/settings/notifications"); }}
				>
					<Bell className="w-[18px] h-[18px]" />
				</div>
			)}
		</header>
	);
};

/**
 * Responsive Navigation Container
 */
export interface ResponsiveNavProps {
	renderHeader?: boolean;
	headerTitle?: string;
	headerAction?: React.ReactNode;
	onBack?: () => void;
	sidebarCollapsed?: boolean;
	onSidebarCollapse?: (collapsed: boolean) => void;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({
	renderHeader = true,
	headerTitle,
	headerAction,
	onBack,
	sidebarCollapsed,
	onSidebarCollapse,
}) => {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<>
				{renderHeader && <MobileHeader title={headerTitle} action={headerAction} onBack={onBack} />}
				<MobileTabBar />
			</>
		);
	}

	return <DesktopSidebar collapsed={sidebarCollapsed} onCollapse={onSidebarCollapse} />;
};

/**
 * Navigation Layout Wrapper
 */
export interface NavLayoutProps {
	children: React.ReactNode;
	renderHeader?: boolean;
	headerTitle?: string;
	headerAction?: React.ReactNode;
	onBack?: () => void;
	sidebarCollapsed?: boolean;
	onSidebarCollapse?: (collapsed: boolean) => void;
}

export const NavLayout: React.FC<NavLayoutProps> = ({
	children,
	renderHeader = true,
	headerTitle,
	headerAction,
	onBack,
	sidebarCollapsed,
	onSidebarCollapse,
}) => {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<div className="mobile-with-tab-bar">
				{renderHeader && <MobileHeader title={headerTitle} action={headerAction} onBack={onBack} />}
				<main className="p-4">{children}</main>
				<MobileTabBar />
			</div>
		);
	}

	return (
		<div className="desktop-layout-with-sidebar">
			<DesktopSidebar collapsed={sidebarCollapsed} onCollapse={onSidebarCollapse} />
			<main className="desktop-main-content">{children}</main>
		</div>
	);
};
