"use client";

import React from "react";
import { Tag } from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from "@ant-design/icons";

type SignalType = "BUY" | "SELL" | "HOLD";

interface SignalBadgeProps {
  type: SignalType;
  confidence?: number;
  size?: "small" | "default" | "large";
}

const signalConfig: Record<
  SignalType,
  { color: string; icon: React.ReactNode; bg: string }
> = {
  BUY: {
    color: "#16a34a",
    icon: <ArrowUpOutlined />,
    bg: "#f0fdf4",
  },
  SELL: {
    color: "#dc2626",
    icon: <ArrowDownOutlined />,
    bg: "#fef2f2",
  },
  HOLD: {
    color: "#d97706",
    icon: <MinusOutlined />,
    bg: "#fffbeb",
  },
};

export default function SignalBadge({
  type,
  confidence,
  size = "default",
}: SignalBadgeProps) {
  const config = signalConfig[type];
  const scale = size === "small" ? 0.85 : size === "large" ? 1.2 : 1;

  return (
    <Tag
      icon={config.icon}
      color={type === "BUY" ? "green" : type === "SELL" ? "red" : "orange"}
      style={{
        fontSize: `${14 * scale}px`,
        padding: `${2 * scale}px ${8 * scale}px`,
        borderRadius: 4,
        fontWeight: 600,
        fontFamily: "monospace",
        letterSpacing: 0.5,
      }}
    >
      {type}
      {confidence !== undefined && (
        <span style={{ opacity: 0.8, marginLeft: 4, fontWeight: 400 }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </Tag>
  );
}
