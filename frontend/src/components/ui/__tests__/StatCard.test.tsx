import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
	it("should render title and value", () => {
		render(<StatCard title="Total Users" value={1234} />);
		expect(screen.getByText("Total Users")).toBeInTheDocument();
		// In jsdom the count-up animation is skipped (non-native rAF), so the
		// final target value renders synchronously.
		expect(screen.getByText("1234")).toBeInTheDocument();
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

	// Trend indicator: three sign variants collapsed to one it.each (positive
	// shows +N%, negative shows N% with a down indicator, zero shows +0%).
	it.each([
		["positive", 12.5, true, "+12.5%"],
		["negative", 5.2, false, "5.2%"],
		["zero", 0, true, "+0%"],
	])("renders trend indicator with %s value", (_label, value, isPositive, expected) => {
		render(<StatCard title="Trend" value={100} trend={{ value, isPositive }} />);
		expect(screen.getByText(expected)).toBeInTheDocument();
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

	it("should render suffix after the value when provided", () => {
		render(<StatCard title="Detection Rate" value="98.5" suffix="%" />);
		expect(screen.getByText("98.5")).toBeInTheDocument();
		expect(screen.getByText("%")).toBeInTheDocument();
	});

	it("should omit suffix when not provided", () => {
		render(<StatCard title="Count" value={42} />);
		expect(screen.getByText("42")).toBeInTheDocument();
		expect(screen.queryByText("%")).not.toBeInTheDocument();
	});
});
