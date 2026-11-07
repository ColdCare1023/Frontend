import type { RegistroAuditoria } from '@/domain/entities/Usuario'
import { fechaISOlocal, localeActual } from '@/lib/formato'

export const SIN_FECHA = 'sin-fecha'

/** El día del calendario local de un registro: la clave por la que se agrupa la línea. */
export function claveDia(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? SIN_FECHA : fechaISOlocal(fecha)
}

export interface DiaAuditoria {
  clave: string
  registros: RegistroAuditoria[]
}

/** Agrupa conservando el orden en que llegan: la bitácora ya viene de la más nueva a la más vieja. */
export function agruparPorDia(registros: RegistroAuditoria[]): DiaAuditoria[] {
  const dias: DiaAuditoria[] = []
  for (const registro of registros) {
    const clave = claveDia(registro.created_at)
    const ultimo = dias[dias.length - 1]
    if (ultimo?.clave === clave) ultimo.registros.push(registro)
    else dias.push({ clave, registros: [registro] })
  }
  return dias
}

export interface ResumenDia {
  total: number
  noExitosas: number
}

/**
 * Cuántas acciones tiene cada día en la lista completa: la cabecera no cambia de cifra aunque el
 * día se parta entre dos páginas. Sin resultado registrado no se cuenta como falla.
 */
export function resumirDias(registros: RegistroAuditoria[]): Map<string, ResumenDia> {
  const resumen = new Map<string, ResumenDia>()
  for (const registro of registros) {
    const clave = claveDia(registro.created_at)
    const dia = resumen.get(clave) ?? { total: 0, noExitosas: 0 }
    dia.total += 1
    if (registro.resultado && registro.resultado !== 'exitoso') dia.noExitosas += 1
    resumen.set(clave, dia)
  }
  return resumen
}

/** Separa el día relativo o la fecha (grande) del resto de la fecha (al lado). */
export function rotuloDia(clave: string, textos: { hoy: string; ayer: string }, ahora = new Date()) {
  if (clave === SIN_FECHA) return { principal: '—', secundario: '' }
  const [anio, mes, dia] = clave.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  const locale = localeActual()
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)
  const conAnio = anio !== ahora.getFullYear()
  const diaYMes = fecha.toLocaleDateString(locale, { day: 'numeric', month: 'long', ...(conAnio ? { year: 'numeric' } : {}) })
  const semana = fecha.toLocaleDateString(locale, { weekday: 'long' })
  if (clave === fechaISOlocal(ahora)) return { principal: textos.hoy, secundario: `${semana}, ${diaYMes}` }
  if (clave === fechaISOlocal(ayer)) return { principal: textos.ayer, secundario: `${semana}, ${diaYMes}` }
  return { principal: diaYMes, secundario: semana }
}

/** Hora y minutos en 24 h, sin segundos: la línea de tiempo se lee de un vistazo y «15:49» no se confunde. */
export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString(localeActual(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Cuándo fue una acción, para decirlo en una frase: hoy, ayer o en qué fecha, y a qué hora. */
export function momento(iso: string, ahora = new Date()): { dia: 'hoy' | 'ayer' | 'fecha'; fecha: string; hora: string } | null {
  const clave = claveDia(iso)
  if (clave === SIN_FECHA) return null
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)
  const fecha = new Date(iso)
  const conAnio = fecha.getFullYear() !== ahora.getFullYear()
  return {
    dia: clave === fechaISOlocal(ahora) ? 'hoy' : clave === fechaISOlocal(ayer) ? 'ayer' : 'fecha',
    fecha: fecha.toLocaleDateString(localeActual(), { day: 'numeric', month: 'long', ...(conAnio ? { year: 'numeric' } : {}) }),
    hora: horaCorta(iso),
  }
}
