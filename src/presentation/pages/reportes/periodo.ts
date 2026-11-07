import { fechaISOlocal, localeActual } from '@/lib/formato'

/** `YYYY-MM-DD` de hoy desplazado `desplazamientoDias`, en el calendario local. */
export function hoyISO(desplazamientoDias = 0): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + desplazamientoDias)
  return fechaISOlocal(fecha)
}

/** `YYYY-MM-DD` es un día del calendario local: leerlo con `new Date(texto)` lo adelanta a UTC. */
export function diaLocal(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (!anio || !mes || !dia) return '—'
  return new Date(anio, mes - 1, dia).toLocaleDateString(localeActual())
}

export interface PedidoReporte {
  desde: string
  hasta: string
  equipo: string
}

export function mismoPedido(a: PedidoReporte | null, b: PedidoReporte): boolean {
  return a !== null && a.desde === b.desde && a.hasta === b.hasta && a.equipo === b.equipo
}
