import type { Rol } from '../value-objects/Rol'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  is_active: boolean
  motivo_desactivacion: string | null
  desactivado_en: string | null
}

export const MOTIVOS_DESACTIVACION = ['renuncia', 'despido', 'jubilacion', 'otros'] as const
export type MotivoDesactivacion = (typeof MOTIVOS_DESACTIVACION)[number]

export interface RegistroAuditoria {
  id: string
  usuario_id: string | null
  accion: string
  recurso: string
  detalle: Record<string, unknown> | null
  ip_origen: string | null
  created_at: string
}
