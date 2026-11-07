import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { estaEnRango, type NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { umbralHueco } from '@/infrastructure/charts/curvaTermica'
import { fechaISOlocal, localeActual } from '@/lib/formato'

type Traductor = (clave: string, opciones?: Record<string, unknown>) => string

export interface ResumenLecturas {
  total: number
  minima: number | null
  maxima: number | null
  /** Lecturas fuera de 2–8 °C según `fueraDelRango`, nunca por la clase cruda de la IA (HU-34). */
  fueraDeRango: number
}

export interface DiaDeLecturas {
  /** Día del calendario local, `yyyy-MM-dd`. */
  clave: string
  lecturas: LecturaTermica[]
}

export function claveDeDia(iso: string): string {
  return fechaISOlocal(new Date(iso))
}

/**
 * Fuera del rango: lo confirmó la regla de rango (HU-34) o la propia cifra cae fuera de 2–8 °C. Lo
 * segundo cubre una lectura que la regla todavía no marcó: «siempre dentro del rango» tiene que ser
 * cierto para cada cifra que se ve. La clase cruda de la IA (`nivel_riesgo`) no cuenta nunca.
 */
export function fueraDelRango(lectura: LecturaTermica): boolean {
  if (lectura.excursion_confirmada) return true
  const valor = lectura.temperatura_interna
  return valor != null && Number.isFinite(valor) && !estaEnRango(valor)
}

/** Solo cuenta lo medido: una lectura sin temperatura interna no entra en mínimo ni máximo. */
export function resumir(lecturas: LecturaTermica[]): ResumenLecturas {
  let minima: number | null = null
  let maxima: number | null = null
  let fueraDeRango = 0
  for (const lectura of lecturas) {
    if (fueraDelRango(lectura)) fueraDeRango += 1
    const valor = lectura.temperatura_interna
    if (valor == null || !Number.isFinite(valor)) continue
    if (minima === null || valor < minima) minima = valor
    if (maxima === null || valor > maxima) maxima = valor
  }
  return { total: lecturas.length, minima, maxima, fueraDeRango }
}

/** Agrupa conservando el orden de llegada (el backend entrega primero lo más reciente). */
export function agruparPorDia(lecturas: LecturaTermica[]): DiaDeLecturas[] {
  const dias: DiaDeLecturas[] = []
  for (const lectura of lecturas) {
    const clave = claveDeDia(lectura.timestamp)
    const actual = dias[dias.length - 1]
    if (actual?.clave === clave) actual.lecturas.push(lectura)
    else dias.push({ clave, lecturas: [lectura] })
  }
  return dias
}

/** «Hoy», «Ayer» o la fecha, para encabezar un día. */
export function tituloDeDia(clave: string, t: Traductor, ahora = new Date()): string {
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (clave === fechaISOlocal(ahora)) return t('comunes.hoy')
  if (clave === fechaISOlocal(ayer)) return t('historial.ayer')
  return new Date(`${clave}T12:00:00`).toLocaleDateString(localeActual(), { day: 'numeric', month: 'long' })
}

const SEVERIDAD: Record<NivelRiesgo, number> = { normal: 0, riesgo_preventivo: 1, excursion_critica: 2 }

/**
 * La cinta del día: `tramos` franjas iguales de 00:00 a 24:00, cada una con el riesgo más grave
 * registrado en ella. Un tramo sin lecturas queda en `null`: no se pinta como si estuviera bien.
 */
export function cintaDelDia(lecturas: LecturaTermica[], tramos = 48): Array<NivelRiesgo | 'sin_clasificar' | null> {
  const cinta: Array<NivelRiesgo | 'sin_clasificar' | null> = Array.from({ length: tramos }, () => null)
  for (const lectura of lecturas) {
    const fecha = new Date(lectura.timestamp)
    if (Number.isNaN(fecha.getTime())) continue
    const minutos = fecha.getHours() * 60 + fecha.getMinutes()
    const tramo = Math.min(tramos - 1, Math.floor((minutos / (24 * 60)) * tramos))
    const previo = cinta[tramo]
    const riesgo = lectura.riesgo_efectivo
    if (!riesgo) {
      if (previo === null) cinta[tramo] = 'sin_clasificar'
    } else if (previo === null || previo === 'sin_clasificar' || SEVERIDAD[riesgo] > SEVERIDAD[previo]) {
      cinta[tramo] = riesgo
    }
  }
  return cinta
}

/* ── Periodos ───────────────────────────────────────────────────────────── */

export type Atajo = '24h' | 'hoy' | 'ayer' | '7d'
export type Periodo = Atajo | 'personalizado'

/** Lo que se pide al backend para cada atajo, en el formato del selector de fecha (`yyyy-MM-ddTHH:mm`). */
export function filtrosDeAtajo(atajo: Atajo, ahora = new Date()): { desde?: string; hasta?: string } {
  const dia = (desplazamiento: number) => {
    const fecha = new Date(ahora)
    fecha.setDate(fecha.getDate() + desplazamiento)
    return `${fechaISOlocal(fecha)}T00:00`
  }
  if (atajo === 'hoy') return { desde: dia(0) }
  // Hasta las 00:00 de hoy, y la ventana deja fuera ese instante: el día completo, sin perder su último minuto.
  if (atajo === 'ayer') return { desde: dia(-1), hasta: dia(0) }
  if (atajo === '7d') return { desde: dia(-6) }
  return {}
}

export interface Ventana {
  /** Primer instante incluido; `null` sin límite. */
  inicio: number | null
  /** Primer instante excluido; `null` llega hasta ahora. */
  fin: number | null
}

/** La ventana que resume la frase. «24 horas» no filtra en el backend: se recorta aquí. */
export function ventanaDe(periodo: Periodo, filtros: { desde?: string; hasta?: string }, ahoraMs: number): Ventana {
  if (periodo === '24h') return { inicio: ahoraMs - 24 * 60 * 60 * 1000, fin: null }
  const desde = filtros.desde ? Date.parse(filtros.desde) : NaN
  const hasta = filtros.hasta ? Date.parse(filtros.hasta) : NaN
  return {
    inicio: Number.isFinite(desde) ? desde : null,
    // Un «hasta» elegido a mano incluye su minuto; el de «Ayer» es el comienzo de hoy y no.
    fin: Number.isFinite(hasta) ? hasta + (periodo === 'ayer' ? 0 : 60_000) : null,
  }
}

export function dentroDeVentana(lecturas: LecturaTermica[], ventana: Ventana): LecturaTermica[] {
  if (ventana.inicio === null && ventana.fin === null) return lecturas
  return lecturas.filter((lectura) => {
    const ms = Date.parse(lectura.timestamp)
    return (ventana.inicio === null || ms >= ventana.inicio) && (ventana.fin === null || ms < ventana.fin)
  })
}

/* ── Salidas del rango ──────────────────────────────────────────────────── */

export interface SalidaDeRango {
  id: string
  device_id: string
  /** Lecturas de la salida, de la más antigua a la más reciente. */
  lecturas: LecturaTermica[]
  inicio: string
  fin: string
  /** La cifra más alejada del rango, o `null` si ninguna trae temperatura. */
  extremo: number | null
  puertaAbierta: boolean
  /** Su última lectura es la última del equipo en lo cargado: puede seguir fuera. */
  hastaLaUltima: boolean
}

function distanciaAlRango(valor: number) {
  return valor > 8 ? valor - 8 : valor < 2 ? 2 - valor : 0
}

function porEquipoCronologico(lecturas: LecturaTermica[]): Map<string, LecturaTermica[]> {
  const mapa = new Map<string, LecturaTermica[]>()
  for (const lectura of lecturas) {
    const lista = mapa.get(lectura.device_id)
    if (lista) lista.push(lectura)
    else mapa.set(lectura.device_id, [lectura])
  }
  for (const lista of mapa.values()) lista.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  return mapa
}

/**
 * Cada vez que un equipo salió del rango: lecturas seguidas fuera de 2–8 °C, por equipo. Un hueco sin
 * lecturas corta la salida, como corta la curva. Devuelve primero la más reciente.
 */
export function salidasDeRango(lecturas: LecturaTermica[]): SalidaDeRango[] {
  const salidas: SalidaDeRango[] = []
  for (const [equipo, serie] of porEquipoCronologico(lecturas)) {
    const umbral = umbralHueco(serie)
    let actual: SalidaDeRango | null = null
    let previo: number | null = null
    for (const lectura of serie) {
      const ms = Date.parse(lectura.timestamp)
      const continua = previo !== null && ms - previo < umbral
      if (fueraDelRango(lectura)) {
        if (actual && continua) {
          actual.lecturas.push(lectura)
          actual.fin = lectura.timestamp
        } else {
          actual = {
            id: `${equipo}-${lectura.timestamp}`,
            device_id: equipo,
            lecturas: [lectura],
            inicio: lectura.timestamp,
            fin: lectura.timestamp,
            extremo: null,
            puertaAbierta: false,
            hastaLaUltima: false,
          }
          salidas.push(actual)
        }
        const valor = lectura.temperatura_interna
        if (valor != null && Number.isFinite(valor) && (actual.extremo === null || distanciaAlRango(valor) > distanciaAlRango(actual.extremo))) {
          actual.extremo = valor
        }
        if (lectura.apertura_refrigerador === true) actual.puertaAbierta = true
      } else {
        actual = null
      }
      previo = ms
    }
    if (actual) actual.hastaLaUltima = true
  }
  return salidas.sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio))
}

/* ── La frase del periodo ───────────────────────────────────────────────── */

/** Un hueco que se nombra en la frase: más corto que esto no pudo esconder una salida que importe. */
export const HUECO_QUE_SE_NOMBRA_MS = 60 * 60 * 1000
/** Lo cargado empieza tarde si su primera lectura llega después de esto. */
const HOLGURA_COBERTURA_MS = 15 * 60 * 1000

export type ResumenPeriodo =
  | { tipo: 'sin_lecturas'; ultima: string | null }
  | { tipo: 'sin_temperatura'; desdeParcial: string | null }
  | { tipo: 'dentro'; desdeParcial: string | null; huecoMs: number }
  | { tipo: 'fuera'; salidas: SalidaDeRango[]; enCurso: SalidaDeRango | null; desdeParcial: string | null; huecoMs: number }

/** El tramo más largo sin lecturas de un mismo equipo, contando hasta el final de la ventana. */
function huecoMasLargo(lecturas: LecturaTermica[], finMs: number): number {
  let mayor = 0
  for (const serie of porEquipoCronologico(lecturas).values()) {
    const umbral = Math.max(umbralHueco(serie), HUECO_QUE_SE_NOMBRA_MS)
    let previo: number | null = null
    let suma = 0
    for (const lectura of serie) {
      const ms = Date.parse(lectura.timestamp)
      if (previo !== null && ms - previo >= umbral) suma += ms - previo
      previo = ms
    }
    if (previo !== null && finMs - previo >= umbral) suma += finMs - previo
    mayor = Math.max(mayor, suma)
  }
  return mayor
}

/**
 * Qué pasó en la ventana, en una sola respuesta. `todas` son las lecturas cargadas y `enVentana` las de
 * la ventana. Si lo cargado empieza bastante después del inicio de la ventana (el backend entrega un
 * máximo de lecturas, o el equipo empezó a reportar más tarde), se dice desde cuándo hay datos.
 */
export function resumirPeriodo(
  todas: LecturaTermica[],
  enVentana: LecturaTermica[],
  ventana: Ventana,
  ahoraMs: number,
): ResumenPeriodo {
  if (enVentana.length === 0) {
    let ultima: string | null = null
    for (const lectura of todas) if (ultima === null || lectura.timestamp > ultima) ultima = lectura.timestamp
    return { tipo: 'sin_lecturas', ultima }
  }
  let primera = Infinity
  for (const lectura of enVentana) primera = Math.min(primera, Date.parse(lectura.timestamp))
  const desdeParcial =
    ventana.inicio !== null && primera - ventana.inicio > HOLGURA_COBERTURA_MS ? new Date(primera).toISOString() : null

  if (!enVentana.some((lectura) => lectura.temperatura_interna != null && Number.isFinite(lectura.temperatura_interna))) {
    return { tipo: 'sin_temperatura', desdeParcial }
  }
  const finMs = ventana.fin === null ? ahoraMs : Math.min(ventana.fin, ahoraMs)
  const huecoMs = huecoMasLargo(enVentana, finMs)
  const salidas = salidasDeRango(enVentana)
  if (salidas.length === 0) return { tipo: 'dentro', desdeParcial, huecoMs }

  // Sigue fuera si su última lectura es la última del equipo y la ventana llega hasta ahora.
  const enCurso =
    ventana.fin === null
      ? (salidas.find((salida) => salida.hastaLaUltima && ahoraMs - Date.parse(salida.fin) < HUECO_QUE_SE_NOMBRA_MS) ?? null)
      : null
  return { tipo: 'fuera', salidas, enCurso, desdeParcial, huecoMs }
}

/* ── Horas y duraciones en palabras ─────────────────────────────────────── */

/** `02:10`: hora de 24 h, como el tooltip de la curva. */
export function hora24(iso: string): string {
  return new Date(iso).toLocaleTimeString(localeActual(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

function cualDia(iso: string, ahora: Date): 'hoy' | 'ayer' | 'otro' {
  const clave = claveDeDia(iso)
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  return clave === fechaISOlocal(ahora) ? 'hoy' : clave === fechaISOlocal(ayer) ? 'ayer' : 'otro'
}

function fechaBreve(iso: string) {
  return new Date(iso).toLocaleDateString(localeActual(), { day: 'numeric', month: 'short' })
}

/** «a las 02:10», «ayer a las 02:10» o «el 3 nov a las 02:10». */
export function cuandoFue(iso: string, t: Traductor, ahora = new Date()): string {
  return t(`historial.cuando.${cualDia(iso, ahora)}`, { hora: hora24(iso), fecha: fechaBreve(iso) })
}

/** «Desde las 02:10», «Desde ayer a las 02:10» o «Desde el 3 nov a las 02:10». */
export function desdeCuando(iso: string, t: Traductor, ahora = new Date()): string {
  return t(`historial.desdeCuando.${cualDia(iso, ahora)}`, { hora: hora24(iso), fecha: fechaBreve(iso) })
}

/** «50 min», «3 h» o «1 h 20 min». */
export function duracionTexto(ms: number): string {
  const minutos = Math.max(1, Math.round(ms / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

export function primeraEnMinuscula(texto: string): string {
  return texto.charAt(0).toLocaleLowerCase() + texto.slice(1)
}

/** Lo que la frase no alcanza a decir: desde cuándo hay datos, huecos sin lecturas, salidas anteriores. */
export function notaDelResumen(resumen: ResumenPeriodo, t: Traductor): string | null {
  const notas: string[] = []
  if (resumen.tipo === 'sin_lecturas') {
    if (resumen.ultima) notas.push(t('historial.nota.ultima', { cuando: cuandoFue(resumen.ultima, t) }))
    return notas.join(' ') || null
  }
  if (resumen.desdeParcial) {
    notas.push(
      resumen.tipo === 'dentro'
        ? t('historial.nota.anteriores')
        : t('historial.nota.parcial', { desde: primeraEnMinuscula(desdeCuando(resumen.desdeParcial, t)) }),
    )
  }
  if (resumen.tipo === 'fuera' && resumen.enCurso && resumen.salidas.length > 1) {
    notas.push(t('historial.nota.salidasAntes', { count: resumen.salidas.length - 1 }))
  }
  if ((resumen.tipo === 'dentro' || resumen.tipo === 'fuera') && resumen.huecoMs >= HUECO_QUE_SE_NOMBRA_MS) {
    notas.push(t('historial.nota.hueco', { duracion: duracionTexto(resumen.huecoMs) }))
  }
  return notas.join(' ') || null
}
