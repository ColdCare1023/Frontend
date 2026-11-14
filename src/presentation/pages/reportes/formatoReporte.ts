import { ESPACIO_FINO, formatearTemperatura } from '../../components/ui/formato-cifra'

export function localeNumero(idioma: string | undefined): string {
  return idioma?.startsWith('en') ? 'en-US' : 'es-PE'
}

/** «97,4 %» con espacio fino antes del signo. */
export function textoPorcentaje(valor: number, idioma: string | undefined): string {
  const numero = valor.toLocaleString(localeNumero(idioma), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${numero}${ESPACIO_FINO}%`
}

/** Duración compacta: «50 min», «3 h 20 min», «6 d 23 h». */
export function textoDuracion(ms: number): string {
  const minutos = Math.round(ms / 60_000)
  if (minutos < 60) return `${minutos}${ESPACIO_FINO}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    const resto = minutos % 60
    return resto ? `${horas}${ESPACIO_FINO}h ${resto}${ESPACIO_FINO}min` : `${horas}${ESPACIO_FINO}h`
  }
  const dias = Math.floor(horas / 24)
  const restoHoras = horas % 24
  return restoHoras ? `${dias}${ESPACIO_FINO}d ${restoHoras}${ESPACIO_FINO}h` : `${dias}${ESPACIO_FINO}d`
}

export const temperatura = (valor: number) => formatearTemperatura(valor)

/** Fecha `YYYY-MM-DD` local desplazada `dias` desde hoy. */
export function fechaRelativa(dias: number, base = new Date()): string {
  const fecha = new Date(base)
  fecha.setDate(fecha.getDate() + dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export type AtajoPeriodo = 'dias7' | 'dias30' | 'mes'

export function periodoDeAtajo(atajo: AtajoPeriodo, base = new Date()): { desde: string; hasta: string } {
  const hasta = fechaRelativa(0, base)
  if (atajo === 'dias7') return { desde: fechaRelativa(-6, base), hasta }
  if (atajo === 'dias30') return { desde: fechaRelativa(-29, base), hasta }
  return { desde: `${hasta.slice(0, 8)}01`, hasta }
}

/** El atajo que coincide con las fechas, o `null` si ninguno. */
export function atajoDe(desde: string, hasta: string, base = new Date()): AtajoPeriodo | null {
  for (const atajo of ['dias7', 'dias30', 'mes'] as const) {
    const p = periodoDeAtajo(atajo, base)
    if (p.desde === desde && p.hasta === hasta) return atajo
  }
  return null
}
