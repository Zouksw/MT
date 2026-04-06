import type { Meta, StoryObj } from '@storybook/react';
import { Button, Space } from 'antd';
import { PlusOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { PageHeader } from './PageHeader';

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

export const Default: Story = {
  args: {
    title: 'Dashboard',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'Datasets',
    description: 'Manage and explore your time series datasets.',
  },
};

export const WithBreadcrumbs: Story = {
  args: {
    title: 'Dataset Details',
    description: 'Viewing dataset configuration and data points.',
    breadcrumbs: [
      { title: 'Home', href: '/' },
      { title: 'Datasets', href: '/datasets' },
      { title: 'Details' },
    ],
  },
};

export const WithActions: Story = {
  args: {
    title: 'Time Series',
    description: 'Monitor and analyze your time series data in real time.',
    actions: (
      <Space>
        <Button icon={<DownloadOutlined />}>Export</Button>
        <Button type="primary" icon={<PlusOutlined />}>Add Series</Button>
      </Space>
    ),
  },
};

export const WithBackButton: Story = {
  args: {
    title: 'Settings',
    description: 'Configure application preferences.',
    showBackButton: true,
    breadcrumbs: [
      { title: 'Admin', href: '/admin' },
      { title: 'Settings' },
    ],
  },
};

export const FullFeatured: Story = {
  args: {
    title: 'Anomaly Detection',
    description: 'AI-powered anomaly detection across all your time series data sources.',
    breadcrumbs: [
      { title: 'Home', href: '/' },
      { title: 'Analytics', href: '/analytics' },
      { title: 'Anomalies' },
    ],
    actions: (
      <Space>
        <Button icon={<SettingOutlined />}>Configure</Button>
        <Button icon={<DownloadOutlined />}>Export</Button>
        <Button type="primary" icon={<PlusOutlined />}>Run Detection</Button>
      </Space>
    ),
    showBackButton: false,
  },
};
