import { RANGO_TERMICO, type NivelRiesgo } from '../value-objects/NivelRiesgo'

/** Origen real de la clasificación (AIV-04): quién decidió el nivel de riesgo. */
export type OrigenClasificacion =
  | 'random_forest'
  | 'salvaguarda_determinista'
  | 'dato_insuficiente'
  | 'fallo_sensor'

/** Estado real de la inferencia (AIV-07): distingue "no hubo inferencia" de
 * "el modelo decidió con confianza matemática 0". */
export type EstadoInferencia = 'completada' | 'omitida' | 'fallida' | 'modelo_no_disponible'
export type EstadoSensor = 'valido' | 'ausente' | 'invalido' | 'fisicamente_imposible'

export interface LecturaTermica {
  id: string | null
  device_id: string
  timestamp: string
  temperatura_ambiental: number | null
  humedad_ambiental: number | null
  temperatura_interna: number | null
  // HU-04: null cuando el dispositivo no tiene MC-38 instalado — no un
  // valor falso que simularía una puerta cerrada que no existe.
  apertura_refrigerador: boolean | null
  // HU-35: segundos que la puerta estuvo abierta DENTRO de la ventana de
  // muestreo (nunca supera el intervalo). null si el firmware no lo reportó o
  // si no hay MC-38 instalado.
  duracion_apertura_segundos: number | null
  /** HU-35: cuánto lleva abierta la puerta sin cerrarse al capturar; null si
   * estaba cerrada. Ausente en backends anteriores. */
  apertura_continua_segundos?: number | null
  /** Umbral operativo configurado para alertar por apertura prolongada. */
  umbral_puerta_abierta_segundos?: number | null
  estado_conectividad: string
  // HU-18/21/34: `nivel_riesgo` es la clase cruda del pipeline IA/salvaguarda
  // (model_class) — NUNCA se debe presentar como "excursión confirmada" sin
  // pasar por `riesgo_efectivo`/`excursion_confirmada`.
  nivel_riesgo: NivelRiesgo | null
  /** null cuando no hubo inferencia real (AIV-07) — nunca 0 como centinela. */
  confianza_ia: number | null
  modelo_version: string | null
  model_version?: string | null
  origen_clasificacion: OrigenClasificacion | null
  estado_inferencia: EstadoInferencia | null
  motivo_no_inferencia: string | null
  estado_sensores?: Record<string, EstadoSensor> | null
  reading_id?: string | null
  schema_version?: number | null
  /** Sobre MQTT: origen y orden del mensaje IoT. */
  boot_id?: string | null
  seq_no?: number | null
  captured_at?: string | null
  received_at?: string | null
  /** B-15: valor que entrega la API del backend (traducido del contrato v1.0:
   * sntp_synced → synced, sntp_backfilled → backfilled, unsynced → unsynced). */
  time_quality?: TimeQualityLectura | null
  /** HU-20: la clase la produjo el modelo legado (datos sintéticos). */
  ia_experimental?: boolean
  // HU-34: excursión confirmada por la regla directa de rango (2–8 °C),
  // independiente de la IA — nunca se infiere desde `nivel_riesgo`.
  excursion_confirmada: boolean
  // HU-34: la política determinista que combina excursión confirmada +
  // clasificación IA. Vale «normal» también para una lectura en rango que el
  // modelo no clasificó: para rotular el estado se usa `estado_riesgo`.
  riesgo_efectivo: NivelRiesgo | null
  /** HU-34 esc. 4: lo que el tablero rotula como riesgo. Distingue «sin
   * clasificación IA» y «falla de sensor» de Normal. Ausente en backends
   * anteriores: ver `estadoRiesgoDe`. */
  estado_riesgo?: EstadoRiesgo | null
  /** Hora reconstruida de una lectura `unsynced` ya reanclada (HU-01/HU-06). */
  timestamp_estimado?: string | null
  /** HU-07 (H2): arranque sin hora sincronizada aún sin reanclar. Su
   * `timestamp` es la hora de LLEGADA al backend, no la de captura. */
  sin_hora?: boolean
  /** De dónde sale la hora que se muestra (ver `OrigenHora`). */
  origen_hora?: OrigenHora
  /** HU-05: instante en que el backend recibió la lectura. */
  recibida_en?: string | null
  /** BE-001: «dispositivo» (telemetría del nodo) o «manual». */
  origen?: string
}

/**
 * HU-34 esc. 4: estado de riesgo que se rotula. Además de los tres niveles,
 * «sin_clasificacion_ia» (el modelo no clasificó y la temperatura está en
 * rango) y «falla_sensor» (sin temperatura interna válida).
 */
export const ESTADOS_RIESGO = ['normal', 'riesgo_preventivo', 'excursion_critica', 'sin_clasificacion_ia', 'falla_sensor'] as const
export type EstadoRiesgo = (typeof ESTADOS_RIESGO)[number]

/**
 * Origen de la hora mostrada: «nodo» (reloj sincronizado), «reconstruida»
 * (`timestamp_estimado`), «recepcion» (sin hora: llegada al backend) o
 * «manual» (la declaró quien registró la lectura).
 */
export type OrigenHora = 'nodo' | 'reconstruida' | 'recepcion' | 'manual'

/**
 * HU-34: estado de riesgo a rotular. Usa `estado_riesgo` del backend y, si no
 * llega (backend anterior o lectura en vivo antigua), aplica la misma regla
 * que el backend, en orden: excursión confirmada por la regla 2-8 °C; sin
 * temperatura interna válida, falla de sensor; sin inferencia completada del
 * modelo, sin clasificación IA; si no, el riesgo efectivo.
 */
export function estadoRiesgoDe(lectura: LecturaTermica | null | undefined): EstadoRiesgo | null {
  if (!lectura) return null
  const declarado = lectura.estado_riesgo
  if (declarado && (ESTADOS_RIESGO as readonly string[]).includes(declarado)) return declarado
  const temperatura = lectura.temperatura_interna
  const fueraDeRango =
    typeof temperatura === 'number' &&
    Number.isFinite(temperatura) &&
    (temperatura < RANGO_TERMICO.minimo || temperatura > RANGO_TERMICO.maximo)
  if (lectura.excursion_confirmada || fueraDeRango) return 'excursion_critica'
  if (temperatura == null || !Number.isFinite(temperatura) || lectura.origen_clasificacion === 'fallo_sensor') return 'falla_sensor'
  if (lectura.riesgo_efectivo == null || lectura.nivel_riesgo == null || lectura.estado_inferencia !== 'completada') {
    return 'sin_clasificacion_ia'
  }
  return lectura.riesgo_efectivo
}

/**
 * HU-07 (H2): la lectura no tiene hora de captura. Usa `sin_hora` del backend;
 * sin él, la misma regla: `unsynced` sin hora reconstruida y no manual.
 */
export function lecturaSinHora(
  lectura: Pick<LecturaTermica, 'sin_hora' | 'origen' | 'time_quality' | 'timestamp_estimado'>,
): boolean {
  if (typeof lectura.sin_hora === 'boolean') return lectura.sin_hora
  return lectura.origen !== 'manual' && lectura.time_quality === 'unsynced' && !lectura.timestamp_estimado
}

/** Instante de captura en ms (la hora reconstruida si existe); null sin hora. */
export function instanteCaptura(lectura: LecturaTermica): number | null {
  if (lecturaSinHora(lectura)) return null
  const ms = Date.parse(lectura.timestamp_estimado || lectura.timestamp)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Serie para la curva (HU-07): sin las lecturas sin hora, que no se pueden
 * ubicar en el eje, y cada una en su hora de captura. Si ninguna lo necesita
 * devuelve la misma referencia (no rompe la memoización de la gráfica).
 */
export function serieGraficable(serie: LecturaTermica[]): LecturaTermica[] {
  if (!serie.some((l) => lecturaSinHora(l) || l.timestamp_estimado)) return serie
  return serie
    .flatMap((l) => {
      const ms = instanteCaptura(l)
      if (ms === null) return []
      return [l.timestamp_estimado ? { ...l, timestamp: new Date(ms).toISOString() } : l]
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

/** B-15: `time_quality` de una lectura según la API (ver contrato_v1.TIME_QUALITY_INTERNO). */
export const TIME_QUALITY_LECTURA = ['synced', 'backfilled', 'unsynced'] as const
export type TimeQualityLectura = (typeof TIME_QUALITY_LECTURA)[number]
