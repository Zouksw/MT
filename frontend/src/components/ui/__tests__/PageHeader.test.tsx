/**
 * Tests for PageHeader component
 */

import { render, screen } from "@testing-library/react";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
	it("should render title", () => {
		render(<PageHeader title="Dashboard" />);
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("should render title and description", () => {
		render(<PageHeader title="Dashboard" description="Overview of your data" />);
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("Overview of your data")).toBeInTheDocument();
	});

	it("should not render description when not provided", () => {
		render(<PageHeader title="Dashboard" />);
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("should render breadcrumbs when provided", () => {
		const breadcrumbItems = [
			{ label: "Home", href: "/" },
			{ label: "Settings", href: "/settings" },
		];

		render(<PageHeader title="Dashboard" breadcrumbs={breadcrumbItems} />);
		expect(screen.getByText("Home")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("should not render breadcrumbs when not provided", () => {
		const { container } = render(<PageHeader title="Dashboard" />);
		const breadcrumbNav = container.querySelector("nav");
		expect(breadcrumbNav).not.toBeInTheDocument();
	});

	it("should render action buttons", () => {
		render(<PageHeader title="Dashboard" actions={<button>Create New</button>} />);
		expect(screen.getByText("Create New")).toBeInTheDocument();
	});

	it("should render both breadcrumbs and actions", () => {
		render(
			<PageHeader
				title="Dashboard"
				description="Overview"
				breadcrumbs={[{ label: "Home", href: "/" }]}
				actions={<button>Action</button>}
			/>,
		);
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("Overview")).toBeInTheDocument();
		expect(screen.getByText("Home")).toBeInTheDocument();
		expect(screen.getByText("Action")).toBeInTheDocument();
	});

	it("should have mb-6 wrapper class", () => {
		const { container } = render(<PageHeader title="Dashboard" />);
		const header = container.querySelector(".mb-6");
		expect(header).toBeInTheDocument();
	});
});
