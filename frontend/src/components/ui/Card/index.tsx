import type React from "react";
import { cn } from "@/lib/utils";

/**
 * Single Card implementation (round-114 convergence, TD-9/TD-18).
 *
 * The shadcn primitives (formerly ui/card.tsx) and this app wrapper used to
 * be two files with BOTH actively imported — 28 importers on the wrapper,
 * 3 trading components on the raw one. The primitives are inlined here; the
 * wrapper's conveniences (hover, children-first) stay the public API, with
 * CardBody as an alias of CardContent (both were in active use).
 */

function ShadcnCard({
	className,
	size = "default",
	...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return (
		<div
			data-slot="card"
			data-size={size}
			className={cn(
				"group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn(
				"font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn(
				"flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
				className,
			)}
			{...props}
		/>
	);
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	hover?: boolean;
	size?: "default" | "sm";
}

export const Card: React.FC<CardProps> = ({
	children,
	className,
	hover = false,
	size,
	onClick,
	...props
}) => (
	<ShadcnCard
		size={size}
		className={cn(
			hover && "cursor-pointer transition-shadow hover:shadow-md hover:ring-foreground/15",
			onClick && "cursor-pointer",
			className,
		)}
		onClick={onClick}
		{...props}
	>
		{children}
	</ShadcnCard>
);

export {
	CardAction,
	CardContent,
	CardContent as CardBody,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
};

export default Card;
