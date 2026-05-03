"use client";

import React, { type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useIsMobile } from "@/lib/responsive-utils";
import { GlassCard } from "../ui/GlassCard";
import { PageHeader } from "../ui/PageHeader";

export interface DetailPageLayoutProps {
	title: string;
	subtitle?: string;
	breadcrumb?: Array<{ label: string; href?: string }>;
	actions?: Array<{
		icon: ReactNode;
		label: string;
		onClick?: () => void;
		href?: string;
		danger?: boolean;
	}>;
	loading?: boolean;
	error?: string;
	children?: ReactNode;
	extra?: ReactNode;
	mobileStack?: boolean;
}

export function DetailPageLayout({
	title,
	subtitle,
	breadcrumb,
	actions,
	loading = false,
	error,
	children,
	extra,
}: DetailPageLayoutProps) {
	const isMobile = useIsMobile();

	if (loading) {
		return (
			<div className="p-6 text-center min-h-100 flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 text-center min-h-100 flex items-center justify-center">
				<GlassCard style={{ maxWidth: 500, margin: "0 auto" }}>
					<h3 className="text-red-500 mb-4">Error</h3>
					<p className="text-gray-500 mb-6">{error}</p>
					<Button variant="primary" onClick={() => window.history.back()}>
						Go Back
					</Button>
				</GlassCard>
			</div>
		);
	}

	const breadcrumbItems = breadcrumb ? [{ label: "Home", href: "/" }, ...breadcrumb] : [];
	const actionButtons = actions?.map((action, index) => (
		<Button key={index} variant={action.danger ? "danger" : "ghost"} onClick={action.onClick}>
			{action.icon}
			{!isMobile && <span className="ml-2">{action.label}</span>}
		</Button>
	));

	return (
		<div className={isMobile ? "p-4" : "p-6"}>
			{breadcrumbItems.length > 0 && (
				<PageHeader
					title={title}
					description={subtitle}
					breadcrumbs={breadcrumbItems}
					actions={!isMobile ? <div className="flex gap-2">{actionButtons}</div> : undefined}
				/>
			)}
			{isMobile && actionButtons && actionButtons.length > 0 && (
				<div className="flex gap-2 mb-4">{actionButtons}</div>
			)}
			{extra && <div className="mb-6">{extra}</div>}
			<div className="grid grid-cols-1 gap-4">{React.Children.map(children, (child) => child)}</div>
		</div>
	);
}

export interface DetailSectionProps {
	title: string;
	children: ReactNode;
	colSpan?: number;
	extra?: ReactNode;
	noPadding?: boolean;
}

export function DetailSection({ title, children, extra, noPadding }: DetailSectionProps) {
	return (
		<GlassCard
			title={title}
			extra={extra}
			styles={noPadding ? { body: { padding: 0 } } : undefined}
		>
			{children}
		</GlassCard>
	);
}
