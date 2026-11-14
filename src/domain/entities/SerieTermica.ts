import { instanteCaptura, type LecturaTermica } from './LecturaTermica'

/**
 * HU-31 / HU-36: serie agregada del periodo COMPLETO (`GET /api/lecturas/serie`).
 *
 * El backend agrupa las lecturas del nodo en intervalos alineados a la época
 * UNIX y entrega, por intervalo, mínimo, máximo, promedio y conteo; los
 * intervalos sin lecturas no vienen y los tramos sin datos llegan en
 * `brechas`. A diferencia de pedir lecturas crudas con tope (5000 filas, unas
 * 14 h a 10 s por lectura), cubre todo el rango pedido.
 */
export interface EstadisticaMagnitud {
  min: number | null
  max: number | null
  promedio: number | null
  /** Lecturas con valor de esta magnitud. */
  n?: number
}

export interface BucketSerie {
  inicio: string
  fin: string
  lecturas: number
  temperatura_interna: EstadisticaMagnitud
  temperatura_ambiental: EstadisticaMagnitud
  humedad_ambiental: EstadisticaMagnitud
  fuera_de_rango?: number
  /** Lecturas con excursión confirmada por la regla 2-8 °C (HU-21). */
  excursiones?: number
}

/** «sin_datos»: el nodo calló; «buffer_agotado»: LittleFS lleno (HU-48). */
export type CausaBrechaSerie = 'sin_datos' | 'buffer_agotado'
/** Alias usado por el Historial (HU-36). */
export type CausaBrecha = CausaBrechaSerie

export interface BrechaSerie {
  desde: string
  hasta: string
  duracion_segundos: number
  causa: CausaBrechaSerie
  perdidas?: number | null
  /** Sigue abierta al final del periodo. */
  abierta?: boolean
}

export interface ResumenSerie {
  lecturas: number
  temperatura_interna: EstadisticaMagnitud
  temperatura_ambiental: EstadisticaMagnitud
  humedad_ambiental: EstadisticaMagnitud
  fuera_de_rango?: number
  excursiones?: number
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
  /** Lecturas del nodo con hora en el periodo (la suma de `lecturas` de los intervalos). */
  total_lecturas: number
  /** HU-07: lecturas sin hora de captura; se cuentan pero no se grafican. */
  lecturas_sin_hora: number
  lecturas_manuales: number
  buckets: BucketSerie[]
  brechas: BrechaSerie[]
  /** El backend lista a lo sumo 500 brechas. */
  brechas_truncadas?: boolean
  resumen: ResumenSerie
}

/** Mismos topes que `consultar_serie_termica.py` del backend. */
export const SERIE_RANGO_MAXIMO_DIAS = 366
/** HU-31 esc. 4 / HU-36: sin rango, las últimas 24 horas. */
export const SERIE_VENTANA_POR_DEFECTO_MS = 24 * 60 * 60 * 1000
/** Intervalos candidatos del modo `auto` del backend, en segundos. */
export const CANDIDATOS_BUCKET_AUTO = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14_400, 21_600, 43_200, 86_400] as const
export const SERIE_BUCKETS_AUTOMATICOS = CANDIDATOS_BUCKET_AUTO
/** Tope de intervalos del modo `auto`. */
export const MAX_BUCKETS_AUTO = 1500
export const SERIE_MAX_BUCKETS_AUTO = MAX_BUCKETS_AUTO

/** Mismo criterio que `elegir_bucket` del backend: el menor candidato que deja la serie en ≤ 1500 intervalos. */
export function bucketAutomatico(desdeMs: number, hastaMs: number): number {
  const segundos = Math.max(1, (hastaMs - desdeMs) / 1000)
  return CANDIDATOS_BUCKET_AUTO.find((b) => segundos / b <= MAX_BUCKETS_AUTO) ?? CANDIDATOS_BUCKET_AUTO[CANDIDATOS_BUCKET_AUTO.length - 1]
}

/** Mínima, máxima, promedio y excursiones confirmadas de lo que muestra la curva. */
export interface ResumenCurva {
  minima: number
  maxima: number
  promedio: number
  fueraDeRango: number
  lecturas: number
}

/**
 * Resumen del periodo completo (el de la serie agregada) más las lecturas en
 * vivo que llegaron después de su `hasta`. null si no hay temperatura alguna.
 */
export function resumenCombinado(serie: SerieTermica, enVivo: readonly LecturaTermica[] = []): ResumenCurva | null {
  const hastaMs = Date.parse(serie.hasta)
  const nuevas = enVivo.filter((l) => {
    const ms = instanteCaptura(l)
    return ms !== null && ms > hastaMs
  })
  const base = serie.resumen.temperatura_interna
  const nBase = base.n ?? (base.promedio != null ? serie.resumen.lecturas : 0)
  const temps = nuevas.map((l) => l.temperatura_interna).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const valores = [base.min, base.max, ...temps].filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (valores.length === 0) return null
  const suma = (base.promedio != null ? base.promedio * nBase : 0) + temps.reduce((total, v) => total + v, 0)
  const n = (base.promedio != null ? nBase : 0) + temps.length
  return {
    minima: Math.min(...valores),
    maxima: Math.max(...valores),
    promedio: n > 0 ? suma / n : (base.promedio ?? temps[0]),
    fueraDeRango: (serie.resumen.excursiones ?? serie.resumen.fuera_de_rango ?? 0) + nuevas.filter((l) => l.excursion_confirmada).length,
    lecturas: serie.resumen.lecturas + nuevas.length,
  }
}
