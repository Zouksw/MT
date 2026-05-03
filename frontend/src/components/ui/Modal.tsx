"use client";

import type React from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
		</Dialog>
	);
};

export default Modal;
