"use client";

import type React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/PageTransition";

export interface PageContainerProps {
	children: React.ReactNode;
	className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = "" }) => {
	return (
		<AppShell>
			<div className={`page-container p-6 ${className}`}>
				<PageTransition variant="slide-up">
					<div className="mx-auto max-w-[1440px]">{children}</div>
				</PageTransition>
			</div>
		</AppShell>
	);
};

export default PageContainer;
