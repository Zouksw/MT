"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { Table, theme } from "antd";
import type { TableProps as AntTableProps } from "antd";
import { EmptyState, EmptyStateType } from "@/components/ui/EmptyState";
import { useIsMobile } from "@/lib/responsive-utils";

export interface DataTableProps<T = any> extends Omit<AntTableProps<T>, "className"> {
  enableZebraStriping?: boolean;
  stickyHeader?: boolean;
  compact?: boolean;
  emptyStateType?: EmptyStateType;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateActionText?: string;
  emptyStateOnAction?: () => void;
}

/**
 * DataTable - Enhanced table wrapper with consistent styling
 *
 * Provides:
 * - Desktop: standard table with zebra striping
 * - Mobile: automatic card view per row
 * - Consistent styling and pagination
 */
export const DataTable = <T extends Record<string, any>>({
  enableZebraStriping = true,
  stickyHeader = true,
  compact = false,
  rowClassName,
  pagination,
  emptyStateType = "data",
  emptyStateTitle,
  emptyStateDescription,
  emptyStateActionText,
  emptyStateOnAction,
  columns,
  ...props
}: DataTableProps<T>) => {
  const { token } = theme.useToken();
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const isMobile = useIsMobile();

  const styleContent = useMemo(() => `
    .data-table .ant-table {
      border-radius: ${token.borderRadiusLG}px;
      overflow: hidden;
    }

    .data-table--striped .ant-table-tbody > tr.ant-table-row:nth-child(even) {
      background-color: ${token.colorBgLayout};
    }

    .data-table-row-zebra {
      background-color: ${token.colorBgLayout};
    }

    .data-table .ant-table-tbody > tr.ant-table-row:hover > td {
      background-color: ${token.colorPrimaryBg} !important;
    }

    .data-table .ant-table-thead > tr > th {
      font-weight: 600;
      font-size: ${token.fontSizeSM}px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${token.colorTextSecondary};
      background-color: transparent !important;
      border-bottom: 1px solid ${token.colorBorder};
    }

    .data-table .ant-table-tbody > tr > td {
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }

    .data-table .ant-pagination {
      padding: ${token.paddingLG}px ${token.paddingLG}px 0;
      border-top: 1px solid ${token.colorBorder};
      margin: 0;
    }

    .data-table--compact .ant-table-tbody > tr > td {
      padding: ${token.paddingSM}px ${token.paddingMD}px;
    }

    .data-table--compact .ant-table-thead > tr > th {
      padding: ${token.paddingSM}px ${token.paddingMD}px;
    }
  `, [token.borderRadiusLG, token.colorBgLayout, token.colorPrimaryBg,
      token.fontSizeSM, token.colorTextSecondary, token.colorBorder,
      token.colorBorderSecondary, token.paddingLG, token.paddingSM, token.paddingMD]);

  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement("style");
      el.setAttribute("data-data-table", "");
      document.head.appendChild(el);
      styleRef.current = el;
    }
    styleRef.current.textContent = styleContent;
    return () => {
      if (styleRef.current && !document.querySelector(".data-table")) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, [styleContent]);

  const dataSource = props.dataSource as T[] | undefined;
  const isEmpty = !dataSource || dataSource.length === 0;

  const getRowClassName = (record: T, index: number | undefined, _?: any): string => {
    const classes: string[] = [];
    if (enableZebraStriping && index !== undefined && index % 2 === 1) {
      classes.push("data-table-row-zebra");
    }
    if (typeof rowClassName === "function") {
      classes.push(rowClassName(record, index ?? -1, _));
    } else if (typeof rowClassName === "string") {
      classes.push(rowClassName);
    }
    return classes.join(" ");
  };

  const defaultPagination = pagination || false;

  const paginationConfig = {
    showSizeChanger: true,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} of ${total} items`,
    pageSizeOptions: ["10", "20", "50", "100"] as ("10" | "20" | "50" | "100")[],
    position: ["bottomRight"] as ["bottomRight"],
    ...defaultPagination,
  };

  // Mobile card view
  if (isMobile && !isEmpty && dataSource) {
    const visibleColumns = (columns || []).filter(
      (col) => col.title && col.key !== "actions"
    );

    return (
      <div className="space-y-3">
        {dataSource.map((record, rowIndex) => (
          <div
            key={rowIndex}
            className="rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-4 transition-all duration-200 active:scale-[0.98]"
          >
            {visibleColumns.map((col) => {
              const value = record[(col as any).dataIndex as string];
              if (value === undefined || value === null) return null;

              return (
                <div key={col.key as string} className="flex items-center justify-between py-1.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {col.title as string}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white data-text">
                    {col.render
                      ? (col.render(value, record, rowIndex) as React.ReactNode)
                      : String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {/* Mobile pagination — simplified for card view */}
        {pagination && defaultPagination && (
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
            {dataSource.length} items shown
          </div>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        type={emptyStateType}
        title={emptyStateTitle}
        description={emptyStateDescription}
        actionText={emptyStateActionText}
        onAction={emptyStateOnAction}
      />
    );
  }

  return (
    <Table<T>
      {...props}
      columns={columns}
      rowClassName={getRowClassName}
      sticky={stickyHeader ? { offsetHeader: 64 } : undefined}
      pagination={paginationConfig}
      size={compact ? "small" : "middle"}
      className={`data-table ${enableZebraStriping ? "data-table--striped" : ""} ${compact ? "data-table--compact" : ""}`}
      style={{
        fontSize: token.fontSize,
        borderRadius: token.borderRadiusLG,
        overflow: "hidden",
      }}
    />
  );
};

export default DataTable;
