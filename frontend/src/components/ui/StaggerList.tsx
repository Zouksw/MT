/**
 * StaggerList Component
 *
 * Animates list items in sequence for a polished, professional feel.
 * Each item fades in and slides up with a staggered delay.
 *
 * Features:
 * - Configurable stagger delay (default: 50ms)
 * - Respects prefers-reduced-motion
 * - Works with any list content
 * - CSS animations for optimal performance
 */

"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { createStaggerDelay, shouldReduceMotion } from "@/lib/animations";

const emptySubscribe = () => () => {};

export interface StaggerListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number; // ms between items (default: 50)
  variant?: "fade" | "slide-up" | "scale";
}

export const StaggerList: React.FC<StaggerListProps> = ({
  children,
  className = "",
  staggerDelay = 50,
  variant = "slide-up",
}) => {
  const respectMotionPreference = useSyncExternalStore(
    emptySubscribe,
    () => shouldReduceMotion(),
    () => false
  );

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (respectMotionPreference) return;

    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(animationTimer);
  }, [respectMotionPreference]);

  // If user prefers reduced motion, just show content without animation
  if (respectMotionPreference) {
    return <div className={className}>{children}</div>;
  }

  // Animation variants
  const getAnimationClass = (index: number) => {
    const delay = createStaggerDelay(index, staggerDelay);

    switch (variant) {
      case "fade":
        return `stagger-fade-in`;
      case "slide-up":
        return `stagger-slide-up`;
      case "scale":
        return `stagger-scale-in`;
      default:
        return `stagger-slide-up`;
    }
  };

  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className={getAnimationClass(index)}
          style={{
            animationDelay: createStaggerDelay(index, staggerDelay),
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

/**
 * StaggerGrid component for animating grid items in sequence
 */
export interface StaggerGridProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number; // ms between items (default: 50)
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: string;
}

export const StaggerGrid: React.FC<StaggerGridProps> = ({
  children,
  className = "",
  staggerDelay = 50,
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
  gap = "16px",
}) => {
  const respectMotionPreference = useSyncExternalStore(
    emptySubscribe,
    () => shouldReduceMotion(),
    () => false
  );

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (respectMotionPreference) return;

    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(animationTimer);
  }, [respectMotionPreference]);

  // If user prefers reduced motion, just show content without animation
  if (respectMotionPreference) {
    return (
      <div
        className={className}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns.mobile}, 1fr)`,
          gap,
        }}
      >
        {children}
      </div>
    );
  }

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns.mobile}, 1fr)`,
    gap,
    "@media (min-width: 768px)": {
      gridTemplateColumns: `repeat(${columns.tablet}, 1fr)`,
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: `repeat(${columns.desktop}, 1fr)`,
    },
  };

  return (
    <div className={className} style={gridStyle}>
      {children.map((child, index) => (
        <div
          key={index}
          className="stagger-slide-up"
          style={{
            animationDelay: createStaggerDelay(index, staggerDelay),
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};
