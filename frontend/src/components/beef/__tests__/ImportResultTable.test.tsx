import { render, screen } from "@testing-library/react";
import type { BeefImportResult } from "@/hooks/useBeefImport";
import { ImportResultTable } from "../ImportResultTable";

describe("ImportResultTable", () => {
	it("shows the success banner with counts when rows were imported", () => {
		const result: BeefImportResult = {
			imported: 5,
			updated: 2,
			skipped: 0,
			errors: [],
		};
		render(<ImportResultTable result={result} />);

		expect(screen.getByText("Import complete")).toBeInTheDocument();
		expect(screen.getByText(/5 new/)).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument(); // New stat
		expect(screen.getByText("2")).toBeInTheDocument(); // Updated stat
		expect(screen.queryByText("Row errors")).not.toBeInTheDocument();
	});

	it("shows the no-rows-imported banner when everything was skipped", () => {
		const result: BeefImportResult = {
			imported: 0,
			updated: 0,
			skipped: 3,
			errors: [
				{ row: 2, message: "Unknown factoryCode: FOO" },
				{ row: 3, message: "Invalid price: abc" },
			],
		};
		render(<ImportResultTable result={result} />);

		expect(screen.getByText("No rows imported")).toBeInTheDocument();
		expect(screen.getByText("Row errors (2)")).toBeInTheDocument();
		// Row numbers render in their own <td>, message text in another.
		expect(screen.getByText("Unknown factoryCode: FOO")).toBeInTheDocument();
		expect(screen.getByText("Invalid price: abc")).toBeInTheDocument();
	});

	it("shows skipped count in the summary even on partial success", () => {
		const result: BeefImportResult = {
			imported: 8,
			updated: 1,
			skipped: 1,
			errors: [{ row: 4, message: "Unknown cutCode: FOO" }],
		};
		render(<ImportResultTable result={result} />);

		expect(screen.getByText("Import complete")).toBeInTheDocument();
		expect(screen.getByText(/, 1 skipped/)).toBeInTheDocument();
		expect(screen.getByText("Row errors (1)")).toBeInTheDocument();
	});
});
