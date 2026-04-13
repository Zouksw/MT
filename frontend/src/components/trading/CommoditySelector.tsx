"use client";

import React from "react";
import { Tabs, Select, Skeleton } from "antd";
import { COMPONENT_BREAKPOINTS } from "@/lib/responsive-constants";

interface Commodity {
  id: string;
  name: string;
  symbol?: string;
}

interface CommoditySelectorProps {
  commodities: Commodity[];
  selected: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  /** Render label for each commodity tab/option */
  renderLabel?: (commodity: Commodity) => React.ReactNode;
}

/**
 * Responsive commodity selector:
 * - Desktop (>=768px): horizontal tab bar
 * - Mobile (<768px): Select dropdown with search
 */
export default function CommoditySelector({
  commodities,
  selected,
  onSelect,
  loading = false,
  renderLabel,
}: CommoditySelectorProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < COMPONENT_BREAKPOINTS.GRID_TWO_COLUMN);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton.Button key={i} active size="small" style={{ width: 120 }} />
        ))}
      </div>
    );
  }

  if (commodities.length === 0) {
    return null;
  }

  if (isMobile) {
    return (
      <Select
        value={selected}
        onChange={onSelect}
        style={{ width: "100%", marginBottom: 12 }}
        showSearch
        optionFilterProp="label"
        options={commodities.map((c) => ({
          value: c.id,
          label: c.symbol ? `${c.name} (${c.symbol})` : c.name,
        }))}
        aria-label="Select commodity"
      />
    );
  }

  const defaultLabel = (c: Commodity) => c.symbol ? `${c.name} (${c.symbol})` : c.name;

  return (
    <Tabs
      activeKey={selected}
      onChange={onSelect}
      items={commodities.map((c) => ({
        key: c.id,
        label: renderLabel ? renderLabel(c) : defaultLabel(c),
      }))}
      size="small"
      style={{ marginBottom: 16 }}
    />
  );
}
