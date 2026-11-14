import type { BrechaTelemetria } from '@/domain/entities/Dispositivo'
import { instanteCaptura, lecturaSinHora, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  bucketAutomatico,
  type BrechaSerie,
  type BucketSerie,
  type EstadisticaMagnitud,
  type ResumenSerie,
  type SerieTermica,
} from '@/domain/entities/SerieTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'

/**
 * `GET /api/lecturas/serie` del modo demostración (HU-31): la misma forma y
 * las mismas validaciones que el backend (`SerieTermicaResponse`), calculada
 * en memoria sobre las lecturas simuladas.
 */
export class ErrorSerieDemo extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

const DIA_MS = 86_400_000
const MAX_DIAS = 366
const BUCKET_MIN = 10
const BUCKET_MAX = 86_400
const MAX_INTERVALOS = 5000
const MAX_BRECHAS = 500
/** Igual que la curva cruda: la demo reporta cada 10 min, no cada 30 s. */
const FACTOR_CADENCIA = 2.5

export interface ParametrosSerieDemo {
  lecturas: readonly LecturaTermica[]
  deviceId: string
  desde: number
  hasta: number
  bucket: string | undefined
  intervaloReporteSegundos: number
  nIntervalosSinDatos?: number
  brechasBuffer?: readonly BrechaTelemetria[]
  registradoEn?: string | null
}

const iso = (ms: number) => new Date(ms).toISOString()
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function estadistica(valores: readonly (number | null | undefined)[]): EstadisticaMagnitud {
  const v = valores.filter(finito)
  if (v.length === 0) return { min: null, max: null, promedio: null, n: 0 }
  const promedio = v.reduce((s, x) => s + x, 0) / v.length
  return { min: Math.min(...v), max: Math.max(...v), promedio: Math.round(promedio * 100) / 100, n: v.length }
}

const fueraDeRango = (l: LecturaTermica) =>
  finito(l.temperatura_interna) && (l.temperatura_interna < RANGO_TERMICO.minimo || l.temperatura_interna > RANGO_TERMICO.maximo)

function bucketDe(segundos: string | undefined, desde: number, hasta: number): { segundos: number; automatico: boolean } {
  if (segundos === undefined || segundos === 'auto') return { segundos: bucketAutomatico(desde, hasta), automatico: true }
  if (!/^\d{1,6}$/.test(segundos)) throw new ErrorSerieDemo(422, 'bucket debe ser «auto» o un número de segundos')
  const valor = Number(segundos)
  if (valor < BUCKET_MIN || valor > BUCKET_MAX) throw new ErrorSerieDemo(422, `bucket fuera de rango (${BUCKET_MIN} a ${BUCKET_MAX} s)`)
  return { segundos: valor, automatico: false }
}

/** Percentil 25 de los pasos entre lecturas: la cadencia típica de la serie. */
function cadenciaTipica(instantes: readonly number[]): number | null {
  const pasos: number[] = []
  for (let i = 1; i < instantes.length; i++) if (instantes[i] > instantes[i - 1]) pasos.push(instantes[i] - instantes[i - 1])
  if (pasos.length === 0) return null
  pasos.sort((a, b) => a - b)
  return pasos[Math.floor((pasos.length - 1) * 0.25)]
}

export function serieTermicaDemo(p: ParametrosSerieDemo): SerieTermica {
  const { desde, hasta } = p
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) throw new ErrorSerieDemo(422, 'Fechas inválidas')
  if (desde > hasta) throw new ErrorSerieDemo(422, 'desde no puede ser posterior a hasta')
  if (hasta - desde > MAX_DIAS * DIA_MS) throw new ErrorSerieDemo(422, `El rango no puede superar ${MAX_DIAS} días`)
  const bucket = bucketDe(p.bucket, desde, hasta)
  if (Math.ceil((hasta - desde) / (bucket.segundos * 1000)) > MAX_INTERVALOS) {
    throw new ErrorSerieDemo(422, `La serie superaría ${MAX_INTERVALOS} intervalos: usa un intervalo mayor`)
  }

  const delEquipo = p.lecturas.filter((l) => l.device_id === p.deviceId)
  const manuales = delEquipo.filter((l) => l.origen === 'manual')
  const delNodo = delEquipo.filter((l) => l.origen !== 'manual')
  const enRango = (ms: number | null) => ms !== null && ms >= desde && ms <= hasta
  const conHora = delNodo
    .map((l) => ({ l, ms: instanteCaptura(l) }))
    .filter((x): x is { l: LecturaTermica; ms: number } => enRango(x.ms))
    .sort((a, b) => a.ms - b.ms)
  // Sin hora: cuenta por su llegada al backend (`timestamp`).
  const sinHora = delNodo.filter((l) => lecturaSinHora(l) && enRango(Date.parse(l.timestamp))).length
  const nManuales = manuales.filter((l) => enRango(Date.parse(l.timestamp))).length

  const paso = bucket.segundos * 1000
  const grupos = new Map<number, LecturaTermica[]>()
  for (const { l, ms } of conHora) {
    const indice = Math.floor(ms / paso)
    const grupo = grupos.get(indice)
    if (grupo) grupo.push(l)
    else grupos.set(indice, [l])
  }
  const buckets: BucketSerie[] = [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([indice, grupo]) => ({
      inicio: iso(indice * paso),
      fin: iso((indice + 1) * paso),
      lecturas: grupo.length,
      temperatura_interna: estadistica(grupo.map((l) => l.temperatura_interna)),
      temperatura_ambiental: estadistica(grupo.map((l) => l.temperatura_ambiental)),
      humedad_ambiental: estadistica(grupo.map((l) => l.humedad_ambiental)),
      fuera_de_rango: grupo.filter(fueraDeRango).length,
      excursiones: grupo.filter((l) => l.excursion_confirmada).length,
    }))

  // Brechas: silencio mayor que N × intervalo del nodo (HU-54). La demo
  // reporta cada 10 min: el umbral se ajusta a su cadencia como la curva cruda.
  const instantes = conHora.map((x) => x.ms)
  const cadencia = cadenciaTipica(instantes)
  const umbralMs = Math.max((p.nIntervalosSinDatos ?? 3) * p.intervaloReporteSegundos * 1000, cadencia ? cadencia * FACTOR_CADENCIA : 0)
  const registrado = p.registradoEn ? Date.parse(p.registradoEn) : Number.NaN
  const inicio = Number.isFinite(registrado) ? Math.max(desde, registrado) : desde
  const huecos: Array<{ desde: number; hasta: number; abierta: boolean }> = []
  if (instantes.length === 0) {
    if (hasta - inicio > umbralMs) huecos.push({ desde: inicio, hasta, abierta: true })
  } else {
    if (instantes[0] - inicio > umbralMs) huecos.push({ desde: inicio, hasta: instantes[0], abierta: false })
    for (let i = 1; i < instantes.length; i++) {
      if (instantes[i] - instantes[i - 1] > umbralMs) huecos.push({ desde: instantes[i - 1], hasta: instantes[i], abierta: false })
    }
    const ultimo = instantes[instantes.length - 1]
    if (hasta - ultimo > umbralMs) huecos.push({ desde: ultimo, hasta, abierta: true })
  }
  // HU-48 esc. 2 (como `clasificar_brechas` del backend): un hueco que coincide
  // con un episodio de buffer agotado tiene esa causa y sus muestras perdidas.
  const episodios = (p.brechasBuffer ?? []).map((b) => ({
    desde: b.desde ? Date.parse(b.desde) : null,
    hasta: b.hasta ? Date.parse(b.hasta) : null,
    perdidas: b.perdidas ?? b.muestras_perdidas ?? 0,
  }))
  const brechas: BrechaSerie[] = huecos.map((h) => {
    const coinciden = episodios.filter(
      (e) => (e.desde !== null || e.hasta !== null) && (e.desde === null || e.desde <= h.hasta) && (e.hasta === null || e.hasta >= h.desde),
    )
    return {
      desde: iso(h.desde),
      hasta: iso(h.hasta),
      duracion_segundos: Math.round((h.hasta - h.desde) / 1000),
      causa: coinciden.length > 0 ? 'buffer_agotado' : 'sin_datos',
      perdidas: coinciden.length > 0 ? coinciden.reduce((total, e) => total + e.perdidas, 0) : null,
      abierta: h.abierta,
    }
  })

  const lecturasPeriodo = conHora.map((x) => x.l)
  const porRiesgo: Record<string, number> = {}
  for (const l of lecturasPeriodo) {
    const clave = l.riesgo_efectivo ?? 'sin_clasificar'
    porRiesgo[clave] = (porRiesgo[clave] ?? 0) + 1
  }
  const resumen: ResumenSerie = {
    lecturas: lecturasPeriodo.length,
    temperatura_interna: estadistica(lecturasPeriodo.map((l) => l.temperatura_interna)),
    temperatura_ambiental: estadistica(lecturasPeriodo.map((l) => l.temperatura_ambiental)),
    humedad_ambiental: estadistica(lecturasPeriodo.map((l) => l.humedad_ambiental)),
    fuera_de_rango: lecturasPeriodo.filter(fueraDeRango).length,
    excursiones: lecturasPeriodo.filter((l) => l.excursion_confirmada).length,
    por_riesgo_efectivo: porRiesgo,
    primera_lectura_en: instantes.length ? iso(instantes[0]) : null,
    ultima_lectura_en: instantes.length ? iso(instantes[instantes.length - 1]) : null,
  }

  return {
    device_id: p.deviceId,
    desde: iso(desde),
    hasta: iso(hasta),
    bucket_segundos: bucket.segundos,
    bucket_automatico: bucket.automatico,
    intervalo_reporte_segundos: p.intervaloReporteSegundos,
    umbral_brecha_segundos: Math.round(umbralMs / 1000),
    total_lecturas: lecturasPeriodo.length,
    lecturas_sin_hora: sinHora,
    lecturas_manuales: nManuales,
    buckets,
    brechas: brechas.slice(0, MAX_BRECHAS),
    brechas_truncadas: brechas.length > MAX_BRECHAS,
    resumen,
  }
}
