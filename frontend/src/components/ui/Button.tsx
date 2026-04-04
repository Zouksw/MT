import React from "react";
import { TRANSITIONS, DURATION, EASING } from "@/lib/animations";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  "aria-label"?: string;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  fullWidth = false,
  icon,
  disabled,
  className = "",
  children,
  "aria-label": ariaLabel,
  ...props
}) => {
  // Generate aria-label if not provided
  const label = ariaLabel || (typeof children === "string" ? children : "Button");
  // Use consistent transition from animation library
  const transitionStyle = TRANSITIONS.button;

  const baseStyles = "inline-flex items-center justify-center font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-primary text-white hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-button-hover active:scale-95 focus:ring-primary",
    secondary: "bg-secondary text-white hover:bg-secondary-hover hover:-translate-y-0.5 active:scale-95 focus:ring-secondary",
    ghost: "bg-transparent border border-primary text-primary hover:bg-primary-light active:scale-95 focus:ring-primary",
    danger: "bg-error text-white hover:bg-error-dark hover:-translate-y-0.5 active:scale-95 focus:ring-error",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-body-sm rounded-sm",
    md: "px-4 py-2.5 text-body rounded-sm",
    lg: "px-6 py-3 text-body-lg rounded-md",
  };

  const widthStyles = fullWidth ? "w-full" : "";

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`.trim();

  return (
    <button
      className={combinedClassName}
      style={{ transition: transitionStyle }}
      disabled={disabled || isLoading}
      aria-label={label}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : (
        <>
          {icon && <span className="mr-1.5 inline-flex">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
