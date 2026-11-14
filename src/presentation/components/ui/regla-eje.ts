/** Eje fijo de la regla: 0–10 °C. Un valor fuera se fija al borde. */
export const EJE_REGLA = { minimo: 0, maximo: 10 } as const

/** Posición 0–1 sobre el eje 0–10 °C, fijada a los bordes. */
export function posicionEnRegla(temperatura: number): number {
  const p = (temperatura - EJE_REGLA.minimo) / (EJE_REGLA.maximo - EJE_REGLA.minimo)
  return Math.min(1, Math.max(0, p))
}
