/**
 * Mobile Filter Panel
 *
 * Collapsible filter panel for mobile devices.
 * Displays filters in a drawer or expandable panel.
 */

"use client";

import React, { useState } from "react";
import { Button, Drawer, Space, Typography } from "antd";
import { FilterOutlined, CloseOutlined } from "@ant-design/icons";

const { Text } = Typography;

export interface FilterField {
  key: string;
  label: string;
  children: React.ReactNode;
}

export interface MobileFilterPanelProps {
  fields: FilterField[];
  activeCount?: number;
  onClear?: () => void;
  onApply?: () => void;
  placement?: "top" | "right" | "bottom" | "left";
  trigger?: "button" | "inline";
  children?: (props: { open: () => void; activeCount: number }) => React.ReactNode;
}

/**
 * MobileFilterPanel Component
 *
 * Provides a mobile-friendly filter interface.
 *
 * @example
 * <MobileFilterPanel
 *   fields={[
 *     { key: "status", label: "Status", children: <Select /> },
 *     { key: "date", label: "Date Range", children: <DatePicker /> },
 *   ]}
 *   activeCount={2}
 *   onClear={() => {}}
 * />
 */
export const MobileFilterPanel: React.FC<MobileFilterPanelProps> = ({
  fields,
  activeCount = 0,
  onClear,
  onApply,
  placement = "top",
  trigger = "button",
  children,
}) => {
  const [open, setOpen] = useState(false);

  const openDrawer = () => setOpen(true);
  const closeDrawer = () => setOpen(false);

  const handleClear = () => {
    onClear?.();
    closeDrawer();
  };

  const handleApply = () => {
    onApply?.();
    closeDrawer();
  };

  const triggerButton = (
    <Button
      icon={<FilterOutlined />}
      onClick={openDrawer}
      style={{
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      Filters
      {activeCount > 0 && (
        <span
          style={{
            background: "#0066CC",
            color: "#fff",
            borderRadius: "10px",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {activeCount}
        </span>
      )}
    </Button>
  );

  const triggerInline = (
    <div
      onClick={openDrawer}
      style={{
        padding: "12px 16px",
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
      }}
    >
      <Space size={8}>
        <FilterOutlined style={{ color: "#6B7280" }} />
        <Text type="secondary" style={{ fontSize: "13px" }}>
          Filters
        </Text>
        {activeCount > 0 && (
          <Text
            strong
            style={{
              fontSize: "12px",
              color: "#0066CC",
              background: "rgba(0, 102, 204, 0.08)",
              padding: "2px 8px",
              borderRadius: "10px",
            }}
          >
            {activeCount} active
          </Text>
        )}
      </Space>
    </div>
  );

  return (
    <>
      {children
        ? children({ open: openDrawer, activeCount })
        : trigger === "inline"
        ? triggerInline
        : triggerButton}

      <Drawer
        placement={placement}
        open={open}
        onClose={closeDrawer}
        closeIcon={<CloseOutlined />}
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text strong style={{ fontSize: "16px" }}>
              Filters
            </Text>
            {activeCount > 0 && (
              <Text
                type="secondary"
                style={{ fontSize: "13px", fontWeight: 400 }}
              >
                {activeCount} active
              </Text>
            )}
          </div>
        }
        styles={{
          body: { padding: 0 },
          header: { borderBottom: "1px solid #E5E7EB" },
        }}
        footer={
          <div
            style={{
              display: "flex",
              gap: "12px",
              padding: "16px",
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <Button
              block
              onClick={handleClear}
              style={{ borderRadius: 4 }}
            >
              Clear All
            </Button>
            <Button
              type="primary"
              block
              onClick={handleApply}
              style={{
                background: "#0066CC",
                borderRadius: 4,
              }}
            >
              Apply Filters
            </Button>
          </div>
        }
      >
        <div style={{ padding: "16px" }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {fields.map((field) => (
              <div key={field.key}>
                <Text
                  strong
                  style={{
                    fontSize: "13px",
                    display: "block",
                    marginBottom: "8px",
                    color: "#374151",
                  }}
                >
                  {field.label}
                </Text>
                {field.children}
              </div>
            ))}
          </Space>
        </div>
      </Drawer>
    </>
  );
};

/**
 * InlineFilterBar - Horizontal filter bar for mobile
 *
 * Shows filters as a horizontal scrollable bar.
 */
export interface InlineFilterBarProps {
  filters: Array<{
    key: string;
    label: string;
    value?: any;
    onChange?: (value: any) => void;
    options?: Array<{ label: string; value: any }>;
  }>;
}

export const InlineFilterBar: React.FC<InlineFilterBarProps> = ({
  filters,
}) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        overflowY: "visible",
        padding: "4px 0 12px 0",
        margin: "0 -4px",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="mobile-filter-scroll"
    >
      {filters.map((filter) => (
        <div
          key={filter.key}
          style={{
            flex: "0 0 auto",
            scrollSnapAlign: "start",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              background: filter.value ? "#0066CC" : "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "16px",
              fontSize: "13px",
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => filter.onChange?.(filter.value)}
          >
            <Text
              style={{
                color: filter.value ? "#FFFFFF" : "#374151",
                fontSize: "13px",
              }}
            >
              {filter.label}
            </Text>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * MobileQuickFilters - Quick filter chips for common filters
 */
export interface QuickFilterOption {
  label: string;
  value: any;
  count?: number;
}

export interface MobileQuickFiltersProps {
  options: QuickFilterOption[];
  value?: any;
  onChange?: (value: any) => void;
  label?: string;
}

export const MobileQuickFilters: React.FC<MobileQuickFiltersProps> = ({
  options,
  value,
  onChange,
  label = "Quick Filters",
}) => {
  return (
    <div>
      <Text
        type="secondary"
        style={{
          fontSize: "12px",
          fontWeight: 500,
          display: "block",
          marginBottom: "8px",
        }}
      >
        {label}
      </Text>
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          overflowY: "visible",
          padding: "4px 0 12px 0",
          margin: "0 -4px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="mobile-quick-filters-scroll"
      >
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <div
              key={option.value}
              onClick={() => onChange?.(option.value)}
              style={{
                flex: "0 0 auto",
                padding: "6px 12px",
                background: isActive ? "#0066CC" : "#FFFFFF",
                border: "1px solid " + (isActive ? "#0066CC" : "#E5E7EB"),
                borderRadius: "16px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <Text
                style={{
                  color: isActive ? "#FFFFFF" : "#374151",
                  fontSize: "13px",
                }}
              >
                {option.label}
                {option.count !== undefined && (
                  <span
                    style={{
                      marginLeft: "4px",
                      opacity: isActive ? 0.8 : 0.6,
                      fontSize: "11px",
                    }}
                  >
                    ({option.count})
                  </span>
                )}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
};
