"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Modal — the project's single dialog implementation.
 *
 * Wraps @base-ui/react/dialog with a simple open/onClose/title/footer API.
 * Previously this was split across Modal.tsx (the convenience wrapper) and
 * dialog.tsx (a shadcn-style primitive wrapper exporting 10 granular pieces),
 * but only Modal ever imported dialog.tsx — the granular exports had zero
 * consumers. The two files are merged here so there's one place to read and
 * edit dialog behavior. If granular Trigger/Overlay/Portal access is needed
 * later, re-extract from this file.
 */

// ─── primitives (inlined from the former dialog.tsx) ───

function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
	return (
		<DialogPrimitive.Backdrop
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
	showCloseButton?: boolean;
}) {
	return (
		<DialogPrimitive.Portal>
			<DialogOverlay />
			<DialogPrimitive.Popup
				data-slot="dialog-content"
				className={cn(
					"fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Popup>
		</DialogPrimitive.Portal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
			)}
		</div>
	);
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("font-heading text-base leading-none font-medium", className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(
				"text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

// ─── public Modal API (unchanged) ───

export interface ModalProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	width?: string;
	className?: string;
}

export const Modal: React.FC<ModalProps> = ({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	width = "sm:max-w-lg",
	className = "",
}) => {
	return (
		<DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className={`${width} ${className}`} showCloseButton={!footer}>
				{title && (
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description && <DialogDescription>{description}</DialogDescription>}
					</DialogHeader>
				)}
				<div className="py-2">{children}</div>
				{footer && <DialogFooter>{footer}</DialogFooter>}
			</DialogContent>
		</DialogPrimitive.Root>
	);
};

export default Modal;
