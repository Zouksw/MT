/**
 * Tests for ContentCard component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ContentCard } from '../ContentCard';

// Mock Ant Design theme
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  theme: {
    useToken: () => ({
      token: {
        marginLG: 24,
        marginMD: 16,
        marginXS: 8,
        marginSM: 12,
        fontSize: 14,
        fontSizeSM: 12,
        fontSizeLG: 16,
        colorText: '#000000',
        colorTextSecondary: '#666666',
      },
    }),
  },
}));

describe('ContentCard', () => {
  it('should render children content', () => {
    render(
      <ContentCard>
        <p>Card content here</p>
      </ContentCard>
    );

    expect(screen.getByText('Card content here')).toBeInTheDocument();
  });

  it('should show title when provided', () => {
    render(
      <ContentCard title="Test Card">
        <p>Content</p>
      </ContentCard>
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('should not show title element when not provided', () => {
    const { container } = render(
      <ContentCard>
        <p>Content</p>
      </ContentCard>
    );

    // The card body should exist but no colored dot / title prefix
    const dot = container.querySelector('[style*="border-radius: 50%"]');
    expect(dot).not.toBeInTheDocument();
  });

  it('should show subtitle when provided', () => {
    render(
      <ContentCard title="Test Card" subtitle="A subtitle">
        <p>Content</p>
      </ContentCard>
    );

    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('should show actions when provided', () => {
    render(
      <ContentCard title="Test Card" actions={<button>Edit</button>}>
        <p>Content</p>
      </ContentCard>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('should render multiple children', () => {
    render(
      <ContentCard>
        <p>First child</p>
        <p>Second child</p>
      </ContentCard>
    );

    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
  });

  it('should apply content-card class', () => {
    const { container } = render(
      <ContentCard>
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.content-card');
    expect(card).toBeInTheDocument();
  });

  it('should apply accent variant class when accent is true', () => {
    const { container } = render(
      <ContentCard accent={true}>
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.content-card--accent');
    expect(card).toBeInTheDocument();
  });

  it('should not apply accent variant when accent is false (default)', () => {
    const { container } = render(
      <ContentCard>
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.content-card--accent');
    expect(card).not.toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { container } = render(
      <ContentCard loading={true}>
        <p>Content</p>
      </ContentCard>
    );

    const skeleton = container.querySelector('.ant-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(
      <ContentCard className="custom-class">
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('should render colored dot prefix when title is present', () => {
    const { container } = render(
      <ContentCard title="Test">
        <p>Content</p>
      </ContentCard>
    );

    // The colored dot has border-radius: 50% and background: #0066CC
    const dot = container.querySelector('[style*="border-radius: 50%"]');
    expect(dot).toBeInTheDocument();
  });
});
