import type { Transition } from 'motion/react'

/** Resorte de la pieza que crece o se desliza: rápido y sin rebote. Con movimiento reducido, nada. */
export function transicionPieza(reducir: boolean | null): Transition {
  return reducir ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 44, mass: 0.8 }
}
