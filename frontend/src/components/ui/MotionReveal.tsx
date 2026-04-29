"use client";

import React from "react";
import { motion, type Variants, useReducedMotion } from "framer-motion";
import { FADE_UP, STAGGER_CHILD } from "@/lib/motion";

interface MotionRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: Variants;
  as?: "div" | "section" | "article" | "span";
}

/**
 * Scroll-triggered reveal wrapper.
 * Uses whileInView with spring physics — taste-skill compliant.
 */
export const MotionReveal = React.memo(function MotionReveal({
  children,
  className,
  delay = 0,
  variant = FADE_UP,
  as = "div",
}: MotionRevealProps) {
  const Component = motion.create(as);
  const prefersReducedMotion = useReducedMotion();

  return (
    <Component
      initial={prefersReducedMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={variant}
      transition={{ delay }}
      className={className}
    >
      {children}
    </Component>
  );
});

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul" | "ol";
}

export const StaggerContainer = React.memo(function StaggerContainer({
  children,
  className,
  as = "div",
}: StaggerContainerProps) {
  const Component = motion.create(as);

  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.08, delayChildren: 0.1 },
        },
      }}
      className={className}
    >
      {children}
    </Component>
  );
});

export const StaggerChild = React.memo(function StaggerChild({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const Component = motion.create(as);

  return (
    <Component variants={STAGGER_CHILD} className={className}>
      {children}
    </Component>
  );
});

export default MotionReveal;
