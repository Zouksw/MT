import type { Meta, StoryObj } from '@storybook/react';
import { Button, Space, Typography, Tag } from 'antd';
import { SettingOutlined, MoreOutlined } from '@ant-design/icons';
import { ContentCard } from './ContentCard';

const meta: Meta<typeof ContentCard> = {
  title: 'Layout/ContentCard',
  component: ContentCard,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    accent: { control: 'boolean' },
    loading: { control: 'boolean' },
    hoverable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ContentCard>;

export const Default: Story = {
  args: {
    children: (
      <Typography.Text>
        This is a basic content card with some placeholder content. Use it to wrap
        any content that needs a consistent card container.
      </Typography.Text>
    ),
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Recent Activity',
    children: (
      <div>
        <Typography.Paragraph>
          Display your content here with a descriptive title above.
        </Typography.Paragraph>
        <Space wrap>
          <Tag color="blue">Dataset Created</Tag>
          <Tag color="green">Import Complete</Tag>
          <Tag color="orange">Alert Triggered</Tag>
        </Space>
      </div>
    ),
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'System Overview',
    subtitle: 'Last updated 5 minutes ago',
    children: (
      <Typography.Text>
        Cards support both title and subtitle for additional context.
      </Typography.Text>
    ),
  },
};

export const WithAccent: Story = {
  args: {
    title: 'Featured Dataset',
    accent: true,
    children: (
      <Typography.Text>
        This card has a gradient accent strip at the top for visual emphasis.
      </Typography.Text>
    ),
  },
};

export const WithActions: Story = {
  args: {
    title: 'Time Series Data',
    actions: (
      <Space>
        <Button size="small" icon={<SettingOutlined />} />
        <Button size="small" icon={<MoreOutlined />} />
      </Space>
    ),
    children: (
      <Typography.Text>
        Card headers support action buttons aligned to the right.
      </Typography.Text>
    ),
  },
};

export const Loading: Story = {
  args: {
    title: 'Loading Card',
    loading: true,
    children: (
      <Typography.Text>This content is hidden while loading.</Typography.Text>
    ),
  },
};

export const FullFeatured: Story = {
  args: {
    title: 'Data Summary',
    subtitle: 'Aggregated statistics for the selected time range',
    accent: true,
    actions: (
      <Space>
        <Button size="small">Refresh</Button>
        <Button size="small" type="primary">Export</Button>
      </Space>
    ),
    children: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Total Points</Typography.Text>
          <div><Typography.Text strong style={{ fontSize: 24 }}>1.2M</Typography.Text></div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Anomalies</Typography.Text>
          <div><Typography.Text strong style={{ fontSize: 24, color: '#EF4444' }}>23</Typography.Text></div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Uptime</Typography.Text>
          <div><Typography.Text strong style={{ fontSize: 24, color: '#10B981' }}>99.9%</Typography.Text></div>
        </div>
      </div>
    ),
  },
};
