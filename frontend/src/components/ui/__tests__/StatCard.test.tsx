/**
 * Tests for StatCard component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';
import { DatabaseOutlined } from '@ant-design/icons';

// Mock Ant Design theme
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  theme: {
    useToken: () => ({
      token: {
        colorBorder: '#d9d9d9',
        colorText: '#000000',
        colorTextSecondary: '#666666',
        colorPrimary: '#1890ff',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        borderRadiusLG: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        marginXS: 8,
        marginSM: 12,
        fontSize: 14,
        fontSizeSM: 12,
        fontSizeLG: 16,
      },
    }),
  },
}));

describe('StatCard', () => {
  it('should render title and value', () => {
    render(<StatCard title="Total Users" value={1234} />);

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    // Value animates from 0, so we check it renders a number (starts at 0)
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render string value', () => {
    render(<StatCard title="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const { container } = render(
      <StatCard title="Database" value={100} icon={<DatabaseOutlined />} />
    );

    const icon = container.querySelector('.anticon');
    expect(icon).toBeInTheDocument();
  });

  it('should render trend indicator with positive value', () => {
    render(
      <StatCard
        title="Revenue"
        value={50000}
        trend={{ value: 12.5, isPositive: true }}
      />
    );

    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('should render trend indicator with negative value', () => {
    render(
      <StatCard
        title="Expenses"
        value={3000}
        trend={{ value: 5.2, isPositive: false }}
      />
    );

    // isPositive=false shows down arrow, but value is still positive number
    expect(screen.getByText('5.2%')).toBeInTheDocument();
  });

  it('should render trend indicator with zero value', () => {
    render(
      <StatCard
        title="Steady"
        value={100}
        trend={{ value: 0, isPositive: true }}
      />
    );

    expect(screen.getByText('+0%')).toBeInTheDocument();
  });

  it('should apply variant class', () => {
    const { container } = render(
      <StatCard title="Test" value={100} variant="success" />
    );

    const card = container.querySelector('.stat-card--success');
    expect(card).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { container } = render(
      <StatCard title="Loading" value={0} loading={true} />
    );

    const skeleton = container.querySelector('.ant-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('should call onClick handler when clicked', () => {
    const handleClick = jest.fn();

    const { container } = render(
      <StatCard title="Clickable" value={100} onClick={handleClick} />
    );

    const card = container.querySelector('.stat-card') as HTMLElement;
    card.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not be clickable when onClick is not provided', () => {
    const { container } = render(
      <StatCard title="Static" value={100} />
    );

    const card = container.querySelector('.ant-card-hoverable');
    expect(card).not.toBeInTheDocument();
  });
});
