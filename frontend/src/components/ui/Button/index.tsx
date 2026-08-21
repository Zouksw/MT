import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

/**
 * Single Button implementation (round-114 convergence, TD-9/TD-18).
 *
 * The shadcn/base-ui primitive (formerly ui/button.tsx) and this app wrapper
 * used to be two files with BOTH actively imported — 58 importers on the
 * wrapper, 4 on the raw primitive — a real dual implementation, not a
 * wrapper-and-base pair. The primitive is inlined here; the wrapper's
 * vocabulary (primary/danger, isLoading, fullWidth, icon) is the public API,
 * and buttonVariants is re-exported for advanced styling.
 */

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
				outline:
					"border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
				ghost:
					"hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
				destructive:
					"bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default:
					"h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				icon: "size-8",
				"icon-xs":
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
				"icon-sm":
					"size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
				"icon-lg": "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type BaseVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type BaseSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

function BaseButton({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
	size?: "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";
	isLoading?: boolean;
	fullWidth?: boolean;
	icon?: React.ReactNode;
	/** Optional since base-ui `render` composition (e.g. DialogPrimitive.Close)
	 * supplies the children instead of the caller. */
	children?: React.ReactNode;
}

const VARIANT_MAP: Record<string, BaseVariant> = {
	primary: "default",
	secondary: "secondary",
	outline: "outline",
	ghost: "ghost",
	danger: "destructive",
	link: "link",
};

const SIZE_MAP: Record<string, BaseSize | undefined> = {
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
		<BaseButton
			variant={VARIANT_MAP[variant]}
			size={SIZE_MAP[size]}
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
		</BaseButton>
	);
};

export { buttonVariants };
