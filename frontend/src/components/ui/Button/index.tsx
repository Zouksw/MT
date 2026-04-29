import type React from "react";
import { Button as ShadcnButton, buttonVariants } from "../button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const VARIANT_MAP: Record<string, string> = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
};

const SIZE_MAP: Record<string, string | undefined> = {
  sm: "sm",
  md: undefined,
  lg: "lg",
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
      variant={VARIANT_MAP[variant] as "default" | "secondary" | "ghost" | "destructive"}
      size={SIZE_MAP[size] as "sm" | "default" | "lg" | undefined}
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
