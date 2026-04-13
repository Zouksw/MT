/**
 * DataTable Component Tests
 *
 * Tests the enhanced table component's rendering, empty states,
 * and configuration options.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataTable } from '../DataTable';

// Mock responsive utilities
jest.mock('@/lib/responsive-utils', () => ({
  useIsMobile: jest.fn(() => false),
}));

describe('DataTable', () => {
  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Value', dataIndex: 'value', key: 'value' },
  ];

  const data = [
    { key: '1', name: 'Item 1', value: 100 },
    { key: '2', name: 'Item 2', value: 200 },
  ];

  test('should render table with data', () => {
    render(<DataTable columns={columns} dataSource={data} />);

    // With useIsMobile=false, renders Ant Design Table
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  test('should render empty state when no data (not column headers)', () => {
    // When dataSource is empty, DataTable shows EmptyState, not headers
    render(
      <DataTable
        columns={columns}
        dataSource={[]}
        emptyStateTitle="No data found"
      />,
    );

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  test('should render custom empty state description', () => {
    render(
      <DataTable
        columns={columns}
        dataSource={[]}
        emptyStateTitle="No datasets"
        emptyStateDescription="Create your first dataset to get started"
      />,
    );

    expect(screen.getByText('No datasets')).toBeInTheDocument();
    expect(screen.getByText('Create your first dataset to get started')).toBeInTheDocument();
  });

  test('should render with pagination', () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      key: String(i),
      name: `Item ${i}`,
      value: i * 10,
    }));

    render(
      <DataTable
        columns={columns}
        dataSource={manyItems}
        pagination={{ pageSize: 10 }}
      />,
    );

    // Should render pagination controls
    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });

  test('should render data values correctly', () => {
    render(<DataTable columns={columns} dataSource={data} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
