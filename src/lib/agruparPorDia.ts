/**
 * Agrupación de registros por día local (Historial, Bitácora, Integridad).
 * El día se calcula en la zona horaria del navegador, no en UTC: una lectura
 * de las 23:30 en Lima pertenece a ese día aunque en UTC ya sea el siguiente.
 */
export function claveDia(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return 'sin-fecha'
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export interface GrupoDia<T> {
  clave: string
  /** Fecha ISO de la primera fila del grupo (para la etiqueta). */
  iso: string
  filas: T[]
}

/** Agrupa conservando el orden de entrada (normalmente, descendente). */
export function agruparPorDia<T>(filas: readonly T[], fechaDe: (fila: T) => string): GrupoDia<T>[] {
  const grupos: GrupoDia<T>[] = []
  let actual: GrupoDia<T> | null = null
  for (const fila of filas) {
    const iso = fechaDe(fila)
    const clave = claveDia(iso)
    if (!actual || actual.clave !== clave) {
      actual = { clave, iso, filas: [] }
      grupos.push(actual)
    }
    actual.filas.push(fila)
  }
  return grupos
}

/** Cuenta por día sobre TODO lo cargado (la cabecera resume el día completo). */
export function contarPorDia<T>(filas: readonly T[], fechaDe: (fila: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const fila of filas) {
    const clave = claveDia(fechaDe(fila))
    const lista = mapa.get(clave)
    if (lista) lista.push(fila)
    else mapa.set(clave, [fila])
  }
  return mapa
}
