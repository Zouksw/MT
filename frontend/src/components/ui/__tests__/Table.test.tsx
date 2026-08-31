import { render, screen } from "@testing-library/react";
import { type Column, Table } from "@/components/ui/Table";

interface Row {
	id: string;
	title: string;
	status: string;
}

const rows: Row[] = [
	{
		id: "1",
		title: "Declaring a National Emergency To Secure the United States Bulk-Power System",
		status: "live",
	},
];

const columns: Column<Row>[] = [
	{ key: "title", title: "Title", dataIndex: "title", wrap: true },
	{ key: "status", title: "Status", dataIndex: "status" },
];

describe("ui/Table", () => {
	it("wrap columns drop whitespace-nowrap so long titles wrap instead of overflowing into the next cell", () => {
		// Design-optimization batch A (2026-08-31): the market-news title pill
		// overlap came from a blanket whitespace-nowrap on every td — the long
		// title painted straight through the category column.
		render(<Table columns={columns} dataSource={rows} rowKey="id" />);
		const titleCell = screen.getByText(/Bulk-Power System/).closest("td");
		expect(titleCell).not.toHaveClass("whitespace-nowrap");
		const statusCell = screen.getByText("live").closest("td");
		expect(statusCell).toHaveClass("whitespace-nowrap");
	});

	it("renders the empty state when there are no rows", () => {
		render(<Table columns={columns} dataSource={[]} rowKey="id" emptyText="Nothing here" />);
		expect(screen.getByText("Nothing here")).toBeInTheDocument();
	});
});
