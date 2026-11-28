import type { AccionCorrectiva } from '@/domain/entities/AlertaTermica'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'

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

export function puedeRectificarAccion(usuario: { id: string; rol: Rol } | null, accion: AccionCorrectiva): boolean {
  return usuario !== null && accion.vigente !== false && (
    tienePermiso(usuario.rol, ['farmaceutico']) ||
    (accion.usuario_id === usuario.id && tienePermiso(usuario.rol, ['tecnico']))
  )
}
