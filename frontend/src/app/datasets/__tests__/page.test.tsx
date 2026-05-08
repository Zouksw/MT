/**
 * Tests for Datasets list page
 */

import { render, screen } from "@testing-library/react";
import type React from "react";
import "@testing-library/jest-dom";

// Mock API hooks
jest.mock("@/lib/api", () => ({
	useList: () => ({
		data: [
			{
				id: "ds-1",
				name: "Temperature Data",
				description: "Sensor readings",
				storageFormat: "CSV",
				rowsCount: 1000,
				_count: { timeseries: 3 },
				createdAt: "2024-01-01T00:00:00Z",
				isPublic: true,
				isImported: false,
			},
			{
				id: "ds-2",
				name: "Pressure Data",
				description: "Pressure sensor",
				storageFormat: "TIMESERIES",
				rowsCount: 500,
				_count: { timeseries: 1 },
				createdAt: "2024-01-02T00:00:00Z",
				isPublic: false,
				isImported: true,
			},
		],
		loading: false,
		error: null,
	}),
	deleteRecord: jest.fn(),
}));

// Mock layout/components
jest.mock("@/components/ui/PageHeader", () => ({
	PageHeader: ({
		title,
		description,
		actions,
	}: {
		title: string;
		description: string;
		actions?: React.ReactNode;
	}) => (
		<div data-testid="page-header">
			<h1>{title}</h1>
			<p>{description}</p>
			{actions}
		</div>
	),
}));

jest.mock("@/lib/responsive-utils", () => ({
	useIsMobile: jest.fn(() => false),
}));

jest.mock("@/components/ui/Toast", () => ({
	useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

import DatasetsList from "../page";

describe("DatasetsList", () => {
	it("should render page header", () => {
		render(<DatasetsList />);
		expect(screen.getAllByText("Datasets").length).toBeGreaterThan(0);
	});
});
