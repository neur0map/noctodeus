import { animate, stagger, createTimeline, createSpring } from 'animejs';

export { animate, stagger, createTimeline, createSpring };

// Shared spring configs
export const springs = {
  snappy: createSpring({ stiffness: 300, damping: 24, mass: 0.8 }),
  gentle: createSpring({ stiffness: 180, damping: 20, mass: 1 }),
  bouncy: createSpring({ stiffness: 400, damping: 15, mass: 0.6 }),
} as const;

// Shared durations
export const durations = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Reusable animation presets — call these from $effect or onMount
export const presets = {
  /** Fade in + slide up from below */
  fadeInUp(targets: string | Element | Element[], opts?: { delay?: number; duration?: number }) {
    return animate(targets, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: opts?.duration ?? durations.normal,
      delay: opts?.delay ?? 0,
      ease: 'outQuint',
    });
  },

  /** Fade in with scale from 0.96 */
  fadeInScale(targets: string | Element | Element[], opts?: { delay?: number }) {
    return animate(targets, {
      opacity: [0, 1],
      scale: [0.96, 1],
      duration: durations.normal,
      delay: opts?.delay ?? 0,
      ease: 'outQuint',
    });
  },

  /** Staggered list entry — each item fades in + slides up */
  staggerIn(targets: string | Element | Element[], opts?: { delay?: number; staggerDelay?: number }) {
    return animate(targets, {
      opacity: [0, 1],
      translateY: [6, 0],
      delay: stagger(opts?.staggerDelay ?? 30, { start: opts?.delay ?? 0 }),
      duration: durations.normal,
      ease: 'outQuint',
    });
  },

  /** Count a number from 0 to target — for stats */
  countUp(targets: string | Element | Element[], endValue: number, opts?: { duration?: number }) {
    return animate(targets, {
      textContent: [0, endValue],
      duration: opts?.duration ?? 800,
      ease: 'outExpo',
      modifier: (v: number) => Math.round(v),
    });
  },

  /** Slide in from left (sidebar) */
  slideInLeft(targets: string | Element | Element[], opts?: { duration?: number }) {
    return animate(targets, {
      opacity: [0, 1],
      translateX: [-12, 0],
      duration: opts?.duration ?? durations.normal,
      ease: 'outQuint',
    });
  },

  /** Slide in from right (panel) */
  slideInRight(targets: string | Element | Element[], opts?: { duration?: number }) {
    return animate(targets, {
      opacity: [0, 1],
      translateX: [12, 0],
      duration: opts?.duration ?? durations.normal,
      ease: 'outQuint',
    });
  },

  /** Subtle pulse — for ambient/passive elements */
  breathe(targets: string | Element | Element[], opts?: { duration?: number }) {
    return animate(targets, {
      opacity: [0.5, 0.8],
      duration: opts?.duration ?? 2000,
      ease: 'inOutSine',
      alternate: true,
      loop: true,
    });
  },

  /** Press effect — scale down then back */
  press(targets: string | Element | Element[]) {
    return animate(targets, {
      scale: [1, 0.97, 1],
      duration: 200,
      ease: 'outQuint',
    });
  },
} as const;
