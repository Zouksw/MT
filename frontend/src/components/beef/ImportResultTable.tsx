"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BeefImportResult } from "@/hooks/useBeefImport";

/**
 * ImportResultTable — renders the outcome of a beef-price CSV import.
 *
 * Shows a 3-stat summary (imported / updated / skipped) plus a per-row error
 * table when there are validation failures. The backend collects errors
 * rather than aborting on the first bad row, so a partial-success upload
 * (e.g. 90 good rows + 2 with unknown factoryCode) surfaces both the wins and
 * the exact rows to fix.
 */
export interface ImportResultTableProps {
	result: BeefImportResult;
}

export function ImportResultTable({ result }: ImportResultTableProps) {
	const { imported, updated, skipped, errors } = result;
	const hasErrors = errors.length > 0;
	const allSkipped = imported === 0 && updated === 0;

	return (
		<div className="space-y-4">
			{/* Summary banner */}
			{allSkipped ? (
				<div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-4">
					<AlertTriangle className="size-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
					<div>
						<div className="font-medium text-yellow-800 dark:text-yellow-200">No rows imported</div>
						<div className="text-sm text-yellow-700 dark:text-yellow-300">
							Every row was skipped. Check the error table below for details.
						</div>
					</div>
				</div>
			) : (
				<div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4">
					<CheckCircle2 className="size-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
					<div>
						<div className="font-medium text-green-800 dark:text-green-200">Import complete</div>
						<div className="text-sm text-green-700 dark:text-green-300">
							{imported} new, {updated} updated{hasErrors ? `, ${skipped} skipped` : ""}.
						</div>
					</div>
				</div>
			)}

			{/* Stat cards */}
			<div className="grid grid-cols-3 gap-3">
				<Stat label="New" value={imported} tone="primary" />
				<Stat label="Updated" value={updated} tone="info" />
				<Stat label="Skipped" value={skipped} tone={hasErrors ? "warning" : "muted"} />
			</div>

			{/* Per-row errors */}
			{hasErrors && (
				<div>
					<h4 className="text-sm font-semibold text-foreground mb-2">
						Row errors ({errors.length})
					</h4>
					<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
						<table className="data-table">
							<thead>
								<tr>
									<th className="text-left">CSV Row</th>
									<th className="text-left">Reason</th>
								</tr>
							</thead>
							<tbody>
								{errors.map((err, i) => (
									// row numbers can repeat if the DB batch rolls back; include index
									// in key to stay stable.
									<tr key={`${err.row}-${i}`}>
										<td className="font-mono text-sm">{err.row}</td>
										<td className="text-sm text-muted-foreground">{err.message}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

interface StatProps {
	label: string;
	value: number;
	tone: "primary" | "info" | "warning" | "muted";
}

const TONE_CLASS: Record<StatProps["tone"], string> = {
	primary: "text-primary",
	info: "text-blue-600 dark:text-blue-400",
	warning: "text-yellow-600 dark:text-yellow-400",
	muted: "text-muted-foreground",
};

function Stat({ label, value, tone }: StatProps) {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
			<div className={`text-2xl font-bold font-mono ${TONE_CLASS[tone]}`}>{value}</div>
			<div className="text-xs text-muted-foreground mt-0.5">{label}</div>
		</div>
	);
}

export default ImportResultTable;
