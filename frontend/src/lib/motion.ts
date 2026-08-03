import type { Transition, Variants } from "framer-motion";

// Spring physics — taste-skill standard
export const SPRING_DEFAULTS: Transition = {
	type: "spring",
	stiffness: 100,
	damping: 20,
};

// Stagger orchestration
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
