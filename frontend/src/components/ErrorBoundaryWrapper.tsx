"use client";

import type { ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary";

interface ErrorBoundaryWrapperProps {
	children: ReactNode;
}

/**
 * Client-side wrapper for Error Boundary
 *
 * This component is needed because the root layout in Next.js is a server component,
 * and Error Boundaries must be client components.
 */
export default function ErrorBoundaryWrapper({ children }: ErrorBoundaryWrapperProps) {
	return <ErrorBoundary>{children}</ErrorBoundary>;
}
