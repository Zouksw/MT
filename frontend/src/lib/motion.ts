import type { Variants, Transition } from "framer-motion";

// Spring physics — taste-skill standard
export const SPRING_DEFAULTS: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
};

export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 80,
  damping: 25,
};

export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// Stagger orchestration
export const STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const STAGGER_CHILD: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_DEFAULTS,
  },
};

// Individual element animations
export const FADE_UP: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const FADE_IN: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export const SCALE_IN: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: SPRING_SNAPPY,
  },
};

// CSS spring approximation (for non-framer components)
export const SPRING_EASING_CSS = "cubic-bezier(0.34, 1.56, 0.64, 1)";
export const SMOOTH_EASING_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";
