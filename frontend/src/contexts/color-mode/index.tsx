"use client";

import { App as AntdApp, ConfigProvider, theme } from "antd";
import React, {
  type PropsWithChildren,
  createContext,
  useCallback,
  useSyncExternalStore,
  useState,
} from "react";

import { lightTheme, darkTheme } from "@/lib/theme";

type ColorModeContextType = {
  mode: string;
  setMode: (mode: string) => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
  {} as ColorModeContextType,
);

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
    () => defaultMode || "dark"
  );

  const [localMode, setLocalMode] = useState<string | null>(null);

  const mode = localMode ?? savedTheme;

  const setColorMode = useCallback((newMode: string) => {
    setLocalMode(newMode);
    localStorage.setItem("theme", newMode);
    document.documentElement.classList.toggle("dark", newMode === "dark");
  }, []);

  // Apply dark mode class on mount
  React.useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  const { darkAlgorithm, defaultAlgorithm } = theme;

  return (
    <ColorModeContext.Provider
      value={{
        setMode: setColorMode,
        mode,
      }}
    >
      <ConfigProvider
        theme={{
          ...(mode === "light" ? lightTheme : darkTheme),
          algorithm: mode === "light" ? defaultAlgorithm : darkAlgorithm,
        }}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ColorModeContext.Provider>
  );
};
