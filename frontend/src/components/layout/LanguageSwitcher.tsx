"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

const localeLabels: Record<string, { label: string; flag: string }> = {
	en: { label: "English", flag: "\u{1F1FA}\u{1F1F8}" },
	"zh-CN": { label: "\u{4E2D}\u{6587}", flag: "\u{1F1E8}\u{1F1F3}" },
};

export const LanguageSwitcher: React.FC = () => {
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();
	const _t = useTranslations("nav");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const currentLocale = localeLabels[locale] || localeLabels.en;

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		if (open) document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [open]);

	const handleSelect = (key: string) => {
		setOpen(false);
		if (key !== locale) {
			router.replace(pathname, { locale: key });
		}
	};

	return (
		<div className="relative" ref={ref}>
			<button type="button"
				className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:bg-accent transition-colors"
				aria-label={currentLocale.label}
				onClick={() => setOpen(!open)}
			>
				<Globe className="size-4" />
				<span className="hidden sm:inline">{currentLocale.flag}</span>
			</button>

			{open && (
				<div className="absolute right-0 mt-1 w-40 rounded-md shadow-lg bg-card border border z-50">
					<div className="py-1">
						{Object.entries(localeLabels).map(([key, { label, flag }]) => (
							<button type="button"
								key={key}
								onClick={() => handleSelect(key)}
								className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors ${
									key === locale ? "text-amber-600 font-medium" : "text-foreground"
								}`}
							>
								<span>{flag}</span>
								<span>{label}</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default LanguageSwitcher;
