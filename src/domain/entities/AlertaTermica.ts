import type { EstadoAlerta } from '../value-objects/EstadoAlerta'
import type { NivelRiesgo } from '../value-objects/NivelRiesgo'

export interface AlertaTermica {
  id: string
  reading_id: string
  device_id: string
  nivel_riesgo: NivelRiesgo
  mensaje: string
  // `revisada`/`revisada_por` se conservan por compatibilidad (el backend
  // los sigue enviando en sincronía con `estado`), pero HU-23 hace de
  // `estado` la fuente de verdad para la UI — no derivar nada de estos dos.
  revisada: boolean
  revisada_por: string | null
  // D7: nombre de quien reconoció, resuelto por el backend (anonimizado si
  // el usuario fue desactivado, HU-45).
  revisada_por_nombre?: string | null
  created_at: string | null
  // HU-23: máquina de estados PENDIENTE -> RECONOCIDA -> ATENDIDA.
  estado: EstadoAlerta
  reconocida_en: string | null
  atendida_en: string | null
  // Evidencia de la excursión: inicio por hora de CAPTURA, temperatura más
  // alejada de 2-8 °C, duración y si se detectó con lecturas diferidas del
  // buffer del nodo. Ausentes en alertas anteriores a la migración 0035.
  iniciada_en?: string | null
  temperatura_pico?: number | null
  duracion_s?: number | null
  historica?: boolean
  // Aviso por correo: `notificada_en` solo se llena con un envío exitoso;
  // `notificacion_intentos` cuenta los intentos, fallidos incluidos.
  notificada_en?: string | null
  notificacion_intentos?: number
}

/** Intentos tras los cuales el backend deja de reintentar el correo
 * (NOTIFICACION_MAX_INTENTOS, 3 por defecto). */
export const MAX_INTENTOS_NOTIFICACION = 3

export type EstadoNotificacion = 'notificada' | 'reintentando' | 'no_entregada' | 'pendiente'

/** Estado visible del correo de una alerta crítica. `null` para las que no se avisan. */
export function estadoNotificacion(alerta: AlertaTermica): EstadoNotificacion | null {
  if (alerta.nivel_riesgo !== 'excursion_critica') return null
  if (alerta.notificada_en) return 'notificada'
  const intentos = alerta.notificacion_intentos ?? 0
  if (intentos >= MAX_INTENTOS_NOTIFICACION) return 'no_entregada'
  return intentos > 0 ? 'reintentando' : 'pendiente'
}

export interface AccionCorrectiva {
  id: string
  alert_id: string
  usuario_id: string
  descripcion: string
  created_at: string | null
  // HU-28: referencia a la acción que esta rectifica (null si es la original).
  corrige_accion_id: string | null
  // D7: nombre del responsable ya resuelto por el backend.
  usuario_nombre?: string | null
  // HU-28: motivo de la rectificación, quién la rectificó a ella y si es la
  // versión vigente (la única que se puede volver a rectificar).
  motivo_rectificacion?: string | null
  rectificada_por_id?: string | null
  vigente?: boolean
}
