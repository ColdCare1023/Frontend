const ORDEN_LECTURA = ['normal', 'riesgo_preventivo', 'excursion_critica']

export interface MatrizLegible {
  clases: string[]
  /** `filas[real][asignada]`. */
  filas: number[][]
}

/**
 * La matriz en el orden en que se lee un riesgo, de menor a mayor. Filas y columnas se reordenan
 * juntas, así que ningún número cambia de significado. Devuelve `null` si no es cuadrada y del
 * tamaño de `clases`: una matriz incompleta no se puede leer y no se dibuja a medias.
 */
export function matrizOrdenada(clases: string[], matriz: number[][]): MatrizLegible | null {
  const n = clases.length
  if (n === 0 || matriz.length !== n || matriz.some((fila) => fila.length !== n)) return null
  const posicion = (clase: string) => {
    const i = ORDEN_LECTURA.indexOf(clase)
    return i === -1 ? ORDEN_LECTURA.length : i
  }
  const indices = clases.map((_, i) => i).sort((a, b) => posicion(clases[a]) - posicion(clases[b]))
  return {
    clases: indices.map((i) => clases[i]),
    filas: indices.map((real) => indices.map((asignada) => matriz[real][asignada])),
  }
}
