import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
	title: "UI/EmptyState",
	component: EmptyState,
	tags: ["autodocs"],
	argTypes: {
		type: {
			control: "select",
			options: [
				"default",
				"data",
				"datasets",
				"timeseries",
				"alerts",
				"anomalies",
				"forecasts",
				"errors",
				"search",
			],
		},
	},
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
	args: {
		type: "default",
	},
};

export const WithAction: Story = {
	args: {
		type: "data",
		actionText: "Add Data",
		onAction: fn(),
	},
};

export const NoData: Story = {
	args: {
		type: "data",
	},
};

export const NoDatasets: Story = {
	args: {
		type: "datasets",
		actionText: "Create Dataset",
		onAction: fn(),
	},
};

export const NoTimeseries: Story = {
	args: {
		type: "timeseries",
		actionText: "Create Time Series",
		onAction: fn(),
	},
};

export const NoAlerts: Story = {
	args: {
		type: "alerts",
	},
};

export const NoAnomalies: Story = {
	args: {
		type: "anomalies",
	},
};

export const NoForecasts: Story = {
	args: {
		type: "forecasts",
		actionText: "Create Forecast",
		onAction: fn(),
	},
};

export const NoErrors: Story = {
	args: {
		type: "errors",
	},
};

export const NoSearchResults: Story = {
	args: {
		type: "search",
	},
};

export const CustomText: Story = {
	args: {
		type: "default",
		title: "Custom Title",
		description: "A custom description for the empty state component.",
	},
};

export const AllTypes: Story = {
	render: () => (
		<div
			style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1200 }}
		>
			<EmptyState type="default" />
			<EmptyState type="data" />
			<EmptyState type="datasets" />
			<EmptyState type="timeseries" />
			<EmptyState type="alerts" />
			<EmptyState type="anomalies" />
			<EmptyState type="forecasts" />
			<EmptyState type="errors" />
			<EmptyState type="search" />
		</div>
	),
};
