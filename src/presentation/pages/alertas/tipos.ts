import type { AccionCorrectiva } from '@/domain/entities/AlertaTermica'

/** Pestaña del panel de una alerta. */
export type PestanaPanel = 'accion' | 'cronologia'

/** Borrador de la acción correctiva (HU-27), solo en memoria y por alerta. */
export interface BorradorAccion {
  decision: string
  descripcion: string
  justificacion: string
}

export const BORRADOR_VACIO: BorradorAccion = { decision: '', descripcion: '', justificacion: '' }

/** Máximo de cada campo de la acción (HU-27). */
export const MAX_CAMPO_ACCION = 2000

export type PuedeRectificar = (accion: AccionCorrectiva) => boolean
