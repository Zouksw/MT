/**
 * Tests for useIsMobile hook and responsive utilities
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile, useIsTablet, useIsDesktop, useBreakpoint, useWindowSize } from '../responsive-utils';

// The breakpointValues are: md: 768, lg: 1024
// useIsMobile matches maxWidth: 767

// Helper to set window.innerWidth and fire resize
function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  });
}

// Helper to override matchMedia for specific media queries
function mockMatchMedia(matchesMap: Record<string, boolean>) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => {
    // Check if query matches any in our map
    let matches = false;
    for (const [key, value] of Object.entries(matchesMap)) {
      if (query.includes(key)) {
        matches = value;
        break;
      }
    }
    // Also check exact match
    if (matchesMap[query] !== undefined) {
      matches = matchesMap[query];
    }
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  });
}

describe('useIsMobile', () => {
  it('should return a boolean', () => {
    const { result } = renderHook(() => useIsMobile());

    expect(typeof result.current).toBe('boolean');
  });

  it('should return true for mobile width (320px)', () => {
    mockMatchMedia({ '767': true, 'max-width: 767px': true });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('should return false for desktop width (1024px)', () => {
    mockMatchMedia({ 'max-width: 767px': false });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });
});

describe('useBreakpoint', () => {
  it('should return a breakpoint string', () => {
    const { result } = renderHook(() => useBreakpoint());

    expect(typeof result.current).toBe('string');
    expect(['xs', 'sm', 'md', 'lg', 'xl', '2xl']).toContain(result.current);
  });

  it('should return xs for width < 640', () => {
    setWindowWidth(320);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('xs');
  });

  it('should return sm for width >= 640 and < 768', () => {
    setWindowWidth(640);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('sm');
  });

  it('should return md for width >= 768 and < 1024', () => {
    setWindowWidth(768);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('md');
  });

  it('should return lg for width >= 1024 and < 1280', () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('lg');
  });

  it('should return xl for width >= 1280 and < 1536', () => {
    setWindowWidth(1280);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('xl');
  });

  it('should return 2xl for width >= 1536', () => {
    setWindowWidth(1600);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('2xl');
  });

  it('should update breakpoint on resize', () => {
    setWindowWidth(320);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('xs');

    act(() => {
      setWindowWidth(1024);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe('lg');
  });
});

describe('useIsTablet', () => {
  it('should return true for tablet width (768px-1023px)', () => {
    mockMatchMedia({ 'min-width: 768px': true, 'max-width: 1023px': true });

    const { result } = renderHook(() => useIsTablet());

    expect(result.current).toBe(true);
  });

  it('should return false for mobile width', () => {
    // Both conditions must be true for useIsTablet to return true.
    // For mobile, minWidth is false (width < 768)
    mockMatchMedia({ 'min-width: 768px': false, 'max-width: 1023px': true });

    const { result } = renderHook(() => useIsTablet());

    expect(result.current).toBe(false);
  });
});

describe('useIsDesktop', () => {
  it('should return true for desktop width (1024px+)', () => {
    mockMatchMedia({ 'min-width: 1024px': true });

    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(true);
  });

  it('should return false for mobile width', () => {
    mockMatchMedia({ 'min-width: 1024px': false });

    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(false);
  });
});

describe('useWindowSize', () => {
  it('should return width and height', () => {
    setWindowWidth(1024);

    const { result } = renderHook(() => useWindowSize());

    expect(result.current).toEqual({ width: 1024, height: 768 });
  });

  it('should update on resize', () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useWindowSize());

    expect(result.current.width).toBe(1024);

    act(() => {
      setWindowWidth(500);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.width).toBe(500);
  });
});
