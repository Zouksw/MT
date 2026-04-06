/**
 * Mobile Table Card
 *
 * Converts table rows into card layout on mobile devices.
 * Provides better mobile UX than horizontal scrolling tables.
 */

"use client";

import React from "react";
import { Card, Space, Typography, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

export interface MobileTableCardProps<T = any> {
  dataSource: T[];
  columns: ColumnsType<T>;
  rowKey?: string | ((record: T) => string);
  emptyText?: string;
  renderActions?: (record: T) => React.ReactNode;
}

/**
 * MobileTableCard Component
 *
 * Renders table rows as cards on mobile.
 * Each card shows key fields in a vertical layout.
 *
 * @example
 * <MobileTableCard
 *   dataSource={data}
 *   columns={columns}
 *   rowKey="id"
 *   renderActions={(record) => <EditButton recordItemId={record.id} />}
 * />
 */
export function MobileTableCard<T extends Record<string, any>>({
  dataSource,
  columns,
  rowKey = "id",
  emptyText = "No data",
  renderActions,
}: MobileTableCardProps<T>) {
  if (dataSource.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          color: "#9CA3AF",
        }}
      >
        <Text type="secondary">{emptyText}</Text>
      </div>
    );
  }

  const getKeyValue = (record: T, key: string): any => {
    const keys = key.split(".");
    let value: any = record;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  };

  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === "function") {
      return rowKey(record);
    }
    return record[rowKey] || index.toString();
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {dataSource.map((record, rowIndex) => {
        const key = getRowKey(record, rowIndex);

        // Filter out columns that should be hidden on mobile
        const visibleColumns = columns.filter((col) => {
          // Check if column has responsive prop that excludes mobile
          if (col.responsive) {
            return col.responsive.includes("xs");
          }
          // Default to showing if no responsive specified
          return true;
        });

        return (
          <Card
            key={key}
            variant="borderless"
            style={{
              borderRadius: 4,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
            styles={{ body: { padding: "16px" } }}
          >
            {/* Render each visible column as a field */}
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {visibleColumns.map((col, colIndex) => {
                // Type guard: only process columns with dataIndex (ColumnType, not ColumnGroupType)
                const colDataIndex = 'dataIndex' in col ? (col as any).dataIndex : undefined;
                if (!colDataIndex) return null;
                if (col.key === "actions") return null; // Skip actions column

                const dataIndex = Array.isArray(colDataIndex)
                  ? colDataIndex
                  : [colDataIndex as string];
                const value = getKeyValue(record, dataIndex.join("."));

                return (
                  <div key={colIndex}>
                    {/* Field Label */}
                    {col.title && (
                      <Text
                        type="secondary"
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        {col.title as string}
                      </Text>
                    )}

                    {/* Field Value */}
                    <div style={{ fontSize: "14px", color: "#111827" }}>
                      {col.render
                        ? col.render(value, record, rowIndex)
                        : value ?? "-"}
                    </div>
                  </div>
                );
              })}

              {/* Actions */}
              {renderActions && (
                <div
                  style={{
                    marginTop: "8px",
                    paddingTop: "12px",
                    borderTop: "1px solid #E5E7EB",
                  }}
                >
                  {renderActions(record)}
                </div>
              )}
            </Space>
          </Card>
        );
      })}
    </Space>
  );
}

/**
 * MobileTableCompact - More compact version for dense data
 */
export interface MobileTableCompactProps<T = any> extends MobileTableCardProps<T> {
  titleField?: string; // Field to use as card title
  subtitleField?: string; // Field to use as card subtitle
  statusField?: string; // Field to render as status badge
  statusColor?: (value: any) => string;
}

export function MobileTableCompact<T extends Record<string, any>>({
  dataSource,
  columns: _columns,
  rowKey = "id",
  emptyText = "No data",
  renderActions,
  titleField,
  subtitleField,
  statusField,
  statusColor,
}: MobileTableCompactProps<T>) {
  if (dataSource.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          color: "#9CA3AF",
        }}
      >
        <Text type="secondary">{emptyText}</Text>
      </div>
    );
  }

  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === "function") {
      return rowKey(record);
    }
    return record[rowKey] || index.toString();
  };

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {dataSource.map((record, rowIndex) => {
        const key = getRowKey(record, rowIndex);
        const title = titleField ? record[titleField] : undefined;
        const subtitle = subtitleField ? record[subtitleField] : undefined;
        const status = statusField ? record[statusField] : undefined;

        return (
          <Card
            key={key}
            variant="borderless"
            size="small"
            style={{
              borderRadius: 4,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
            }}
            styles={{ body: { padding: "12px" } }}
          >
            {/* Header: Title + Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              {title && (
                <Text
                  strong
                  style={{
                    fontSize: "14px",
                    color: "#111827",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </Text>
              )}
              {status && (
                <Tag
                  color={statusColor ? statusColor(status) : "default"}
                  style={{ marginLeft: "8px", fontSize: "11px" }}
                >
                  {status}
                </Tag>
              )}
            </div>

            {/* Subtitle */}
            {subtitle && (
              <Text
                type="secondary"
                style={{
                  fontSize: "12px",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                {subtitle}
              </Text>
            )}

            {/* Actions */}
            {renderActions && (
              <div style={{ display: "flex", gap: "8px" }}>
                {renderActions(record)}
              </div>
            )}
          </Card>
        );
      })}
    </Space>
  );
}

/**
 * useMobileTable Hook
 *
 * Returns appropriate table component based on device type
 */
export interface UseMobileTableOptions {
  isMobile?: boolean;
  variant?: "card" | "compact";
}

export function useMobileTable(
  options: UseMobileTableOptions = {}
) {
  const { isMobile = false, variant = "card" } = options;

  const TableComponent = variant === "compact" ? MobileTableCompact : MobileTableCard;

  return {
    isMobile,
    TableComponent,
    shouldUseMobileTable: isMobile,
  };
}
