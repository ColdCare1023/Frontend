import type { BrechaTelemetria } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import {
  bucketAutomatico,
  SERIE_RANGO_MAXIMO_DIAS,
  SERIE_VENTANA_POR_DEFECTO_MS,
  type BrechaSerie,
  type BucketSerie,
  type EstadisticaMagnitud,
  type SerieTermica,
} from '@/domain/entities/SerieTermica'

/**
 * Modo demo: `GET /api/lecturas/serie` calculado en memoria con las mismas
 * reglas que `consultar_serie_termica.py` del backend (intervalo automático,
 * topes, agregados por intervalo alineado a la época, brechas y resumen).
 * Devuelve el cuerpo o un error `{ status, detalle }` para el adaptador.
 */

export interface EquipoSerieDemo {
  id: string
  intervalo_reporte_segundos?: number | null
  registrado_en?: string | null
  buffer_littlefs?: { brechas?: BrechaTelemetria[] } | null
}

export type ResultadoSerieDemo = { ok: true; serie: SerieTermica } | { ok: false; status: number; detalle: string }

const BUCKET_MINIMO = 10
const BUCKET_MAXIMO = 86_400
const MAX_BUCKETS_MANUAL = 5000
const MAX_BRECHAS = 500
const N_INTERVALOS_SIN_DATOS = 3

interface Acumulado {
  min: number | null
  max: number | null
  suma: number
  n: number
}

const vacio = (): Acumulado => ({ min: null, max: null, suma: 0, n: 0 })

function sumar(acc: Acumulado, valor: number | null | undefined): void {
  if (valor == null || !Number.isFinite(valor)) return
  acc.min = acc.min === null ? valor : Math.min(acc.min, valor)
  acc.max = acc.max === null ? valor : Math.max(acc.max, valor)
  acc.suma += valor
  acc.n += 1
}

const estadistica = (acc: Acumulado): EstadisticaMagnitud => ({
  min: acc.min,
  max: acc.max,
  promedio: acc.n > 0 ? Math.round((acc.suma / acc.n) * 1000) / 1000 : null,
  n: acc.n,
})

const fueraDeRango = (l: LecturaTermica) => l.temperatura_interna != null && (l.temperatura_interna < 2 || l.temperatura_interna > 8)

/**
 * Umbral de brecha: el del backend (N × intervalo del nodo) o, si la demo
 * genera la historia con un paso mayor (10 min), 2,5 × ese paso: si no, cada
 * intervalo entre dos lecturas generadas sería una «brecha».
 */
function umbralBrecha(equipo: EquipoSerieDemo, tiempos: number[]): number {
  const intervalo = Math.max(1, equipo.intervalo_reporte_segundos ?? 30)
  const pasos = tiempos.slice(1).map((t, i) => t - tiempos[i]).filter((p) => p > 0).sort((a, b) => a - b)
  const cadencia = pasos.length > 0 ? pasos[Math.floor((pasos.length - 1) * 0.25)] / 1000 : 0
  return Math.max(intervalo * N_INTERVALOS_SIN_DATOS, Math.ceil(cadencia * 2.5))
}

export function calcularSerieDemo(
  params: Record<string, string>,
  equipo: EquipoSerieDemo | undefined,
  todas: readonly LecturaTermica[],
  ahora = Date.now(),
): ResultadoSerieDemo {
  const deviceId = params.device_id ?? ''
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(deviceId)) return { ok: false, status: 422, detalle: 'device_id no válido' }
  if (!equipo) return { ok: false, status: 404, detalle: 'Dispositivo no encontrado' }

  const hasta = params.hasta ? Date.parse(params.hasta) : ahora
  const desde = params.desde ? Date.parse(params.desde) : hasta - SERIE_VENTANA_POR_DEFECTO_MS
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return { ok: false, status: 422, detalle: 'Fecha no válida' }
  if (desde > hasta) return { ok: false, status: 422, detalle: 'desde no puede ser posterior a hasta' }
  if (hasta - desde > SERIE_RANGO_MAXIMO_DIAS * 86_400_000) {
    return { ok: false, status: 422, detalle: `El periodo no puede superar ${SERIE_RANGO_MAXIMO_DIAS} días` }
  }
  const solicitado = params.bucket && params.bucket !== 'auto' ? Number(params.bucket) : null
  if (solicitado !== null && (!Number.isInteger(solicitado) || solicitado < BUCKET_MINIMO || solicitado > BUCKET_MAXIMO)) {
    return { ok: false, status: 422, detalle: `El intervalo de agregación debe estar entre ${BUCKET_MINIMO} y ${BUCKET_MAXIMO} segundos` }
  }
  if (solicitado !== null && (hasta - desde) / 1000 / solicitado > MAX_BUCKETS_MANUAL) {
    return { ok: false, status: 422, detalle: `El intervalo de ${solicitado} s produce más de ${MAX_BUCKETS_MANUAL} puntos para este periodo` }
  }
  const bucket = solicitado ?? bucketAutomatico(desde, hasta)
  const paso = bucket * 1000

  const lecturas = todas
    .filter((l) => l.device_id === deviceId)
    .map((l) => ({ l, t: Date.parse(l.timestamp) }))
    .filter(({ t }) => Number.isFinite(t) && t >= desde && t <= hasta)
    .sort((a, b) => a.t - b.t)

  const porBucket = new Map<number, { lecturas: number; interna: Acumulado; ambiental: Acumulado; humedad: Acumulado; fuera: number; excursiones: number }>()
  const resumen = { interna: vacio(), ambiental: vacio(), humedad: vacio(), fuera: 0, excursiones: 0, porRiesgo: {} as Record<string, number> }
  for (const { l, t } of lecturas) {
    const inicio = Math.floor(t / paso) * paso
    const b = porBucket.get(inicio) ?? { lecturas: 0, interna: vacio(), ambiental: vacio(), humedad: vacio(), fuera: 0, excursiones: 0 }
    b.lecturas += 1
    sumar(b.interna, l.temperatura_interna)
    sumar(b.ambiental, l.temperatura_ambiental)
    sumar(b.humedad, l.humedad_ambiental)
    if (fueraDeRango(l)) b.fuera += 1
    if (l.excursion_confirmada) b.excursiones += 1
    porBucket.set(inicio, b)
    sumar(resumen.interna, l.temperatura_interna)
    sumar(resumen.ambiental, l.temperatura_ambiental)
    sumar(resumen.humedad, l.humedad_ambiental)
    if (fueraDeRango(l)) resumen.fuera += 1
    if (l.excursion_confirmada) resumen.excursiones += 1
    if (l.riesgo_efectivo) resumen.porRiesgo[l.riesgo_efectivo] = (resumen.porRiesgo[l.riesgo_efectivo] ?? 0) + 1
  }
  const buckets: BucketSerie[] = [...porBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([inicio, b]) => ({
      inicio: new Date(inicio).toISOString(),
      fin: new Date(inicio + paso).toISOString(),
      lecturas: b.lecturas,
      temperatura_interna: estadistica(b.interna),
      temperatura_ambiental: estadistica(b.ambiental),
      humedad_ambiental: estadistica(b.humedad),
      fuera_de_rango: b.fuera,
      excursiones: b.excursiones,
    }))

  const tiempos = lecturas.map(({ t }) => t)
  const umbral = umbralBrecha(equipo, tiempos)
  const huecos: Array<[number, number, boolean]> = []
  if (tiempos.length > 0) {
    const registrado = equipo.registrado_en ? Date.parse(equipo.registrado_en) : Number.NaN
    const inicioUtil = Number.isFinite(registrado) ? Math.max(desde, registrado) : desde
    if (tiempos[0] - inicioUtil > umbral * 1000) huecos.push([inicioUtil, tiempos[0], false])
    for (let i = 1; i < tiempos.length; i++) {
      if (tiempos[i] - tiempos[i - 1] >= umbral * 1000) huecos.push([tiempos[i - 1], tiempos[i], false])
    }
    const finUtil = Math.min(hasta, ahora)
    const ultima = tiempos[tiempos.length - 1]
    if (finUtil - ultima > umbral * 1000) huecos.push([ultima, finUtil, hasta >= ahora - 5000])
  }
  const episodios = equipo.buffer_littlefs?.brechas ?? []
  const brechas: BrechaSerie[] = huecos.slice(0, MAX_BRECHAS).map(([a, b, abierta]) => {
    const coinciden = episodios.filter((e) => Date.parse(e.desde) <= b && Date.parse(e.hasta) >= a)
    return {
      desde: new Date(a).toISOString(),
      hasta: new Date(b).toISOString(),
      duracion_segundos: Math.round((b - a) / 1000),
      causa: coinciden.length > 0 ? 'buffer_agotado' : 'sin_datos',
      perdidas: coinciden.length > 0 ? coinciden.reduce((s, e) => s + (e.muestras_perdidas ?? 0), 0) : null,
      abierta,
    }
  })

  return {
    ok: true,
    serie: {
      device_id: deviceId,
      desde: new Date(desde).toISOString(),
      hasta: new Date(hasta).toISOString(),
      bucket_segundos: bucket,
      bucket_automatico: solicitado === null,
      intervalo_reporte_segundos: equipo.intervalo_reporte_segundos ?? 30,
      umbral_brecha_segundos: umbral,
      total_lecturas: lecturas.length,
      lecturas_sin_hora: 0,
      lecturas_manuales: 0,
      buckets,
      brechas,
      brechas_truncadas: huecos.length > MAX_BRECHAS,
      resumen: {
        lecturas: lecturas.length,
        temperatura_interna: estadistica(resumen.interna),
        temperatura_ambiental: estadistica(resumen.ambiental),
        humedad_ambiental: estadistica(resumen.humedad),
        fuera_de_rango: resumen.fuera,
        excursiones: resumen.excursiones,
        por_riesgo_efectivo: resumen.porRiesgo,
        primera_lectura_en: lecturas.length > 0 ? new Date(tiempos[0]).toISOString() : null,
        ultima_lectura_en: lecturas.length > 0 ? new Date(tiempos[tiempos.length - 1]).toISOString() : null,
      },
    },
  }
}
