import { Loader2 } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, Button as ShadcnButton } from "../button";

/**
 * App-level Button wrapper around the shadcn/base-ui Button (../button.tsx).
 * Adds isLoading / fullWidth / icon conveniences and a simplified variant
 * vocabulary. Exposes outline + link (and icon sizes) so callers don't
 * hand-roll <button>s for those styles — the root cause of the raw <button>
 * instances found in the design audit. The full cva set lives in
 * buttonVariants (re-exported) for advanced use.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
	size?: "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";
	isLoading?: boolean;
	fullWidth?: boolean;
	icon?: React.ReactNode;
	children: React.ReactNode;
}

const VARIANT_MAP: Record<string, string> = {
	primary: "default",
	secondary: "secondary",
	outline: "outline",
	ghost: "ghost",
	danger: "destructive",
	link: "link",
};

const SIZE_MAP: Record<string, string | undefined> = {
	xs: "xs",
	sm: "sm",
	md: undefined,
	lg: "lg",
	icon: "icon",
	"icon-sm": "icon-sm",
	"icon-lg": "icon-lg",
};

export const Button: React.FC<ButtonProps> = ({
	variant = "primary",
	size = "md",
	isLoading = false,
	fullWidth = false,
	icon,
	disabled,
	className,
	children,
	...props
}) => {
	return (
		<ShadcnButton
			variant={
				VARIANT_MAP[variant] as
					| "default"
					| "secondary"
					| "outline"
					| "ghost"
					| "destructive"
					| "link"
			}
			size={
				SIZE_MAP[size] as
					| "default"
					| "xs"
					| "sm"
					| "lg"
					| "icon"
					| "icon-sm"
					| "icon-lg"
					| undefined
			}
			disabled={disabled || isLoading}
			className={cn(fullWidth && "w-full", className)}
			{...props}
		>
			{isLoading ? (
				<>
					<Loader2 className="size-4 animate-spin" />
					{children}
				</>
			) : (
				<>
					{icon}
					{children}
				</>
			)}
		</ShadcnButton>
	);
};

export { buttonVariants };
