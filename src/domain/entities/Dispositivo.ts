export interface Dispositivo {
  id: string
  nombre: string | null
  ubicacion: string | null
  estado_conectividad: string
  // HU-13: desde cuándo rige `estado_conectividad` («Desconectado desde…»).
  conectividad_cambiada_en?: string | null
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
  margen_aviso_calibracion_dias?: number | null
  observaciones_calibracion: string | null
  // HU-51: metadatos de instalación.
  fecha_instalacion: string | null
  instalado_por: string | null
  observaciones_instalacion: string | null
  // HU-53/HU-54: responsable registrado (destinatario de notificaciones).
  responsable_nombre: string | null
  responsable_email: string | null
  responsable_telefono: string | null
  // HU-19/HU-33/HU-48/HU-51/HU-55: telemetría y estado IoT del nodo.
  registrado_en?: string | null
  ultimo_reporte_en?: string | null
  intervalo_reporte_segundos?: number
  umbral_sin_datos_segundos?: number
  umbral_puerta_abierta_segundos?: number
  estado_operativo?: 'OPERATIVO' | 'SIN_DATOS' | 'FALLA_SENSOR'
  incidencias_operativas?: IncidenteOperativo[]
  sensores?: SensorIoT[]
  buffer_littlefs?: BufferLittleFS
  ultimo_evento?: SobreTelemetria | null
  estado_credencial_broker?: EstadoCredencial
  // HU-44 / FE-003: estado de la credencial MQTT según el backend (nunca el token).
  mqtt_token_activo?: boolean
  mqtt_credencial_actualizada_en?: string | null
  // BE-015: dispositivo de demostración (admite lecturas `simulated`).
  es_demo?: boolean
}

export type EstadoCredencial = 'activa' | 'pendiente' | 'error' | 'revocada' | 'sin_reportar'

/**
 * FE-003: el backend informa `mqtt_token_activo`; la demo además modela
 * estados intermedios. Una credencial inactiva con fecha de actualización fue
 * revocada; sin fecha, nunca se emitió.
 */
export function estadoCredencial(dispositivo: Dispositivo): EstadoCredencial {
  if (dispositivo.estado_credencial_broker) return dispositivo.estado_credencial_broker
  if (dispositivo.mqtt_token_activo) return 'activa'
  return dispositivo.mqtt_credencial_actualizada_en ? 'revocada' : 'sin_reportar'
}

/** Respuesta de la rotación: el token en claro solo existe en ella. */
export interface CredencialRotada {
  device_id: string
  token: string
  generado_en: string
  /** true: el broker cerró la sesión anterior; null: API del broker no configurada. */
  sesion_broker_cerrada: boolean | null
}

export interface SensorIoT {
  modelo: 'DS18B20' | 'SHT31' | 'MC-38'
  estado: 'ok' | 'error' | 'no_instalado'
  campo_telemetria: string
}

export interface BufferLittleFS {
  pendientes: number
  limite: number
  desde: string | null
  hasta: string | null
  perdidas: number
  brechas?: BrechaTelemetria[]
  ultima_sincronizacion_en?: string | null
}

/** Incidente operativo separado de riesgo térmico y clasificación IA. */
export interface IncidenteOperativo {
  id: string
  device_id: string
  tipo: 'sin_datos'
  estado: 'activo' | 'resuelto'
  detectado_en: string
  ultimo_reporte_en: string | null
  umbral_silencio_segundos: number
  recuperado_en: string | null
}

/** Tramo sin muestras nuevas cuando LittleFS llegó a su capacidad. */
export interface BrechaTelemetria {
  desde: string
  hasta: string
  muestras_perdidas: number
  causa: 'buffer_agotado'
  registrada_en: string
}

export interface SobreTelemetria {
  schema_version: string
  boot_id: string
  seq_no: number
  captured_at: string
  received_at: string
  time_quality: 'ntp' | 'rtc' | 'uptime'
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

/**
 * HU-13: aplica un cambio de conectividad recibido en tiempo real (evento SSE
 * `conectividad`) sobre una lista ya cargada, sin volver a consultar la API.
 */
export function aplicarCambioConectividad<T extends Dispositivo>(
  dispositivos: T[],
  cambio: { device_id: string; estado: 'online' | 'offline'; desde: string },
): T[] {
  return dispositivos.map((d) =>
    d.id === cambio.device_id
      ? { ...d, estado_conectividad: cambio.estado, conectividad_cambiada_en: cambio.desde }
      : d,
  )
}

export const MOTIVOS_BAJA = ['falla_hardware', 'mantenimiento', 'reemplazo', 'fin_de_servicio'] as const
export type MotivoBaja = (typeof MOTIVOS_BAJA)[number]

/** HU-30: vigencia del certificado de calibración, para el badge de estado. */
export type EstadoCalibracion = 'sin_registrar' | 'vigente' | 'proxima_a_vencer' | 'vencida'

export function estadoCalibracion(dispositivo: Dispositivo, hoy: Date = new Date()): EstadoCalibracion {
  if (!dispositivo.fecha_proxima_calibracion) return 'sin_registrar'
  const [anio, mes, dia] = dispositivo.fecha_proxima_calibracion.slice(0, 10).split('-').map(Number)
  const proxima = new Date(Date.UTC(anio, mes - 1, dia))
  if (!Number.isFinite(proxima.getTime()) || proxima.getUTCMonth() + 1 !== mes || proxima.getUTCDate() !== dia) return 'sin_registrar'
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const diasRestantes = Math.round((proxima.getTime() - hoyUTC) / (1000 * 60 * 60 * 24))
  if (diasRestantes < 0) return 'vencida'
  const margenAviso = Math.max(0, dispositivo.margen_aviso_calibracion_dias ?? 30)
  if (diasRestantes <= margenAviso) return 'proxima_a_vencer'
  return 'vigente'
}
