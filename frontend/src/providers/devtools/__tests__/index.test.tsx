import React from 'react';
import { render } from '@testing-library/react';
import { DevtoolsProvider } from '../index';

// Mock the devtools module
jest.mock('@refinedev/devtools', () => ({
  DevtoolsPanel: () => <div data-testid="devtools-panel">DevtoolsPanel</div>,
  DevtoolsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="devtools-provider-base">{children}</div>
  ),
}));

describe('DevtoolsProvider', () => {
  it('should export DevtoolsProvider component', () => {
    expect(DevtoolsProvider).toBeDefined();
    expect(DevtoolsProvider).toBeInstanceOf(Function);
  });

  it('should render children', () => {
    const { getByTestId, getByText } = render(
      <DevtoolsProvider>
        <div data-testid="test-child">Test Child Content</div>
      </DevtoolsProvider>
    );

    expect(getByTestId('test-child')).toHaveTextContent('Test Child Content');
  });

  it('should wrap children with DevtoolsProviderBase', () => {
    const { getByTestId } = render(
      <DevtoolsProvider>
        <div>Child</div>
      </DevtoolsProvider>
    );

    expect(getByTestId('devtools-provider-base')).toBeInTheDocument();
  });

  it('should include DevtoolsPanel only in development', () => {
    // DevtoolsPanel only renders when NODE_ENV === 'development'
    // In test environment, it should not render
    const { queryByTestId } = render(
      <DevtoolsProvider>
        <div>Child</div>
      </DevtoolsProvider>
    );

    // In test mode, DevtoolsPanel should NOT be present
    expect(queryByTestId('devtools-panel')).not.toBeInTheDocument();
  });

  it('should render multiple children', () => {
    const { getAllByTestId } = render(
      <DevtoolsProvider>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </DevtoolsProvider>
    );

    expect(getAllByTestId(/^child-/).length).toBe(3);
  });

  it('should pass props through to children', () => {
    const TestComponent = ({ name }: { name: string }) => (
      <div data-testid="test-comp">{name}</div>
    );

    const { getByTestId } = render(
      <DevtoolsProvider>
        <TestComponent name="Test Value" />
      </DevtoolsProvider>
    );

    expect(getByTestId('test-comp')).toHaveTextContent('Test Value');
  });
});
