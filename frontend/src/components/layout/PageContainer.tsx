"use client";

import type React from "react";
import { PageTransition } from "@/components/ui/PageTransition";

export interface PageContainerProps {
	children: React.ReactNode;
	className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = "" }) => {
	return (
		<div
			className={`page-container bg-pattern-dots min-h-screen bg-white dark:bg-[#0a0a0a] p-6 ${className}`}
		>
			<PageTransition variant="slide-up">
				<div className="mx-auto max-w-[1440px]">{children}</div>
			</PageTransition>
		</div>
	);
};

export default PageContainer;
