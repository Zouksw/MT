import React from "react";
import { TRANSITIONS } from "@/lib/animations";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  hover = false,
  onClick,
}) => {
  // Use consistent transition from animation library
  const transitionStyle = TRANSITIONS.card;

  const baseStyles = "bg-white dark:bg-gray-800 rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,#fafafa_0px_0px_0px_1px]";

  const hoverStyles = hover
    ? "hover:shadow-card-hover dark:hover:shadow-card-hover-dark cursor-pointer"
    : "shadow-card";

  const combinedClassName = `${baseStyles} ${hoverStyles} ${className}`.trim();

  return (
    <div className={combinedClassName} style={{ transition: transitionStyle }} onClick={onClick}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${className}`.trim()}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return (
    <h3 className={`text-h4 font-display font-semibold text-gray-900 dark:text-gray-50 ${className}`.trim()}>
      {children}
    </h3>
  );
};

export const CardBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return (
    <div className={`p-6 ${className}`.trim()}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 ${className}`.trim()}>
      {children}
    </div>
  );
};
