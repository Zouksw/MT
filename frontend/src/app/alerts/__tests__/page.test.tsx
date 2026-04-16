/**
 * Tests for Alerts page
 *
 * Tests alert list rendering, stats display, tab filtering, and action buttons.
 * Uses MSW for API mocking.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock authFetch
jest.mock('@/utils/auth', () => ({
  authFetch: jest.fn(),
}));

// Mock layout components
jest.mock('@/components/layout/PageContainer', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

jest.mock('@/components/ui/PageHeader', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}));

jest.mock('@/components/tables/DataTable', () => ({
  DataTable: ({ dataSource }: { dataSource: any[] }) => (
    <div data-testid="data-table">
      {dataSource.map((d: any) => (
        <div key={d.id} data-testid={`alert-${d.id}`}>
          <span>{d.message}</span>
          <span>{d.severity}</span>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/components/layout/ContentCard', () => ({
  ContentCard: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid={`content-card-${title || 'default'}`}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/data/DataPageStats', () => ({
  DataPageStats: ({ items }: { items: Array<{ label: string; value: number }> }) => (
    <div data-testid="data-page-stats">
      {items.map((item) => (
        <span key={item.label} data-testid={`stat-${item.label}`}>{item.label}: {item.value}</span>
      ))}
    </div>
  ),
}));

jest.mock('@/lib/responsive-utils', () => ({
  useIsMobile: jest.fn(() => false),
}));

import { authFetch } from '@/utils/auth';
import AlertList from '../page';

const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

const sampleAlerts = [
  {
    id: 'alert-1',
    type: 'ANOMALY',
    severity: 'ERROR',
    message: 'High temperature detected',
    isRead: false,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'alert-2',
    type: 'FORECAST_READY',
    severity: 'INFO',
    message: 'Forecast completed',
    isRead: true,
    createdAt: '2024-01-14T10:00:00Z',
  },
  {
    id: 'alert-3',
    type: 'SYSTEM',
    severity: 'WARNING',
    message: 'Disk space low',
    isRead: false,
    createdAt: '2024-01-13T10:00:00Z',
  },
];

const sampleStats = {
  total: 15,
  unread: 8,
  bySeverity: { INFO: 5, WARNING: 6, ERROR: 4 },
  byType: { ANOMALY: 7, FORECAST_READY: 5, SYSTEM: 3 },
};

describe('AlertList', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    // Default mock responses
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sampleStats),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ alerts: sampleAlerts }),
      } as any);
    });
  });

  it('should render page header', async () => {
    render(<AlertList />);

    expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();
    expect(screen.getByText('View and manage system alerts, anomalies, and notifications')).toBeInTheDocument();
  });

  it('should render stats when loaded', async () => {
    render(<AlertList />);

    await waitFor(() => {
      expect(screen.getByTestId('stat-Total Alerts')).toHaveTextContent('15');
      expect(screen.getByTestId('stat-Unread')).toHaveTextContent('8');
    });
  });

  it('should render alerts table after loading', async () => {
    render(<AlertList />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  it('should render filter controls', async () => {
    render(<AlertList />);

    await waitFor(() => {
      expect(screen.getByText('Filter by:')).toBeInTheDocument();
    });
  });

  it('should render tab navigation', async () => {
    render(<AlertList />);

    await waitFor(() => {
      expect(screen.getByText(/All Alerts/)).toBeInTheDocument();
    });
  });

  it('should render refresh button', async () => {
    render(<AlertList />);

    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('should show Mark All Read button when there are unread alerts', async () => {
    render(<AlertList />);

    await waitFor(() => {
      expect(screen.getByText('Mark All Read')).toBeInTheDocument();
    });
  });

  it('should handle fetch error gracefully', async () => {
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    render(<AlertList />);

    // Should not crash, just show empty state
    await waitFor(() => {
      expect(screen.getByText(/No alerts found/)).toBeInTheDocument();
    });
  });

  it('should show no alerts message when list is empty', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ total: 0, unread: 0, bySeverity: {}, byType: {} }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ alerts: [] }),
      } as any);
    });

    render(<AlertList />);

    await waitFor(() => {
      expect(screen.getByText('No alerts found')).toBeInTheDocument();
    });
  });
});
