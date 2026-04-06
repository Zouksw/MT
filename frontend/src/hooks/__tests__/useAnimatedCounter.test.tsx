/**
 * Tests for useAnimatedCounter hook
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useAnimatedCounter } from '../useScrollAnimation';

// Helper component to test the hook
function TestCounter({ target, duration }: { target: number; duration?: number }) {
  const { value, start } = useAnimatedCounter(target, duration);
  return (
    <div>
      <span data-testid="value">{value}</span>
      <button data-testid="start" onClick={start}>Start</button>
    </div>
  );
}

describe('useAnimatedCounter', () => {
  it('should return initial value of 0', () => {
    render(<TestCounter target={100} />);

    expect(screen.getByTestId('value')).toHaveTextContent('0');
  });

  it('should return value and start function', () => {
    render(<TestCounter target={100} />);

    expect(screen.getByTestId('value')).toHaveTextContent('0');
    expect(screen.getByTestId('start')).toBeInTheDocument();
  });

  it('should set value to target immediately when prefers-reduced-motion is set', () => {
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

    render(<TestCounter target={42} />);

    act(() => {
      screen.getByTestId('start').click();
    });

    expect(screen.getByTestId('value')).toHaveTextContent('42');

    window.matchMedia = originalMatchMedia;
  });

  it('should start counting via requestAnimationFrame when reduced motion is not preferred', () => {
    // matchMedia mock returns false for reduced motion by default
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      // Immediately invoke the callback with a timestamp that completes the animation
      cb(performance.now() + 5000);
      return 0;
    });

    render(<TestCounter target={100} duration={1000} />);

    act(() => {
      screen.getByTestId('start').click();
    });

    // Since we mocked rAF to complete immediately, value should be at target
    expect(screen.getByTestId('value')).toHaveTextContent('100');

    rafSpy.mockRestore();
  });

  it('should not restart after already started', () => {
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

    render(<TestCounter target={50} />);

    act(() => {
      screen.getByTestId('start').click();
    });
    expect(screen.getByTestId('value')).toHaveTextContent('50');

    // Clicking start again should not change anything
    act(() => {
      screen.getByTestId('start').click();
    });
    expect(screen.getByTestId('value')).toHaveTextContent('50');

    window.matchMedia = originalMatchMedia;
  });

  it('should handle target of 0', () => {
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

    render(<TestCounter target={0} />);

    act(() => {
      screen.getByTestId('start').click();
    });

    expect(screen.getByTestId('value')).toHaveTextContent('0');

    window.matchMedia = originalMatchMedia;
  });
});
