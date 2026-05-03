"use client";

import { Moon, Sun } from "lucide-react";
import { useContext, useSyncExternalStore } from "react";
import { ColorModeContext } from "@/contexts/color-mode";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
	const { mode, setMode } = useContext(ColorModeContext);
	const mounted = useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);

	const toggleTheme = () => {
		setMode(mode === "light" ? "dark" : "light");
	};

	if (!mounted) {
		return (
			<button
				className="p-2 rounded-md hover:bg-accent transition-colors"
				aria-label="Toggle theme"
			>
				<div className="w-5 h-5"></div>
			</button>
		);
	}

	const isLight = mode === "light";

	return (
		<button
			onClick={toggleTheme}
			className="relative p-2 rounded-md hover:bg-accent transition-colors overflow-hidden"
			aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
		>
			{/* Sun icon */}
			<Sun
				className={`size-5 absolute inset-0 m-auto transition-all duration-300 ${
					isLight ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100 text-primary"
				}`}
			/>
			{/* Moon icon */}
			<Moon
				className={`size-5 absolute inset-0 m-auto transition-all duration-300 ${
					isLight ? "opacity-100 rotate-0 scale-100 text-gray-700" : "opacity-0 -rotate-90 scale-0"
				}`}
			/>
			{/* Spacer to maintain button size */}
			<div className="w-5 h-5" />
		</button>
	);
}
