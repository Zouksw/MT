import type React from "react";

export interface Column<T> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  dataSource: T[];
  rowKey?: keyof T | ((record: T) => string);
  onRow?: (record: T, index: number) => {
    onClick?: () => void;
    onDoubleClick?: () => void;
    className?: string;
  };
  className?: string;
  loading?: boolean;
  emptyText?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  dataSource,
  rowKey = "id" as keyof T,
  onRow,
  className = "",
  loading = false,
  emptyText = "No data",
}: TableProps<T>) {
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === "function") {
      return rowKey(record);
    }
    return String(record[rowKey] ?? index);
  };

  const getAlignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "left":
        return "text-left";
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`.trim()}>
          <thead className="bg-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${column.className || ""}`.trim()}
                  style={{ width: column.width }}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {columns.map((column) => (
                  <td key={`${i}-${column.key}`} className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-muted rounded animate-pulse"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!dataSource || dataSource.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`.trim()}>
        <thead className="bg-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${column.className || ""}`.trim()}
                style={{ width: column.width }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
          {dataSource.map((record, rowIndex) => {
            const rowProps = onRow?.(record, rowIndex);
            return (
              <tr
                key={getRowKey(record, rowIndex)}
                className={`hover:bg-accent/50 transition-colors duration-150 ${rowProps?.className || ""}`.trim()}
                onClick={rowProps?.onClick}
                onDoubleClick={rowProps?.onDoubleClick}
                style={{ height: "48px" }}
              >
                {columns.map((column) => {
                  const value = column.dataIndex !== undefined ? record[column.dataIndex] : undefined;
                  const content = column.render ? column.render(value, record, rowIndex) : value;

                  return (
                    <td
                      key={column.key}
                      className={`px-6 py-4 whitespace-nowrap ${getAlignClass(column.align)} ${column.className || ""}`.trim()}
                    >
                      <div className="text-body data-text">
                        {content}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
