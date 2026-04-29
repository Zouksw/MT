/**
 * DataTable Component Tests
 */

import { render, screen } from '@testing-library/react';
import { DataTable } from '../DataTable';

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name', dataIndex: 'name' },
    { key: 'value', header: 'Value', dataIndex: 'value' },
  ];

  const data = [
    { id: '1', name: 'Item 1', value: 100 },
    { id: '2', name: 'Item 2', value: 200 },
  ];

  test('should render table with data', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  test('should render empty state when no data', () => {
    render(<DataTable columns={columns} data={[]} emptyText="No data found" />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  test('should render with pagination', () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      value: i * 10,
    }));

    render(
      <DataTable
        columns={columns}
        data={manyItems}
        pagination={{ page: 1, pageSize: 10, total: 25, onChange: jest.fn() }}
      />,
    );

    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });

  test('should render data values correctly', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
