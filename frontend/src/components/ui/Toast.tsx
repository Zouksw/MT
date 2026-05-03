"use client";

import { toast as sonnerToast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
	type?: ToastType;
	duration?: number;
	description?: string;
}

interface ToastContextType {
	showToast: (message: string, options?: ToastOptions) => void;
	showSuccess: (message: string, description?: string) => void;
	showError: (message: string, description?: string) => void;
	showWarning: (message: string, description?: string) => void;
	showInfo: (message: string, description?: string) => void;
}

const DURATIONS: Record<ToastType, number> = {
	success: 3000,
	error: 5000,
	warning: 3000,
	info: 3000,
};

const toastContext: ToastContextType = {
	showToast: (message, options = {}) => {
		const type = options.type || "info";
		const duration = options.duration ? options.duration * 1000 : DURATIONS[type];
		sonnerToast[type](message, {
			description: options.description,
			duration,
		});
	},
	showSuccess: (message, description) => {
		sonnerToast.success(message, {
			description,
			duration: DURATIONS.success,
		});
	},
	showError: (message, description) => {
		sonnerToast.error(message, {
			description,
			duration: DURATIONS.error,
		});
	},
	showWarning: (message, description) => {
		sonnerToast.warning(message, {
			description,
			duration: DURATIONS.warning,
		});
	},
	showInfo: (message, description) => {
		sonnerToast.info(message, {
			description,
			duration: DURATIONS.info,
		});
	},
};

export const useToast = (): ToastContextType => toastContext;

export const useSuccess = () => toastContext.showSuccess;
export const useError = () => toastContext.showError;
export const useWarning = () => toastContext.showWarning;
export const useInfo = () => toastContext.showInfo;

export { Toaster as ToastProvider };
export default Toaster;
