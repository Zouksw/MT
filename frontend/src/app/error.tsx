"use client";

import { ErrorPageContent } from "@/components/ErrorPageContent";

/**
 * App Router error boundary — catches errors thrown by any route segment
 * below the root layout. The shared UI lives in <ErrorPageContent/> so the
 * copy and styling aren't duplicated with global-error.tsx.
 */
export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<ErrorPageContent
			error={error}
			reset={reset}
			heading="Application Error"
			description="Something went wrong while loading this page. Please try again or contact support if the problem persists."
		/>
	);
}
