/**
 * Tests for useScrollAnimation hook
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useScrollAnimation } from '../useScrollAnimation';

// Helper component to test the hook
function TestComponent({ options }: { options?: Parameters<typeof useScrollAnimation>[0] }) {
  const { ref, isVisible } = useScrollAnimation(options);
  return (
    <div ref={ref} data-testid="target">
      {isVisible ? 'Visible' : 'Hidden'}
    </div>
  );
}

describe('useScrollAnimation', () => {
  it('should return ref and isVisible (initially false)', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('target')).toHaveTextContent('Hidden');
  });

  it('should set isVisible to true when prefers-reduced-motion is set', () => {
    // matchMedia is mocked in jest.setup.js to return matches: false by default.
    // We need to override it for this test.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<TestComponent />);

    expect(screen.getByTestId('target')).toHaveTextContent('Visible');

    // Restore
    window.matchMedia = originalMatchMedia;
  });

  it('should use IntersectionObserver when reduced motion is not preferred', () => {
    // matchMedia mock returns false for reduced motion by default
    // IntersectionObserver is mocked in jest.setup.js (no-op)
    // So isVisible should stay false since the mock observer never fires
    render(<TestComponent />);

    expect(screen.getByTestId('target')).toHaveTextContent('Hidden');
  });

  it('should accept custom options', () => {
    render(
      <TestComponent
        options={{ threshold: 0.5, rootMargin: '0px', triggerOnce: false }}
      />
    );

    // Should still start as Hidden since observer mock doesn't fire
    expect(screen.getByTestId('target')).toHaveTextContent('Hidden');
  });

  it('should trigger intersection callback', () => {
    let capturedObserver: IntersectionObserver | null = null;
    let capturedCallback: IntersectionObserverCallback | null = null;

    // Create a custom IntersectionObserver mock that captures the callback
    const MockObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        capturedCallback = callback;
        capturedObserver = this as unknown as IntersectionObserver;
      }
      disconnect() {}
      observe() {}
      takeRecords() { return []; }
      unobserve() {}
    };

    const OriginalObserver = global.IntersectionObserver;
    global.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;

    render(<TestComponent options={{ triggerOnce: true }} />);

    // Simulate the observer firing with isIntersecting = true
    act(() => {
      capturedCallback!(
        [{ isIntersecting: true, target: document.createElement('div') }] as IntersectionObserverEntry[],
        capturedObserver!
      );
    });

    expect(screen.getByTestId('target')).toHaveTextContent('Visible');

    global.IntersectionObserver = OriginalObserver;
  });

  it('should set isVisible to false when not intersecting and triggerOnce is false', () => {
    let capturedObserver: IntersectionObserver | null = null;
    let capturedCallback: IntersectionObserverCallback | null = null;

    const MockObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        capturedCallback = callback;
        capturedObserver = this as unknown as IntersectionObserver;
      }
      disconnect() {}
      observe() {}
      takeRecords() { return []; }
      unobserve() {}
    };

    const OriginalObserver = global.IntersectionObserver;
    global.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;

    render(<TestComponent options={{ triggerOnce: false }} />);

    // First: set visible
    act(() => {
      capturedCallback!(
        [{ isIntersecting: true, target: document.createElement('div') }] as IntersectionObserverEntry[],
        capturedObserver!
      );
    });
    expect(screen.getByTestId('target')).toHaveTextContent('Visible');

    // Then: set not visible
    act(() => {
      capturedCallback!(
        [{ isIntersecting: false, target: document.createElement('div') }] as IntersectionObserverEntry[],
        capturedObserver!
      );
    });
    expect(screen.getByTestId('target')).toHaveTextContent('Hidden');

    global.IntersectionObserver = OriginalObserver;
  });
});
