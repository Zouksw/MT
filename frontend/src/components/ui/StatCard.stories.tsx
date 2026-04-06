import type { Meta, StoryObj } from '@storybook/react';
import { DatabaseOutlined, TeamOutlined, AlertOutlined, RiseOutlined } from '@ant-design/icons';
import { StatCard } from './StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'UI/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'error'],
    },
    loading: { control: 'boolean' },
    value: { control: 'number' },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    title: 'Total Users',
    value: 42,
    variant: 'default',
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Datasets',
    value: 1234,
    icon: <DatabaseOutlined />,
    variant: 'success',
  },
};

export const WithTrend: Story = {
  args: {
    title: 'Revenue',
    value: 98500,
    variant: 'primary',
    trend: { value: 12.5, isPositive: true },
    icon: <RiseOutlined />,
  },
};

export const NegativeTrend: Story = {
  args: {
    title: 'Error Rate',
    value: 3.2,
    variant: 'error',
    trend: { value: 2.1, isPositive: false },
  },
};

export const WithSparkline: Story = {
  args: {
    title: 'Active Users',
    value: 847,
    variant: 'primary',
    sparklineData: [120, 200, 150, 280, 320, 410, 380, 520, 600, 750, 847],
    icon: <TeamOutlined />,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 800 }}>
      <StatCard title="Default" value={42} variant="default" />
      <StatCard title="Primary" value={128} variant="primary" />
      <StatCard title="Success" value={256} variant="success" />
      <StatCard title="Warning" value={99} variant="warning" />
      <StatCard title="Error" value={7} variant="error" />
      <StatCard title="With Icon" value={500} variant="primary" icon={<AlertOutlined />} />
    </div>
  ),
};

export const Loading: Story = {
  args: {
    title: 'Total Users',
    value: 42,
    variant: 'default',
    loading: true,
  },
};

export const StringValue: Story = {
  args: {
    title: 'Status',
    value: 'Online',
    variant: 'success',
  },
};
