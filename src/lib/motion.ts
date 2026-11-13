import type { Transition } from "motion/react";

/**
 * Spring presets. All primary motion is physics-based (no duration easing):
 * - spring: k300 / c30 / m1 — layout moves, panels, reveals (≈590ms settle).
 * - snappy: quicker settle for small UI (indicators, toggles, menus).
 * - pop: slight overshoot (~6%) for things that "arrive" (bubbles, toasts, badges).
 */
export const spring: Transition = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
export const snappy: Transition = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 };
export const pop: Transition = { type: "spring", stiffness: 520, damping: 30, mass: 1 };
export const fade: Transition = { duration: 0.2, ease: [0.25, 1, 0.5, 1] };

export const menuMotion = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.12 } },
  transition: snappy,
} as const;
