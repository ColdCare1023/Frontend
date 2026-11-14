/**
 * HU-31 / HU-36: serie térmica agregada de un equipo en un periodo
 * (`GET /api/lecturas/serie`). La curva y el resumen del Historial salen de
 * aquí y no de una lista de lecturas crudas con tope: el backend agrega el
 * periodo COMPLETO en intervalos (mínimo, máximo, promedio y conteo), así que
 * 24 h a 10 s por lectura o 7 días a 30 s se dibujan enteros.
 */

/** Estadística de una magnitud en un intervalo o en todo el periodo. */
export interface EstadisticaMagnitud {
  min: number | null
  max: number | null
  promedio: number | null
  /** Lecturas con valor de esa magnitud. */
  n: number
}

/** Un intervalo de la serie, alineado a la época; los vacíos se omiten. */
export interface BucketSerie {
  inicio: string
  fin: string
  lecturas: number
  temperatura_interna: EstadisticaMagnitud
  temperatura_ambiental: EstadisticaMagnitud
  humedad_ambiental: EstadisticaMagnitud
  /** Lecturas con la temperatura interna fuera de 2–8 °C. */
  fuera_de_rango?: number
  /** Lecturas con excursión confirmada (regla directa de rango, HU-34). */
  excursiones?: number
}

/** Causa de una brecha: sin datos o buffer LittleFS agotado (HU-48). */
export type CausaBrecha = 'sin_datos' | 'buffer_agotado'

export interface BrechaSerie {
  desde: string
  hasta: string
  duracion_segundos: number
  causa: CausaBrecha
  /** Muestras que el nodo no pudo guardar (solo con `buffer_agotado`). */
  perdidas?: number | null
  /** La brecha sigue abierta (el periodo llega a «ahora»). */
  abierta?: boolean
}

export interface ResumenSerie {
  lecturas: number
  temperatura_interna: EstadisticaMagnitud
  temperatura_ambiental: EstadisticaMagnitud
  humedad_ambiental: EstadisticaMagnitud
  fuera_de_rango?: number
  excursiones?: number
  /** Conteo por riesgo efectivo (clave: clase, valor: lecturas). */
  por_riesgo_efectivo?: Record<string, number>
  primera_lectura_en?: string | null
  ultima_lectura_en?: string | null
}

export interface SerieTermica {
  device_id: string
  desde: string
  hasta: string
  bucket_segundos: number
  bucket_automatico: boolean
  intervalo_reporte_segundos: number
  umbral_brecha_segundos: number
  total_lecturas: number
  /** Lecturas sin hora de captura: se cuentan, pero no se dibujan. */
  lecturas_sin_hora: number
  /** Lecturas manuales (BE-001): se cuentan, pero no se dibujan. */
  lecturas_manuales: number
  buckets: BucketSerie[]
  brechas: BrechaSerie[]
  /** El backend devuelve a lo sumo 500 brechas. */
  brechas_truncadas?: boolean
  resumen: ResumenSerie
}

/** Mismos topes que `consultar_serie_termica.py` del backend. */
export const SERIE_RANGO_MAXIMO_DIAS = 366
export const SERIE_VENTANA_POR_DEFECTO_MS = 24 * 60 * 60 * 1000
export const SERIE_BUCKETS_AUTOMATICOS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400] as const
export const SERIE_MAX_BUCKETS_AUTO = 1500

/** Intervalo automático: el menor que deja la curva en 1500 puntos o menos. */
export function bucketAutomatico(desdeMs: number, hastaMs: number): number {
  const segundos = Math.max(1, (hastaMs - desdeMs) / 1000)
  for (const candidato of SERIE_BUCKETS_AUTOMATICOS) {
    if (segundos / candidato <= SERIE_MAX_BUCKETS_AUTO) return candidato
  }
  return SERIE_BUCKETS_AUTOMATICOS[SERIE_BUCKETS_AUTOMATICOS.length - 1]
}
