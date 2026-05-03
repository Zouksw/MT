"use client";

import type React from "react";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import { ColorModeContextProvider } from "@/contexts/color-mode";

export default function AppProviders({
	children,
	defaultMode,
}: {
	children: React.ReactNode;
	defaultMode?: string;
}) {
	return (
		<ColorModeContextProvider defaultMode={defaultMode}>
			<main id="main-content">
				<ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
			</main>
			<ToastProvider />
		</ColorModeContextProvider>
	);
}
