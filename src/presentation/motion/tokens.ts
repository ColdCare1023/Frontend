/**
 * Movimiento ColdCare para motion v13 (MOTION §2). Ningún elemento con un
 * dato clínico rebota (`bounce: 0`). Mientras motion siga por debajo de 14.2,
 * los componentes solo animan `opacity`, el string completo de `transform` y
 * `clipPath`: los atajos `x`, `y` y `scale` corren en el hilo principal.
 */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
/** Morfos disparados por el usuario (píldora, formulario en línea). */
export const RESORTE_UI = { type: 'spring', duration: 0.3, bounce: 0 } as const
/** Notch o aviso: presupuesto de toast de 400 ms. */
export const RESORTE_AVISO = { type: 'spring', duration: 0.4, bounce: 0 } as const
export const SIN_MOVIMIENTO = { duration: 0 } as const

/** Duraciones en ms, espejo de los tokens CSS (`--duration-*`). */
export const DURACION = {
  presion: 120,
  micro: 140,
  salida: 120,
  pop: 160,
  ui: 180,
  revelado: 220,
  numero: 220,
  conteo: 280,
} as const

/** Lee la preferencia del sistema; en jsdom (sin matchMedia) es `false`. */
export function prefiereMovimientoReducido(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}
