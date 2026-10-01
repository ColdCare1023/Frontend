import type { Variants, Transition } from 'motion/react'

/** Curva EaseOut ColdCare B2B Premium */
export const COLDCARE_EASE = [0.16, 1, 0.3, 1] as const

export const TRANSITION_FAST: Transition = {
  duration: 0.2,
  ease: COLDCARE_EASE,
}

export const TRANSITION_SMOOTH: Transition = {
  duration: 0.24,
  ease: COLDCARE_EASE,
}

// ============================================================================
// VARIANTES DE ENTRADA (Stagger jerárquico)
// ============================================================================

export const brandContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
}

export const brandLogoVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: COLDCARE_EASE },
  },
}

export const heroHeadingVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: COLDCARE_EASE },
  },
}

export const heroSubtextVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: COLDCARE_EASE },
  },
}

export const heroVisualVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.24, ease: COLDCARE_EASE },
  },
}

export const badgesContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

export const badgeItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: COLDCARE_EASE },
  },
}

export const formPanelVariants: Variants = {
  hidden: { opacity: 0, x: 22 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.24,
      ease: COLDCARE_EASE,
      delay: 0.04,
    },
  },
}

export const demoGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
}

export const demoCardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: COLDCARE_EASE },
  },
}

// ============================================================================
// MICROINTERACCIONES
// ============================================================================

export const submitButtonMotion = {
  whileHover: {
    y: -1,
    transition: { duration: 0.18, ease: COLDCARE_EASE },
  },
  whileTap: {
    scale: 0.98,
    transition: { duration: 0.08 },
  },
}

export const demoCardInteractiveMotion = {
  whileHover: {
    y: -2,
    transition: { duration: 0.16, ease: COLDCARE_EASE },
  },
  whileTap: {
    scale: 0.985,
    transition: { duration: 0.08 },
  },
}

// ============================================================================
// AMBIENTALES DE TELEMETRÍA (LOOPS SUAVES)
// ============================================================================

export const ambientGlowVariants: Variants = {
  animate: {
    scale: [1, 1.12, 1],
    opacity: [0.3, 0.5, 0.3],
    transition: {
      duration: 14,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export const getFloatingCardVariants = (
  distance: number,
  duration: number,
  delay: number = 0,
): Variants => ({
  animate: {
    y: [-distance, distance, -distance],
    transition: {
      duration,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    },
  },
})

export const floatingCard1Variants = getFloatingCardVariants(4, 5.0, 0)
export const floatingCard2Variants = getFloatingCardVariants(4, 6.5, 0.8)
export const floatingCard3Variants = getFloatingCardVariants(4, 8.0, 1.6)

export const sensorRadarPulseVariants: Variants = {
  animate: {
    scale: [1, 2.2],
    opacity: [0.75, 0],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
}

// ============================================================================
// ACCESSIBLE VARIANTS ADAPTER
// ============================================================================

export function getAccessibleVariants(
  standardVariants: Variants,
  reduceMotion: boolean | null,
): Variants {
  if (!reduceMotion) return standardVariants

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.15 },
    },
    animate: {
      y: 0,
      scale: 1,
      opacity: 1,
      transition: { duration: 0 },
    },
  }
}
