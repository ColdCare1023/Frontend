/**
 * HU-37 esc. 1: el periodo de la verificación de integridad es un rango
 * temporal, no solo días completos. Fecha local (`yyyy-MM-dd`) y hora
 * opcional (`HH:mm`): sin hora, el inicio cuenta desde las 00:00 y el fin
 * hasta el último milisegundo del día; con hora, el fin incluye ese minuto
 * entero (hasta `HH:mm:59.999`).
 */
export type ExtremoPeriodo = 'inicio' | 'fin'

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Instante local del extremo del periodo, o null si la fecha o la hora no son válidas. */
export function instanteDelPeriodo(fecha: string, hora: string, extremo: ExtremoPeriodo): Date | null {
  const dia = FECHA.exec(fecha.trim())
  if (!dia) return null
  const [anio, mes, diaMes] = [Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])]
  const horaLimpia = hora.trim()
  let instante: Date
  if (!horaLimpia) {
    instante = extremo === 'inicio' ? new Date(anio, mes, diaMes, 0, 0, 0, 0) : new Date(anio, mes, diaMes, 23, 59, 59, 999)
  } else {
    const hm = HORA.exec(horaLimpia)
    if (!hm) return null
    const [h, m] = [Number(hm[1]), Number(hm[2])]
    instante = extremo === 'inicio' ? new Date(anio, mes, diaMes, h, m, 0, 0) : new Date(anio, mes, diaMes, h, m, 59, 999)
  }
  // `new Date` desborda fechas imposibles (31/02 → 03/03): se rechazan.
  return instante.getFullYear() === anio && instante.getMonth() === mes && instante.getDate() === diaMes ? instante : null
}
