import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from './PageHeader';
import { Button } from './Button';

const meta: Meta<typeof PageHeader> = {
  title: 'UI/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    showBackButton: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = { args: { title: 'Dashboard' } };
export const WithDescription: Story = { args: { title: 'Datasets', description: 'Manage and explore your time series datasets.' } };

export const WithBreadcrumbs: Story = {
  args: {
    title: 'Dataset Details',
    description: 'Viewing dataset configuration and data points.',
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Datasets', href: '/datasets' },
      { label: 'Details' },
    ],
  },
};

export const WithActions: Story = {
  args: {
    title: 'Time Series',
    description: 'Monitor and analyze your time series data in real time.',
    actions: (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost">Export</Button>
        <Button variant="primary">Add Series</Button>
      </div>
    ),
  },
};

export const FullFeatured: Story = {
  args: {
    title: 'Anomaly Detection',
    description: 'AI-powered anomaly detection across all your time series data sources.',
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Analytics', href: '/analytics' },
      { label: 'Anomalies' },
    ],
    actions: (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost">Configure</Button>
        <Button variant="primary">Run Detection</Button>
      </div>
    ),
  },
};
