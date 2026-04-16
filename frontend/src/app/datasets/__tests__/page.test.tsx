/**
 * Tests for Datasets list page
 *
 * Tests page rendering with mocked refine hooks, stat display, and table.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock refine hooks
jest.mock('@refinedev/antd', () => ({
  useTable: () => ({
    tableProps: {
      dataSource: [
        { id: 'ds-1', name: 'Temperature Data', description: 'Sensor readings', storageFormat: 'CSV', rowsCount: 1000, _count: { timeseries: 3 }, createdAt: '2024-01-01T00:00:00Z', isPublic: true, isImported: false },
        { id: 'ds-2', name: 'Pressure Data', description: 'Pressure sensor', storageFormat: 'IOTDB', rowsCount: 500, _count: { timeseries: 1 }, createdAt: '2024-01-02T00:00:00Z', isPublic: false, isImported: true },
      ],
      pagination: { current: 1, pageSize: 20, total: 2 },
      loading: false,
    },
  }),
  List: ({ children }: { children: React.ReactNode }) => <div data-testid="refine-list">{children}</div>,
  DateField: ({ value }: { value: string }) => <span>{value?.split('T')[0]}</span>,
  ShowButton: ({ recordItemId }: { recordItemId: string }) => <button data-testid={`show-${recordItemId}`}>Show</button>,
  EditButton: ({ recordItemId }: { recordItemId: string }) => <button data-testid={`edit-${recordItemId}`}>Edit</button>,
  DeleteButton: ({ recordItemId }: { recordItemId: string }) => <button data-testid={`delete-${recordItemId}`}>Delete</button>,
  CreateButton: ({ children }: { children: React.ReactNode }) => <button data-testid="create-btn">{children}</button>,
}));

jest.mock('@refinedev/core', () => ({
  useList: () => ({
    result: {
      data: [
        { id: 'ds-1', name: 'Temperature Data', isPublic: true, isImported: false },
        { id: 'ds-2', name: 'Pressure Data', isPublic: false, isImported: true },
      ],
    },
  }),
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
        <div key={d.id} data-testid={`row-${d.id}`}>
          <span>{d.name}</span>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/components/ui/MobileStatsCard', () => ({
  ResponsiveStats: ({ items }: { items: Array<{ label: string; value: number }> }) => (
    <div data-testid="responsive-stats">
      {items.map((item) => (
        <span key={item.label} data-testid={`stat-${item.label}`}>{item.label}: {item.value}</span>
      ))}
    </div>
  ),
}));

jest.mock('@/lib/responsive-utils', () => ({
  useIsMobile: jest.fn(() => false),
}));

import DatasetsList from '../page';

describe('DatasetsList', () => {
  it('should render page header', () => {
    render(<DatasetsList />);

    expect(screen.getByText('Datasets')).toBeInTheDocument();
    expect(screen.getByText('Manage your time series datasets')).toBeInTheDocument();
  });

  it('should render dataset stats', () => {
    render(<DatasetsList />);

    expect(screen.getByTestId('stat-Total Datasets')).toHaveTextContent('2');
  });

  it('should render data table with datasets', () => {
    render(<DatasetsList />);

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByTestId('row-ds-1')).toHaveTextContent('Temperature Data');
    expect(screen.getByTestId('row-ds-2')).toHaveTextContent('Pressure Data');
  });

  it('should render create button', () => {
    render(<DatasetsList />);

    expect(screen.getByTestId('create-btn')).toBeInTheDocument();
  });
});
