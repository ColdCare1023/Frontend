import i18n from '@/infrastructure/i18n'

/**
 * Formato de fechas ligado al idioma del interfaz.
 *
 * Las tablas llamaban a `toLocaleString('es-PE')` con el locale escrito a mano.
 * Con el interfaz en inglés eso producía documentos mixtos —cabeceras en inglés
 * y «14/03/2026, 8:05:12 p. m.» en las celdas— y, peor para una auditoría,
 * fechas en formato día/mes que un lector angloparlante interpreta al revés.
 */
export function localeActual(): string {
  return i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-PE'
}

/** ISO date for date-only forms, derived from the user's local calendar day. */
export function fechaISOlocal(fecha = new Date()): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * La hora y su «a. m.» / «AM» van juntas: en celdas estrechas el navegador
 * cortaba «9:50:40 a.» en una línea y «m.» en la siguiente.
 */
function horaSinCortes(texto: string): string {
  return texto
    .replace(/(\d:\d{2}(?::\d{2})?)\s+([ap]\.)\s*(m\.)/gi, '$1\u00a0$2\u00a0$3')
    .replace(/(\d:\d{2}(?::\d{2})?)\s+([AP]M)\b/g, '$1\u00a0$2')
}

/** Fecha y hora completas, para celdas de tabla y registros de auditoría. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return horaSinCortes(fecha.toLocaleString(localeActual()))
}

/**
 * Solo la hora, con segundos: el eje temporal del monitoreo en vivo. La hora
 * va sin cero a la izquierda («1:57:27 p. m.»), igual que en `fechaHora`.
 */
export function hora(iso: string): string {
  return horaSinCortes(
    new Date(iso).toLocaleTimeString(localeActual(), {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }),
  )
}

/** Solo la fecha, sin hora: encabezados de periodo y resúmenes. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString(localeActual())
}

/**
 * Fecha de calendario sin hora (`yyyy-MM-dd`, p. ej. el vencimiento de un
 * certificado): se muestra el mismo día, sin el desplazamiento de zona horaria
 * que sufre `new Date('2027-05-12')` (medianoche UTC = día anterior en Lima).
 */
export function fechaDia(valor: string | null | undefined): string {
  if (!valor) return '—'
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.slice(0, 10))
  if (!partes) return fechaCorta(valor)
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString(localeActual())
}

/** HU-35: duración de una apertura de puerta en "M:SS" — formato de reloj,
 * no traducible por diseño (igual que "3:20" en cualquier reproductor), así
 * que no depende de `i18n` a diferencia del resto de este módulo. */
export function duracionBreve(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return `${minutos}:${String(resto).padStart(2, '0')}`
}

// ── Formatos compactos de Alertas (con caché de `Intl`, PERF C4) ──────────

const cacheFormatos = new Map<string, Intl.DateTimeFormat>()
function formatoFecha(clave: string, opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = localeActual()
  const id = `${locale}|${clave}`
  let formato = cacheFormatos.get(id)
  if (!formato) {
    formato = new Intl.DateTimeFormat(locale, opciones)
    cacheFormatos.set(id, formato)
  }
  return formato
}

/**
 * «13/11 7:48 a. m.»: día, mes y hora sin año ni segundos, para la línea 2 de
 * una fila. Mismo reloj de 12 h que `hora` y `fechaHora` (antes iba en 24 h y
 * convivía con «01:57 p. m.» en la misma pantalla).
 */
export function fechaHoraCompacta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const dia = formatoFecha('dm', { day: '2-digit', month: '2-digit' }).format(fecha)
  const horaMin = formatoFecha('hm', { hour: 'numeric', minute: '2-digit' }).format(fecha)
  return `${dia}\u00a0${horaSinCortes(horaMin)}`
}

/**
 * Duración legible de una excursión: «45 s», «3 min 5 s», «40 min»,
 * «1 h 20 min». Las unidades son las mismas en español e inglés. Sustituye a
 * `duracionBreve` (M:SS) solo en Alertas; la puerta sigue con su reloj.
 */
export function duracionLegible(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  if (total < 60) return `${total}\u00a0s`
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const resto = total % 60
  if (horas > 0) return minutos > 0 ? `${horas}\u00a0h ${minutos}\u00a0min` : `${horas}\u00a0h`
  if (minutos < 10 && resto > 0) return `${minutos}\u00a0min ${resto}\u00a0s`
  return `${minutos}\u00a0min`
}

const cacheRelativo = new Map<string, Intl.RelativeTimeFormat>()

/** «hace 3 h», «hace 12 min» con `Intl.RelativeTimeFormat` en el idioma activo. */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const locale = localeActual()
  let formato = cacheRelativo.get(locale)
  if (!formato) {
    formato = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    cacheRelativo.set(locale, formato)
  }
  // Solo eventos pasados: un reloj que va unos segundos atrás no dice «dentro de».
  const segundos = Math.min(0, Math.round((ms - ahora) / 1000))
  const abs = Math.abs(segundos)
  if (abs < 60) return formato.format(segundos, 'second')
  if (abs < 3600) return formato.format(Math.round(segundos / 60), 'minute')
  if (abs < 86_400) return formato.format(Math.round(segundos / 3600), 'hour')
  return formato.format(Math.round(segundos / 86_400), 'day')
}

/** «sáb, 14 nov»: cabecera de día en las tablas de registros. */
export function diaCorto(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString(localeActual(), { weekday: 'short', day: 'numeric', month: 'short' })
}

/** «Hoy», «Ayer» o el día corto. `ahora` se inyecta en las pruebas. */
export function etiquetaDia(iso: string, t: (clave: string) => string, ahora = new Date()): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (mismoDia(fecha, ahora)) return t('comunes.hoy')
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismoDia(fecha, ayer)) return t('comunes.ayer')
  return diaCorto(iso)
}

/**
 * «50 min», «1 h 20 min» o «2 días», traducido, para periodos de registros
 * (Historial). En Alertas se usa `duracionLegible` (segundos, sin traducción).
 */
export function duracionPeriodo(ms: number, t: (clave: string, opciones?: Record<string, unknown>) => string): string {
  const minutos = Math.max(1, Math.round(ms / 60_000))
  if (minutos < 60) return t('comunes.duracionMin', { m: minutos })
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return t('comunes.duracionHoras', { h: horas, m: minutos % 60 })
  return t('comunes.duracionDias', { count: Math.round(horas / 24) })
}
