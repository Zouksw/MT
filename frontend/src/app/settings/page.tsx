"use client";

import {
	Bell,
	ChevronRight,
	CircleCheck,
	Clock,
	Database,
	KeyRound,
	Shield,
	User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { authFetch, getAuthToken, getCachedUser } from "@/utils/auth";

interface UserProfile {
	id: string;
	email: string;
	name: string | null;
	roles?: string[];
	avatar?: string;
	createdAt?: string;
}

export default function SettingsPage() {
	const router = useRouter();
	const [user, setUser] = useState<UserProfile | null>(null);
	const [, setLoading] = useState(true);

	const fetchUserData = useCallback(async () => {
		setLoading(true);
		try {
			const token = getAuthToken();
			const response = await authFetch("/api/auth/me", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("Failed to fetch user data");
			const data = await response.json();
			setUser(data.user);
		} catch {
			const cachedUser = getCachedUser();
			if (cachedUser) setUser(cachedUser);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchUserData();
	}, [fetchUserData]);

	const settingsSections = [
		{
			title: "Profile Settings",
			description: "Update your personal information and preferences",
			icon: <User className="size-[18px]" />,
			color: "from-primary to-blue-400",
			path: "/settings/profile",
		},
		{
			title: "Notifications",
			description: "Configure how you receive alerts and notifications",
			icon: <Bell className="size-[18px]" />,
			color: "from-primary to-primary-hover",
			path: "/settings/notifications",
		},
		{
			title: "Session History",
			description: "View your recent login history and active sessions",
			icon: <Clock className="size-[18px]" />,
			color: "from-emerald-500 to-teal-400",
			path: "/settings/sessions",
		},
		{
			title: "API Keys",
			description: "Manage your API keys for programmatic access",
			icon: <KeyRound className="size-[18px]" />,
			color: "from-purple-500 to-indigo-400",
			path: "/apikeys",
		},
		{
			title: "Data Sources",
			description: "Monitor data pipeline health and refresh sources",
			icon: <Database className="size-[18px]" />,
			color: "from-teal-500 to-cyan-400",
			path: "/settings/data-sources",
		},
	];

	const securityItems = [
		{ label: "JWT Authentication", enabled: true },
		{ label: "API Key Management", enabled: true },
		{ label: "Session Monitoring", enabled: true },
		{ label: "Two-Factor Auth", enabled: false },
	];

	const securityScore =
		(securityItems.filter((i) => i.enabled).length / securityItems.length) * 100;

	return (
		<PageContainer>
			<PageHeader title="Settings" description="Manage your account settings and preferences" />

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* User Profile Card */}
				<div>
					<div className="rounded-xl overflow-hidden bg-card border">
						<div className="h-24 relative bg-gray-900">
							<div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-white/10" />
							<div className="absolute bottom-4 right-24 w-8 h-8 rounded-full bg-white/10" />
						</div>
						<div className="flex flex-col items-center -mt-10 px-6">
							<div className="w-20 h-20 rounded-full border-[3px] border-foreground/20 flex items-center justify-center bg-muted overflow-hidden ring-4 ring-card shadow-lg">
								{user?.avatar ? (
									// biome-ignore lint/performance/noImgElement: dynamic user avatar from unknown domain
									<img src={user.avatar} alt="" className="w-full h-full object-cover" />
								) : (
									<User className="size-8 text-gray-400" />
								)}
							</div>
							<h4 className="text-h4 font-display font-semibold text-foreground mt-3 mb-0.5">
								{user?.name || "User"}
							</h4>
							<p className="text-body text-muted-foreground mb-2">
								{user?.email || "user@example.com"}
							</p>
							<Tag color="primary" className="mb-4">
								{user?.roles?.[0] || "User"}
							</Tag>
							<div className="flex items-center gap-2 mb-4">
								<span className="h-2 w-2 rounded-full bg-green-500" />
								<span className="text-body-sm text-green-600 dark:text-green-400 font-medium">
									Active
								</span>
							</div>
							<Button
								variant="primary"
								className="w-full mb-6"
								onClick={() => router.push("/settings/profile")}
							>
								Edit Profile
							</Button>
						</div>
					</div>
				</div>

				{/* Settings Navigation */}
				<div className="lg:col-span-2">
					<div className="bg-card border rounded-xl p-6 h-full">
						<div className="flex items-center gap-2 mb-4">
							<div className="w-1.5 h-5 rounded-full bg-primary" />
							<span className="font-display font-semibold">Account Settings</span>
						</div>
						<div className="space-y-2">
							{settingsSections.map((section, index) => (
								<button
									type="button"
									// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
									key={index}
									onClick={() => router.push(section.path)}
									className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06] group"
								>
									<div
										className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center text-white shadow-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}
									>
										{section.icon}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-semibold text-[15px] text-foreground">{section.title}</div>
										<p className="text-body-sm text-muted-foreground mt-0.5">
											{section.description}
										</p>
									</div>
									<ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:text-primary group-hover:translate-x-0.5" />
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Security Score Section */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
				<div>
					<div className="bg-card border rounded-xl p-6 text-center">
						<div className="flex items-center gap-2 mb-4 justify-center">
							<div className="w-1.5 h-5 rounded-full bg-green-500" />
							<span className="font-display font-semibold">Security Score</span>
						</div>
						<div className="relative inline-flex items-center justify-center mb-4">
							<svg
								className="w-32 h-32 -rotate-90"
								viewBox="0 0 128 128"
								role="img"
								aria-label="Security score gauge"
							>
								<title>Security score gauge</title>
								<circle
									cx="64"
									cy="64"
									r="54"
									fill="none"
									stroke="#E5E7EB"
									strokeWidth="8"
									className="dark:stroke-gray-700"
								/>
								<circle
									cx="64"
									cy="64"
									r="54"
									fill="none"
									stroke="#B8860B"
									strokeWidth="8"
									strokeLinecap="round"
									strokeDasharray={`${securityScore * 3.39} 339`}
									className="transition-all duration-1000 ease-out"
								/>
							</svg>
							<div className="absolute inset-0 flex flex-col items-center justify-center">
								<span className="text-3xl font-display font-semibold text-foreground">
									{Math.round(securityScore)}
								</span>
								<span className="text-xs text-gray-500">out of 100</span>
							</div>
						</div>
					</div>
				</div>

				<div className="lg:col-span-2">
					<div className="bg-card border rounded-xl p-6">
						<div className="flex items-center gap-2 mb-4">
							<Shield className="size-[18px] text-green-500" />
							<span className="font-display font-semibold">Security Status</span>
						</div>
						<div className="space-y-3 mb-6">
							{securityItems.map((item, idx) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
								<div key={idx} className="flex items-center gap-3">
									{item.enabled ? (
										<CircleCheck className="size-4 text-green-500" />
									) : (
										<div className="w-4 h-4 rounded-full border-2 border-input" />
									)}
									<span
										className={`text-body ${item.enabled ? "text-foreground" : "text-muted-foreground"}`}
									>
										{item.label}
									</span>
									<Tag color={item.enabled ? "success" : "default"} className="ml-auto">
										{item.enabled ? "Enabled" : "Coming Soon"}
									</Tag>
								</div>
							))}
						</div>
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant="ghost"
								className="h-auto py-3"
								onClick={() => router.push("/apikeys")}
							>
								Manage API Keys
							</Button>
							<Button
								variant="ghost"
								className="h-auto py-3"
								onClick={() => router.push("/settings/profile")}
							>
								Change Password
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="mt-6">
				<div className="bg-card border rounded-xl p-6">
					<div className="flex items-center gap-2 mb-4">
						<div className="w-1.5 h-5 rounded-full bg-primary" />
						<span className="font-display font-semibold">Quick Actions</span>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{[
							{
								title: "View Sessions",
								desc: "See active sessions",
								path: "/settings/sessions",
								color: "from-emerald-500 to-teal-400",
								icon: <Clock className="size-4" />,
							},
							{
								title: "Notifications",
								desc: "Configure alerts",
								path: "/settings/notifications",
								color: "from-primary to-primary-hover",
								icon: <Bell className="size-4" />,
							},
							{
								title: "API Keys",
								desc: "Manage access tokens",
								path: "/apikeys",
								color: "from-purple-500 to-indigo-400",
								icon: <KeyRound className="size-4" />,
							},
							{
								title: "Profile",
								desc: "Edit personal info",
								path: "/settings/profile",
								color: "from-primary to-blue-400",
								icon: <User className="size-4" />,
							},
						].map((action, idx) => (
							<button
								type="button"
								// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
								key={idx}
								onClick={() => router.push(action.path)}
								className="w-full p-4 rounded-xl text-left group transition-shadow duration-200 bg-card hover:shadow-md"
							>
								<div
									className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center text-white text-sm mb-3 transition-transform duration-200 group-hover:scale-110`}
								>
									{action.icon}
								</div>
								<div className="font-semibold text-sm text-foreground">{action.title}</div>
								<div className="text-xs text-muted-foreground mt-0.5">{action.desc}</div>
							</button>
						))}
					</div>
				</div>
			</div>
		</PageContainer>
	);
}
