"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * useOnlineStatus - Detect online/offline network status
 *
 * Monitors browser online/offline events and provides:
 * - Current online status boolean
 * - Automatic toast notification when offline
 * - Automatic toast notification when back online
 * - Event listener cleanup
 *
 * @example
 * ```tsx
 * const isOnline = useOnlineStatus();
 *
 * return (
 *   <div>
 *     {isOnline ? 'Online' : 'Offline'}
 *   </div>
 * );
 * ```
 */
export function useOnlineStatus(): boolean {
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);
	const { showWarning, showSuccess } = useToast();

	useEffect(() => {
		// Only run in browser environment
		if (typeof window === "undefined" || typeof navigator === "undefined") {
			return;
		}

		const handleOnline = () => {
			setIsOnline(true);
			showSuccess("You're back online! All features should work normally.");
		};

		const handleOffline = () => {
			setIsOnline(false);
			showWarning(
				"You're offline. Some features may not work. Please check your internet connection.",
			);
		};

		// Add event listeners
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		// Cleanup event listeners on unmount
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [showSuccess, showWarning]);

	return isOnline;
}

/**
 * Hook with more control - includes callbacks
 */
export function useOnlineStatusWithCallbacks(options: {
	onOnline?: () => void;
	onOffline?: () => void;
	showToast?: boolean;
}): boolean {
	const { onOnline, onOffline, showToast = true } = options;
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);
	const { showWarning, showSuccess } = useToast();

	useEffect(() => {
		if (typeof window === "undefined" || typeof navigator === "undefined") {
			return;
		}

		const handleOnline = () => {
			setIsOnline(true);
			if (onOnline) onOnline();
			if (showToast) {
				showSuccess("Connection restored! You're back online.");
			}
		};

		const handleOffline = () => {
			setIsOnline(false);
			if (onOffline) onOffline();
			if (showToast) {
				showWarning("Connection lost. Please check your internet connection.");
			}
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [onOnline, onOffline, showToast, showSuccess, showWarning]);

	return isOnline;
}

export default useOnlineStatus;
