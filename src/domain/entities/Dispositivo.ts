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
  // HU-43/HU-44: operación en el broker que falta confirmar en la consola
  // (EMQX Serverless). Mientras no sea null, la consola no refleja la credencial.
  broker_pendiente?: OperacionBroker | null
  broker_pendiente_motivo?: string | null
  broker_pendiente_desde?: string | null
  broker_pendiente_por?: string | null
  broker_confirmado_en?: string | null
  broker_confirmado_por?: string | null
  // HU-54: último `estado_nodo` recibido (latido del nodo).
  ultimo_latido_en?: string | null
}

export type OperacionBroker = 'aprovisionar' | 'retirar'

/** B-16: capacidad real del buffer LittleFS del nodo (300 archivos × 100 lecturas). */
export const CAPACIDAD_BUFFER_LITTLEFS = 30_000
/** Intervalo de captura de fábrica del nodo, en segundos. */
export const INTERVALO_REPORTE_POR_DEFECTO = 30
/** HU-54: ciclos de captura perdidos antes de declarar SIN_DATOS. */
export const N_INTERVALOS_SIN_DATOS = 3

/**
 * B-17 / HU-54: umbral de silencio del nodo. Usa el que calcula el backend
 * (N × intervalo del dispositivo); si no llegó, N × el intervalo conocido.
 */
export function umbralSilencioSegundos(dispositivo: Pick<Dispositivo, 'umbral_sin_datos_segundos' | 'intervalo_reporte_segundos'> | null | undefined): number {
  if (dispositivo?.umbral_sin_datos_segundos) return dispositivo.umbral_sin_datos_segundos
  return N_INTERVALOS_SIN_DATOS * (dispositivo?.intervalo_reporte_segundos || INTERVALO_REPORTE_POR_DEFECTO)
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

/** Respuesta de la rotación (y del alta): el token en claro solo existe en ella. */
export interface CredencialRotada {
  device_id: string
  token: string
  generado_en: string
  /** true: aprovisionada en el broker; false: el broker la rechazó; null: pendiente en la consola. */
  credencial_aprovisionada?: boolean | null
  /** Instrucción cuando el aprovisionamiento no fue automático. */
  mensaje_broker?: string | null
  /** true: el broker cerró la sesión anterior; null: API del broker no configurada. */
  sesion_broker_cerrada: boolean | null
}

/** HU-43: el alta devuelve el dispositivo y su credencial inicial. */
export interface DispositivoAlta extends Dispositivo {
  credencial: CredencialRotada
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
  /** HU-54: cuándo salió el aviso por correo del incidente persistente. */
  notificado_en?: string | null
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
  time_quality: TimeQualityContrato
}

/** B-15: valores del contrato de payload v1.0 del firmware (`time_quality`). */
export type TimeQualityContrato = 'sntp_synced' | 'sntp_backfilled' | 'unsynced'

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

/**
 * FE-006: mismo patrón que el backend (BE-017) y el firmware. Un identificador
 * fuera de él podría alterar las rutas de la API que lo interpolan.
 */
export const PATRON_DEVICE_ID = /^[A-Za-z0-9_-]{1,50}$/

/** Número finito no negativo de un `detalle` de estado_nodo, o undefined. */
function numeroDe(detalle: Record<string, unknown>, clave: string): number | undefined {
  const valor = detalle[clave]
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : undefined
}

/**
 * HU-48 / A-4: aplica el último `estado_nodo` (SSE) sobre la lista de equipos:
 * registros pendientes en LittleFS y capacidad real, pérdidas por saturación
 * (brecha), intervalo de captura informado por el nodo y latido.
 */
export function aplicarEstadoNodo<T extends Dispositivo>(
  dispositivos: T[],
  estado: { device_id: string; timestamp: string; detalle: Record<string, unknown> | null },
): T[] {
  const detalle = estado.detalle ?? {}
  return dispositivos.map((d) => {
    if (d.id !== estado.device_id) return d
    const pendientes = numeroDe(detalle, 'pendientes')
    const capacidad = numeroDe(detalle, 'capacidad')
    const perdidas = numeroDe(detalle, 'perdidas_total')
    const intervalo = numeroDe(detalle, 'intervalo_s')
    const previo = d.buffer_littlefs
    return {
      ...d,
      ultimo_latido_en: estado.timestamp,
      intervalo_reporte_segundos: intervalo || d.intervalo_reporte_segundos,
      buffer_littlefs: {
        pendientes: pendientes ?? previo?.pendientes ?? 0,
        limite: capacidad || previo?.limite || CAPACIDAD_BUFFER_LITTLEFS,
        desde: previo?.desde ?? null,
        hasta: previo?.hasta ?? null,
        perdidas: perdidas ?? previo?.perdidas ?? 0,
        brechas: previo?.brechas,
        ultima_sincronizacion_en: pendientes === 0 ? estado.timestamp : previo?.ultima_sincronizacion_en ?? null,
      },
    }
  })
}
