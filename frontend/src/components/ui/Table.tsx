import type React from "react";

export interface Column<T> {
	key: string;
	title: string;
	dataIndex?: keyof T;
	// biome-ignore lint/suspicious/noExplicitAny: table render callbacks are inherently dynamic
	render?: (value: any, record: T, index: number) => React.ReactNode;
	width?: number | string;
	align?: "left" | "center" | "right";
	className?: string;
}

export interface TableProps<T> {
	columns: Column<T>[];
	dataSource: T[];
	rowKey?: keyof T | ((record: T) => string);
	onRow?: (
		record: T,
		index: number,
	) => {
		onClick?: () => void;
		onDoubleClick?: () => void;
		className?: string;
	};
	className?: string;
	loading?: boolean;
	emptyText?: string;
}

export function Table<T>({
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
				<table className={`min-w-full ${className}`.trim()}>
					<thead>
						<tr className="border-b border-border">
							{columns.map((col) => (
								<th
									key={col.key}
									className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
								>
									{col.title}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{[1, 2, 3, 4, 5].map((i) => (
							<tr key={i} className="border-b border-border">
								{columns.map((col) => (
									<td key={`${i}-${col.key}`} className="px-4 py-3">
										<div className="h-4 bg-muted rounded animate-pulse w-3/4" />
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
				<p className="text-sm text-muted-foreground">{emptyText}</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className={`min-w-full ${className}`.trim()}>
				<thead>
					<tr className="border-b border-border">
						{columns.map((col) => (
							<th
								key={col.key}
								scope="col"
								className={`px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/90 ${getAlignClass(col.align)} ${col.className || ""}`.trim()}
								style={{ width: col.width }}
							>
								{col.title}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{dataSource.map((record, rowIndex) => {
						const rowProps = onRow?.(record, rowIndex);
						const hasClick = rowProps?.onClick || rowProps?.onDoubleClick;
						return (
							<tr
								key={getRowKey(record, rowIndex)}
								className={`border-b border-border last:border-0 transition-colors ${
									hasClick
										? "hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary cursor-pointer"
										: "hover:bg-muted/40"
								} ${rowProps?.className || ""}`.trim()}
								onClick={rowProps?.onClick}
								onDoubleClick={rowProps?.onDoubleClick}
								onKeyDown={
									hasClick
										? (e) => {
												if (e.key === "Enter") {
													e.currentTarget.click();
												}
											}
										: undefined
								}
								tabIndex={hasClick ? 0 : undefined}
								role={hasClick ? "button" : undefined}
							>
								{columns.map((col) => {
									const value = col.dataIndex !== undefined ? record[col.dataIndex] : undefined;
									const content = col.render ? col.render(value, record, rowIndex) : value;
									return (
										<td
											key={col.key}
											className={`px-4 py-3 text-sm whitespace-nowrap tabular-nums ${getAlignClass(col.align)} ${col.className || ""}`.trim()}
										>
											{content as React.ReactNode}
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
