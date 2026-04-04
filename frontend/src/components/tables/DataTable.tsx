"use client";

import React, { useMemo } from "react";
import { Table, theme } from "antd";
import type { TableProps as AntTableProps } from "antd";
import { EmptyState, EmptyStateType } from "@/components/ui/EmptyState";

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
 * Provides a standardized table component with:
 * - Consistent cell padding
 * - Optional zebra striping
 * - Optional sticky header
 * - Enhanced pagination styling
 * - Responsive design
 * - Loading state support
 * - Empty state support
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
  ...props
}: DataTableProps<T>) => {
  const { token } = theme.useToken();

  // Memoize style content to avoid re-creating on every render
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

  // Check if data source is empty
  const dataSource = props.dataSource as T[] | undefined;
  const isEmpty = !dataSource || dataSource.length === 0;

  // Enhanced row class name for zebra striping
  const getRowClassName = (
    record: T,
    index: number | undefined,
    _?: any,
  ): string => {
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

  // Default pagination configuration
  const defaultPagination = pagination || false;

  const paginationConfig = {
    showSizeChanger: true,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} of ${total} items`,
    pageSizeOptions: ["10", "20", "50", "100"] as ("10" | "20" | "50" | "100")[],
    position: ["bottomRight"] as ["bottomRight"],
    ...defaultPagination,
  };

  return (
    <>
      {isEmpty ? (
        <EmptyState
          type={emptyStateType}
          title={emptyStateTitle}
          description={emptyStateDescription}
          actionText={emptyStateActionText}
          onAction={emptyStateOnAction}
        />
      ) : (
        <Table<T>
          {...props}
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
      )}
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
    </>
  );
};

export default DataTable;
