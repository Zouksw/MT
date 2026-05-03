"use client";

import { Bell, Globe, LayoutGrid, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnlineStatusCompact } from "@/components/ui/OnlineStatus";
import { authFetch, getCachedUser } from "@/utils/auth";

export const Header: React.FC<{ sticky?: boolean }> = ({ sticky = true }) => {
	const user = getCachedUser();
	const router = useRouter();
	const [unreadCount, setUnreadCount] = useState(0);
	const [currentLocale, setCurrentLocale] = useState<string>(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("locale");
			if (stored === "zh-CN" || stored === "en") return stored;
		}
		return "en";
	});

	const toggleLocale = useCallback(() => {
		const next = currentLocale === "en" ? "zh-CN" : "en";
		setCurrentLocale(next);
		localStorage.setItem("locale", next);
	}, [currentLocale]);

	useEffect(() => {
		let mounted = true;
		const load = async () => {
			try {
				const response = await authFetch("/api/alerts/stats");
				if (response.ok && mounted) {
					const result = await response.json();
					const data = result.data || result;
					setUnreadCount(data?.unread || 0);
				}
			} catch {
				/* non-critical */
			}
		};
		load();
		const interval = setInterval(load, 30000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, []);

	const handleLogout = () => {
		authFetch("/api/auth/logout", { method: "POST" }).finally(() => {
			window.location.href = "/login";
		});
	};

	return (
		<header
			className={`flex justify-between items-center px-6 h-16 bg-white/85 dark:bg-slate-900/90 border-b border-gray-200/60 dark:border-gray-700/40 shadow-sm ${sticky ? "sticky top-0 z-50" : ""}`}
			style={{ backdropFilter: "blur(8px)" }}
		>
			<div className="flex items-center gap-3">
				<a href="/dashboard" className="flex items-center gap-2 no-underline">
					<div className="w-8 h-8 bg-[#171717] rounded-md flex items-center justify-center shadow-sm">
						<span className="text-white font-semibold text-base leading-none">I</span>
					</div>
					<span className="font-semibold text-sm text-gray-900 dark:text-gray-100 hidden sm:inline">
						MT
					</span>
				</a>
			</div>

			<div className="flex items-center gap-2">
				<OnlineStatusCompact position="inline" />

				{/* Notification Bell */}
				<a
					href="/alerts"
					className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
					title={unreadCount > 0 ? `${unreadCount} unread alerts` : "No new alerts"}
				>
					<Bell className="size-[18px]" />
					{unreadCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</a>

				{/* Locale Switcher */}
				<button
					onClick={toggleLocale}
					className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
					title={currentLocale === "en" ? "切换到中文" : "Switch to English"}
				>
					<Globe className="size-4" />
					<span className="text-[11px] font-semibold ml-1 leading-none">
						{currentLocale === "en" ? "EN" : "中"}
					</span>
				</button>

				<ThemeToggle />

				{/* User Avatar + DropdownMenu */}
				<DropdownMenu>
					<DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent transition-colors outline-none">
						<div className="w-8 h-8 rounded-full border-2 border-foreground/20 flex items-center justify-center bg-muted overflow-hidden">
							{user?.avatar ? (
								<img src={user.avatar} alt="" className="w-full h-full object-cover" />
							) : (
								<User className="size-4" />
							)}
						</div>
						{user?.name && (
							<span className="text-[13px] font-medium text-foreground hidden sm:inline">
								{user.name}
							</span>
						)}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						<DropdownMenuItem onClick={() => router.push("/dashboard")}>
							<LayoutGrid className="size-3.5" />
							Dashboard
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => router.push("/settings")}>
							<Settings className="size-3.5" />
							Settings
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onClick={handleLogout}>
							<LogOut className="size-3.5" />
							Sign Out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
};
