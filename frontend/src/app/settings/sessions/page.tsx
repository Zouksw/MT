"use client";

import { ContentCard } from "@/components/layout/ContentCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Active Sessions — honest placeholder (round-106).
 *
 * This page previously rendered three HARDCODED mock sessions (fixed IPs,
 * devices) and "Revoke" buttons that flipped local state, toasted success,
 * and did nothing server-side — fabricated security UI presenting data that
 * does not exist and actions that do not happen. There is no backend
 * session-listing/revocation API yet, so the honest page says exactly that.
 * When GET/DELETE /api/auth/sessions lands, replace this with the real
 * table (the old layout is in git history).
 */
export default function SessionsSettingsPage() {
	return (
		<PageContainer>
			<PageHeader title="Active Sessions" description="View and manage your login sessions" />

			<Alert variant="warning" className="mb-4">
				Session listing and revocation are not available yet. Password changes automatically
				invalidate all active sessions.
			</Alert>

			<ContentCard title="Active Sessions">
				<div className="py-10 text-center text-sm text-muted-foreground">
					<p>No session data to display.</p>
					<p className="mt-1">
						To secure your account today, change your password on the Profile page — this signs out
						every active session.
					</p>
				</div>
			</ContentCard>
		</PageContainer>
	);
}
