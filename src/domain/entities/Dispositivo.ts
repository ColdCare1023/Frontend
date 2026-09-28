export interface Dispositivo {
  id: string
  nombre: string | null
  ubicacion: string | null
  estado_conectividad: string
  activo: boolean
  firmware_version: string
  motivo_baja: string | null
  descripcion_baja: string | null
  dado_de_baja_en: string | null
  reemplaza_a_device_id: string | null
  // HU-30: estado de calibración del sensor.
  fecha_ultima_calibracion: string | null
  numero_certificado_calibracion: string | null
  fecha_proxima_calibracion: string | null
  observaciones_calibracion: string | null
  // HU-51: metadatos de instalación.
  fecha_instalacion: string | null
  instalado_por: string | null
  observaciones_instalacion: string | null
  // HU-53/HU-54: responsable registrado (destinatario de notificaciones).
  responsable_nombre: string | null
  responsable_email: string | null
  responsable_telefono: string | null
}

// HU-49: un cambio de configuración/instalación/calibración/responsable.
export interface HistorialConfiguracion {
  id: string
  device_id: string
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  actor_id: string | null
  created_at: string
}

export const MOTIVOS_BAJA = ['falla_hardware', 'mantenimiento', 'reemplazo', 'fin_de_servicio'] as const
export type MotivoBaja = (typeof MOTIVOS_BAJA)[number]

/** HU-30: vigencia del certificado de calibración, para el badge de estado. */
export type EstadoCalibracion = 'sin_registrar' | 'vigente' | 'proxima_a_vencer' | 'vencida'

const MARGEN_AVISO_DIAS = 30

export function estadoCalibracion(dispositivo: Dispositivo, hoy: Date = new Date()): EstadoCalibracion {
  if (!dispositivo.fecha_proxima_calibracion) return 'sin_registrar'
  const proxima = new Date(dispositivo.fecha_proxima_calibracion)
  const diasRestantes = Math.floor((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (diasRestantes < 0) return 'vencida'
  if (diasRestantes <= MARGEN_AVISO_DIAS) return 'proxima_a_vencer'
  return 'vigente'
}
