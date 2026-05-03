/**
 * Tests for TimeframeSelector component
 */

import { fireEvent, render, screen } from "@testing-library/react";
import TimeframeSelector from "../TimeframeSelector";

describe("TimeframeSelector", () => {
	it("should render three timeframe buttons", () => {
		render(<TimeframeSelector value="daily" onChange={jest.fn()} />);

		expect(screen.getByText("日")).toBeInTheDocument();
		expect(screen.getByText("周")).toBeInTheDocument();
		expect(screen.getByText("月")).toBeInTheDocument();
	});

	it("should highlight the active timeframe", () => {
		render(<TimeframeSelector value="daily" onChange={jest.fn()} />);

		const dailyBtn = screen.getByText("日").closest("button")!;
		expect(dailyBtn.className).toContain("bg-[#171717]");
	});

	it("should call onChange when clicking a different timeframe", () => {
		const onChange = jest.fn();
		render(<TimeframeSelector value="daily" onChange={onChange} />);

		fireEvent.click(screen.getByText("周"));

		expect(onChange).toHaveBeenCalledWith("weekly");
	});

	it("should call onChange with monthly", () => {
		const onChange = jest.fn();
		render(<TimeframeSelector value="daily" onChange={onChange} />);

		fireEvent.click(screen.getByText("月"));

		expect(onChange).toHaveBeenCalledWith("monthly");
	});

	it("should not call onChange when clicking the active timeframe", () => {
		const onChange = jest.fn();
		render(<TimeframeSelector value="daily" onChange={onChange} />);

		fireEvent.click(screen.getByText("日"));

		expect(onChange).toHaveBeenCalledWith("daily");
	});

	it("should apply active style to weekly when selected", () => {
		render(<TimeframeSelector value="weekly" onChange={jest.fn()} />);

		const weeklyBtn = screen.getByText("周").closest("button")!;
		expect(weeklyBtn.className).toContain("bg-[#171717]");
	});
});
