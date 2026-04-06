/**
 * Tests for PageHeader component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

// Mock Ant Design theme
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  theme: {
    useToken: () => ({
      token: {
        marginLG: 24,
        marginMD: 16,
        marginSM: 12,
        fontSizeHeading3: 24,
        fontSizeSM: 14,
        fontSizeLG: 16,
        colorText: '#000000',
        colorTextSecondary: '#666666',
      },
    }),
  },
}));

describe('PageHeader', () => {
  it('should render title', () => {
    render(<PageHeader title="Dashboard" />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render title and description', () => {
    render(
      <PageHeader title="Dashboard" description="Overview of your data" />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Overview of your data')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    render(<PageHeader title="Dashboard" />);

    // The header div should exist but no description text
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render breadcrumbs when provided', () => {
    const breadcrumbItems = [
      { title: 'Home', href: '/' },
      { title: 'Settings', href: '/settings' },
    ];

    render(<PageHeader title="Dashboard" breadcrumbs={breadcrumbItems} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should not render breadcrumbs when not provided', () => {
    const { container } = render(<PageHeader title="Dashboard" />);

    // antd Breadcrumb renders a nav element
    const breadcrumbNav = container.querySelector('nav');
    expect(breadcrumbNav).not.toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(
      <PageHeader
        title="Dashboard"
        actions={<button>Create New</button>}
      />
    );

    expect(screen.getByText('Create New')).toBeInTheDocument();
  });

  it('should render both breadcrumbs and actions', () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Overview"
        breadcrumbs={[{ title: 'Home', href: '/' }]}
        actions={<button>Action</button>}
      />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('should have fade-in animation class', () => {
    const { container } = render(<PageHeader title="Dashboard" />);

    const header = container.querySelector('.page-transition-fade-in');
    expect(header).toBeInTheDocument();
  });

  it('should have page-header class', () => {
    const { container } = render(<PageHeader title="Dashboard" />);

    const header = container.querySelector('.page-header');
    expect(header).toBeInTheDocument();
  });

  it('should render home icon when showBackButton is true', () => {
    const { container } = render(
      <PageHeader title="Dashboard" showBackButton={true} />
    );

    // HomeOutlined renders an anticon with class anticon-home
    const homeIcon = container.querySelector('.anticon-home');
    expect(homeIcon).toBeInTheDocument();
  });

  it('should not render home icon when showBackButton is false (default)', () => {
    const { container } = render(<PageHeader title="Dashboard" />);

    const homeIcon = container.querySelector('.anticon-home');
    expect(homeIcon).not.toBeInTheDocument();
  });
});
