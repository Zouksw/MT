/**
 * Tests for ContentCard component
 */

import { render, screen } from '@testing-library/react';
import { ContentCard } from '../ContentCard';

// No antd mock needed — ContentCard uses Tailwind

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

    // No title dot element when title is absent
    const dot = container.querySelector('.rounded-full');
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

  it('should apply bg-card class', () => {
    const { container } = render(
      <ContentCard>
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.bg-card');
    expect(card).toBeInTheDocument();
  });

  it('should apply accent border when accent is true', () => {
    const { container } = render(
      <ContentCard accent={true}>
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.border-t-2');
    expect(card).toBeInTheDocument();
  });

  it('should not apply accent border when accent is false (default)', () => {
    const { container } = render(
      <ContentCard>
        <p>Content</p>
      </ContentCard>
    );

    const card = container.querySelector('.border-t-2');
    expect(card).not.toBeInTheDocument();
  });

  it('should render children even when loading prop is set (prop accepted but not yet implemented)', () => {
    render(
      <ContentCard loading={true}>
        <p>Content</p>
      </ContentCard>
    );

    // loading prop is accepted in the interface but not yet implemented
    expect(screen.getByText('Content')).toBeInTheDocument();
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

    // The colored dot has rounded-full class
    const dot = container.querySelector('.rounded-full');
    expect(dot).toBeInTheDocument();
  });
});
