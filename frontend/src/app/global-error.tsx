"use client";

import { ErrorPageContent } from "@/components/ErrorPageContent";

/**
 * Global error boundary — catches errors thrown by the ROOT layout itself.
 * Next.js requires this component to render its own <html><body> shell
 * because the root layout (which normally provides them) is the thing that
 * threw. The inner UI is shared with app/error.tsx via <ErrorPageContent/>.
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body>
				<ErrorPageContent error={error} reset={reset} />
			</body>
		</html>
	);
}
