"use client";

import React, {
	createContext,
	type PropsWithChildren,
	useCallback,
	useState,
	useSyncExternalStore,
} from "react";

type ColorModeContextType = {
	mode: string;
	setMode: (mode: string) => void;
};

export const ColorModeContext = createContext<ColorModeContextType>({} as ColorModeContextType);

type ColorModeContextProviderProps = {
	defaultMode?: string;
};

function subscribeToStorage(callback: () => void) {
	window.addEventListener("storage", callback);
	return () => window.removeEventListener("storage", callback);
}

export const ColorModeContextProvider: React.FC<
	PropsWithChildren<ColorModeContextProviderProps>
> = ({ children, defaultMode }) => {
	const savedTheme = useSyncExternalStore(
		subscribeToStorage,
		() => localStorage.getItem("theme") || defaultMode || "dark",
		() => defaultMode || "dark",
	);

	const [localMode, setLocalMode] = useState<string | null>(null);

	const mode = localMode ?? savedTheme;

	const setColorMode = useCallback((newMode: string) => {
		setLocalMode(newMode);
		localStorage.setItem("theme", newMode);
		document.documentElement.classList.toggle("dark", newMode === "dark");
	}, []);

	React.useLayoutEffect(() => {
		document.documentElement.classList.toggle("dark", mode === "dark");
	}, [mode]);

	return (
		<ColorModeContext.Provider
			value={{
				setMode: setColorMode,
				mode,
			}}
		>
			{children}
		</ColorModeContext.Provider>
	);
};
