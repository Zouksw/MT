/**
 * FocusTrap Component
 *
 * Traps keyboard focus within a container (e.g., modal, dialog).
 * Ensures keyboard users can navigate without escaping accidentally.
 *
 * Features:
 * - Focuses first element on mount
 * - Handles Tab and Shift+Tab keys
 * - Returns focus to trigger on unmount
 * - Respects focus management best practices
 */

"use client";

import { useEffect, useRef } from "react";

export interface FocusTrapProps {
  children: React.ReactNode;
  enabled?: boolean;
  returnFocusTo?: HTMLElement | null;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  enabled = true,
  returnFocusTo,
}) => {
  const trapRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const trap = trapRef.current;
    if (!trap) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the trap
    const getFocusableElements = () => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ];

      return trap.querySelectorAll<HTMLElement>(focusableSelectors.join(', '));
    };

    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    if (firstElement) {
      firstElement.focus();
    }

    // Handle Tab and Shift+Tab
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift+Tab: Move to previous element
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: Move to next element
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    trap.addEventListener("keydown", handleTab);

    // Cleanup: Return focus to previous element or specified element
    return () => {
      trap.removeEventListener("keydown", handleTab);

      const returnElement = returnFocusTo || previousActiveElement.current;
      if (returnElement && document.contains(returnElement)) {
        returnElement.focus();
      }
    };
  }, [enabled, returnFocusTo]);

  return <div ref={trapRef}>{children}</div>;
};

/**
 * useFocusManagement Hook
 *
 * Manages focus when content dynamically changes.
 * Announces changes to screen readers.
 */

import { useState, useCallback } from "react";

export function useFocusManagement(dependencies: any[] = []) {
  const [announcement, setAnnouncement] = useState<string>("");

  const announceChange = useCallback((message: string) => {
    // Use setTimeout to avoid synchronous setState which can trigger cascading renders
    setTimeout(() => {
      setAnnouncement(message);

      // Clear announcement after it's been read
      setTimeout(() => {
        setAnnouncement("");
      }, 1000);
    }, 0);
  }, []);

  useEffect(() => {
    // Check if dependencies changed
    const hasChanged = dependencies.some((dep, i, arr) => {
      if (i === 0) return false;
      return dep !== arr[i - 1];
    });

    if (hasChanged && dependencies.length > 0) {
      announceChange("Content updated");
    }
  }, dependencies);

  const moveToElement = useCallback((element: HTMLElement | null) => {
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  return {
    announcement,
    announceChange,
    moveToElement,
  };
}

/**
 * LiveRegion Component
 *
 * Announces dynamic changes to screen readers.
 */
export interface LiveRegionProps {
  message?: string;
  role?: "status" | "alert";
  polite?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  role = "status",
  polite = true,
}) => {
  if (!message) return null;

  return (
    <div
      className="sr-live-region"
      role={polite ? "status" : "alert"}
      aria-live={polite ? "polite" : "assertive"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
};
