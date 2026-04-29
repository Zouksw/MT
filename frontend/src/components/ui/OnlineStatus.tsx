"use client";

import type React from "react";
import { useOnlineStatusWithCallbacks, useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Wifi, WifiOff, Cloud } from "lucide-react";

export interface OnlineStatusProps {
  mode?: "badge" | "text" | "icon" | "dot";
  position?: "fixed" | "inline";
  fixedPosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
  onlineMessage?: string;
  offlineMessage?: string;
  inHeader?: boolean;
}

const fixedPositions: Record<string, string> = {
  "top-right": "fixed top-4 right-4 z-50",
  "top-left": "fixed top-4 left-4 z-50",
  "bottom-right": "fixed bottom-4 right-4 z-50",
  "bottom-left": "fixed bottom-4 left-4 z-50",
  "top-center": "fixed top-4 left-1/2 -translate-x-1/2 z-50",
};

export const OnlineStatus: React.FC<OnlineStatusProps> = ({
  mode = "badge",
  position = "inline",
  fixedPosition = "top-right",
  onlineMessage = "Online",
  offlineMessage = "Offline",
  inHeader = false,
}) => {
  const isOnline = useOnlineStatusWithCallbacks({ showToast: true });
  const posClass = position === "fixed" ? fixedPositions[fixedPosition] || "" : "";
  const size = inHeader ? 16 : 20;

  if (mode === "badge") {
    return (
      <div className={`inline-flex items-center gap-2 cursor-pointer ${posClass}`}>
        <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
        <span className="text-sm text-foreground">
          {isOnline ? onlineMessage : offlineMessage}
        </span>
        {isOnline ? <Wifi className="size-4 text-gray-500" /> : <WifiOff className="size-4 text-gray-500" />}
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className={`inline-flex items-center gap-2 cursor-pointer ${posClass}`}>
        {isOnline ? (
          <>
            <Cloud className="size-4 text-emerald-500" />
            <span className="text-sm">{onlineMessage}</span>
          </>
        ) : (
          <>
            <WifiOff className="size-4 text-red-500" />
            <span className="text-sm">{offlineMessage}</span>
          </>
        )}
      </div>
    );
  }

  if (mode === "icon") {
    return (
      <div className={`inline-flex items-center cursor-pointer ${posClass}`} title={isOnline ? "Connected to internet" : "Disconnected from internet"}>
        {isOnline ? <Wifi className="text-emerald-500" style={{ width: size, height: size }} /> : <WifiOff className="text-red-500" style={{ width: size, height: size }} />}
      </div>
    );
  }

  if (mode === "dot") {
    return (
      <div
        className={`cursor-pointer ${posClass}`}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: isOnline ? "#10B981" : "#EF4444",
          boxShadow: `0 0 0 2px ${isOnline ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          transition: "background-color 0.3s ease",
        }}
        title={isOnline ? "Connected to internet" : "Disconnected from internet"}
      />
    );
  }

  return null;
};

export const OnlineStatusCompact: React.FC<{ position?: "inline" | "fixed" }> = ({
  position = "inline",
}) => <OnlineStatus mode="icon" position={position} inHeader />;

export const OnlineStatusText: React.FC<{ className?: string }> = ({ className }) => {
  const isOnline = useOnlineStatus();

  return (
    <div className={className} style={{ textAlign: "center", padding: 24 }}>
      {isOnline ? (
        <>
          <Wifi className="size-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">You&apos;re Online</h2>
          <p className="text-muted-foreground">All features are available. Your connection is stable.</p>
        </>
      ) : (
        <>
          <WifiOff className="size-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">You&apos;re Offline</h2>
          <p className="text-muted-foreground">Please check your internet connection. Some features may not work.</p>
        </>
      )}
    </div>
  );
};

export default OnlineStatus;
