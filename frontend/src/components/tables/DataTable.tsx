"use client";

import type React from "react";

export interface DataTableColumn<T = Record<string, unknown>> {
	key: string;
	header: string;
	dataIndex?: string;
	render?: (row: T) => React.ReactNode;
	width?: number | string;
}

export interface DataTableProps<T = Record<string, unknown>> {
	columns: DataTableColumn<T>[];
	data: T[];
	loading?: boolean;
	pagination?: { page: number; pageSize: number; total: number; onChange: (page: number) => void };
	emptyText?: string;
	enableZebraStriping?: boolean;
	compact?: boolean;
}

export function DataTable<T>({
	columns,
	data,
	loading = false,
	pagination,
	emptyText = "No data",
	enableZebraStriping = true,
	compact = false,
}: DataTableProps<T>) {
	if (loading) {
		return (
			<div className="overflow-hidden rounded-lg border border-gray-200/60 dark:border-gray-700/60">
				<div className="animate-pulse">
					<div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 flex gap-4">
						{columns.map((col) => (
							<div key={col.key} className="h-4 bg-muted rounded flex-1" />
						))}
					</div>
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="px-4 py-3 flex gap-4 border-t border-gray-100 dark:border-gray-800"
						>
							{columns.map((col) => (
								<div key={col.key} className="h-4 bg-muted rounded flex-1" />
							))}
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!data || data.length === 0) {
		return <div className="text-center py-12 text-gray-400">{emptyText}</div>;
	}

	const getCellValue = (row: T, col: DataTableColumn<T>) => {
		if (col.render) return col.render(row);
		if (col.dataIndex) return String((row as Record<string, unknown>)[col.dataIndex] ?? "");
		return String((row as Record<string, unknown>)[col.key] ?? "");
	};

	return (
		<div className="overflow-x-auto rounded-lg border border-gray-200/60 dark:border-gray-700/60">
			<table className="w-full text-sm">
				<thead>
					<tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200/60 dark:border-gray-700/60">
						{columns.map((col) => (
							<th
								key={col.key}
								className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
								style={col.width ? { width: col.width } : undefined}
							>
								{col.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.map((row, i) => (
						<tr
							key={((row as Record<string, unknown>).id ?? i) as React.Key}
							className={`border-b border-gray-100 dark:border-gray-800 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors ${enableZebraStriping && i % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-800/30" : ""}`}
						>
							{columns.map((col) => (
								<td key={col.key} className={`px-4 ${compact ? "py-2" : "py-3"}`}>
									{getCellValue(row, col)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{pagination && (
				<div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/60 dark:border-gray-700/60 text-xs text-gray-500">
					<span>
						Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
					</span>
					<div className="flex gap-2">
						<button
							disabled={pagination.page <= 1}
							onClick={() => pagination.onChange(pagination.page - 1)}
							className="px-2 py-1 rounded border border disabled:opacity-50"
						>
							Prev
						</button>
						<button
							disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
							onClick={() => pagination.onChange(pagination.page + 1)}
							className="px-2 py-1 rounded border border disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export default DataTable;
