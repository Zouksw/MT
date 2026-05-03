import type React from "react";
import { cn } from "@/lib/utils";
import {
	CardAction,
	CardDescription,
	Card as ShadcnCard,
	CardContent as ShadcnCardContent,
	CardFooter as ShadcnCardFooter,
	CardHeader as ShadcnCardHeader,
	CardTitle as ShadcnCardTitle,
} from "../card";

export { CardAction, CardDescription };

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
	children,
	className,
	hover = false,
	onClick,
	...props
}) => (
	<ShadcnCard
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

export const CardHeader = ShadcnCardHeader;
export const CardTitle = ShadcnCardTitle;
export const CardBody = ShadcnCardContent;
export const CardContent = ShadcnCardContent;
export const CardFooter = ShadcnCardFooter;

export default Card;
