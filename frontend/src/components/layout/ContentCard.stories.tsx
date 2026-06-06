import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { ContentCard } from "./ContentCard";

const meta: Meta<typeof ContentCard> = {
	title: "Layout/ContentCard",
	component: ContentCard,
	tags: ["autodocs"],
	argTypes: {
		title: { control: "text" },
		subtitle: { control: "text" },
		accent: { control: "boolean" },
		loading: { control: "boolean" },
		hoverable: { control: "boolean" },
	},
};

export default meta;
type Story = StoryObj<typeof ContentCard>;

export const Default: Story = {
	args: { children: <p>This is a basic content card with some placeholder content.</p> },
};

export const WithTitle: Story = {
	args: {
		title: "Recent Activity",
		children: (
			<div className="flex flex-wrap gap-2">
				<Tag color="primary">Dataset Created</Tag>
				<Tag color="success">Import Complete</Tag>
				<Tag color="warning">Alert Triggered</Tag>
			</div>
		),
	},
};

export const WithSubtitle: Story = {
	args: {
		title: "System Overview",
		subtitle: "Last updated 5 minutes ago",
		children: <p>Cards support both title and subtitle for additional context.</p>,
	},
};

export const WithAccent: Story = {
	args: {
		title: "Featured Dataset",
		accent: true,
		children: <p>This card has a gradient accent strip at the top.</p>,
	},
};

export const WithActions: Story = {
	args: {
		title: "Time Series Data",
		actions: (
			<div className="flex gap-2">
				<Button size="sm" variant="ghost">
					Settings
				</Button>
				<Button size="sm" variant="ghost">
					More
				</Button>
			</div>
		),
		children: <p>Card headers support action buttons aligned to the right.</p>,
	},
};

export const FullFeatured: Story = {
	args: {
		title: "Data Summary",
		subtitle: "Aggregated statistics for the selected time range",
		accent: true,
		actions: (
			<div className="flex gap-2">
				<Button size="sm" variant="ghost">
					Refresh
				</Button>
				<Button size="sm" variant="primary">
					Export
				</Button>
			</div>
		),
		children: (
			<div className="grid grid-cols-2 gap-4">
				<div>
					<span className="text-xs text-gray-500">Total Points</span>
					<div className="text-2xl font-semibold">1.2M</div>
				</div>
				<div>
					<span className="text-xs text-gray-500">Anomalies</span>
					<div className="text-2xl font-semibold text-red-500">23</div>
				</div>
				<div>
					<span className="text-xs text-gray-500">Uptime</span>
					<div className="text-2xl font-semibold text-emerald-500">99.9%</div>
				</div>
			</div>
		),
	},
};
