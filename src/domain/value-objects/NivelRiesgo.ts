export type NivelRiesgo = 'normal' | 'riesgo_preventivo' | 'excursion_critica'

export const NIVELES_RIESGO: NivelRiesgo[] = ['normal', 'riesgo_preventivo', 'excursion_critica']

export const RANGO_TERMICO = { minimo: 2, maximo: 8 } as const

export function estaEnRango(temperatura: number): boolean {
  return temperatura >= RANGO_TERMICO.minimo && temperatura <= RANGO_TERMICO.maximo
}
