import React, { useId } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className = "",
  id,
  ...props
}) => {
  const reactId = useId();
  const inputId = id || `input-${reactId}`;

  const baseStyles = "block px-3 py-2 rounded-md text-body bg-white dark:bg-gray-800 border transition-all duration-150 ease-move focus:outline-none";

  const normalStyles = "border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-3 focus:ring-primary/20";
  const errorStyles = "border-error focus:border-error focus:ring-3 focus:ring-error/20";

  const widthStyles = fullWidth ? "w-full" : "";

  const combinedClassName = `${baseStyles} ${error ? errorStyles : normalStyles} ${widthStyles} ${className}`.trim();

  return (
    <div className={fullWidth ? "w-full" : ""}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-body-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={combinedClassName}
        style={{ height: "40px" }}
        {...props}
      />
      {error && (
        <p className="mt-1 text-body-sm text-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-body-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className = "",
  id,
  ...props
}) => {
  const reactId = useId();
  const textareaId = id || `textarea-${reactId}`;

  const baseStyles = "block px-3 py-2 rounded-md text-body bg-white dark:bg-gray-800 border transition-all duration-150 ease-move focus:outline-none";

  const normalStyles = "border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-3 focus:ring-primary/20";
  const errorStyles = "border-error focus:border-error focus:ring-3 focus:ring-error/20";

  const widthStyles = fullWidth ? "w-full" : "";

  const combinedClassName = `${baseStyles} ${error ? errorStyles : normalStyles} ${widthStyles} ${className}`.trim();

  return (
    <div className={fullWidth ? "w-full" : ""}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-body-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={combinedClassName}
        rows={4}
        {...props}
      />
      {error && (
        <p className="mt-1 text-body-sm text-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-body-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
};
