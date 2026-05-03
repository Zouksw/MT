import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
	it("should render title and value", () => {
		render(<StatCard title="Total Users" value={1234} />);
		expect(screen.getByText("Total Users")).toBeInTheDocument();
		expect(screen.getByText("0")).toBeInTheDocument();
	});

	it("should render string value", () => {
		render(<StatCard title="Status" value="Active" />);
		expect(screen.getByText("Active")).toBeInTheDocument();
	});

	it("should render icon when provided", () => {
		const { container } = render(
			<StatCard title="Database" value={100} icon={<span data-testid="icon">DB</span>} />,
		);
		expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
	});

	it("should render trend indicator with positive value", () => {
		render(<StatCard title="Revenue" value={50000} trend={{ value: 12.5, isPositive: true }} />);
		expect(screen.getByText("+12.5%")).toBeInTheDocument();
	});

	it("should render trend indicator with negative value", () => {
		render(<StatCard title="Expenses" value={3000} trend={{ value: 5.2, isPositive: false }} />);
		expect(screen.getByText("5.2%")).toBeInTheDocument();
	});

	it("should render trend indicator with zero value", () => {
		render(<StatCard title="Steady" value={100} trend={{ value: 0, isPositive: true }} />);
		expect(screen.getByText("+0%")).toBeInTheDocument();
	});

	it("should show loading state", () => {
		const { container } = render(<StatCard title="Loading" value={0} loading={true} />);
		expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
	});

	it("should call onClick handler when clicked", () => {
		const handleClick = jest.fn();
		const { container } = render(<StatCard title="Clickable" value={100} onClick={handleClick} />);
		const card = container.querySelector('[class*="cursor-pointer"]') as HTMLElement;
		card?.click();
		expect(handleClick).toHaveBeenCalledTimes(1);
	});
});
