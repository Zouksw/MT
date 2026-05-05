"use client";

import type React from "react";
import {
	SelectContent,
	SelectGroup,
	SelectItem,
	Select as SelectRoot,
	SelectTrigger,
	SelectValue,
} from "../select";

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectProps {
	options: SelectOption[];
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	error?: string;
	label?: string;
	fullWidth?: boolean;
	className?: string;
	"aria-label"?: string;
}

export const Select: React.FC<SelectProps> = ({
	options,
	value,
	defaultValue,
	onChange,
	placeholder = "Select...",
	disabled = false,
	error,
	label,
	fullWidth = false,
	className = "",
	"aria-label": ariaLabel,
}) => {
	const selectId = label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined;

	return (
		<div className={fullWidth ? "w-full" : ""}>
					{label && <label htmlFor={selectId} className="block text-sm font-medium text-foreground mb-1">{label}</label>}
			<SelectRoot
				value={value}
				defaultValue={defaultValue}
				onValueChange={onChange ? (v: string | null) => v !== null && onChange(v) : undefined}
				disabled={disabled}
			>
				<SelectTrigger
					className={`${fullWidth ? "w-full" : "min-w-50"} ${error ? "border-destructive" : ""} ${className}`}
					aria-label={ariaLabel || label}
				>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{options.length === 0 && (
							<div className="px-3 py-2 text-sm text-muted-foreground">No options</div>
						)}
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value} disabled={option.disabled}>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</SelectRoot>
			{error && <p className="mt-1 text-sm text-destructive">{error}</p>}
		</div>
	);
};

export default Select;
