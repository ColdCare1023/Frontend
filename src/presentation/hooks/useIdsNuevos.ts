import { useRef } from 'react'

/**
 * Lista animada (Magic UI Animated List, MOTION 4.4): devuelve los ids que
 * llegaron DESPUÉS de la carga inicial. Los ids presentes cuando `listo` pasa
 * a `true` se siembran sin animar; al cambiar de filtro o de pestaña, pasa
 * `clave` distinta y la lista se vuelve a sembrar sin animar.
 *
 * Uso: `const nuevos = useIdsNuevos(filas.map(f => f.id), !cargando, filtro)`
 * y en cada fila `{...propsFilaNueva(fila.id, nuevos, indice)}`.
 */
export function useIdsNuevos(ids: readonly string[], listo: boolean, clave: unknown = null): ReadonlySet<string> {
  const conocidos = useRef<Set<string> | null>(null)
  const claveActual = useRef<unknown>(clave)
  const nuevos = useRef<Set<string>>(new Set())

  if (!listo) return nuevos.current
  if (conocidos.current === null || claveActual.current !== clave) {
    conocidos.current = new Set(ids)
    claveActual.current = clave
    nuevos.current = new Set()
    return nuevos.current
  }
  const recientes = ids.filter((id) => !conocidos.current!.has(id))
  if (recientes.length > 0) {
    for (const id of recientes) conocidos.current.add(id)
    nuevos.current = new Set(recientes)
  }
  return nuevos.current
}

/** Atributos de una fila: `data-nueva` y su índice de escalonado (máx. 4). */
export function propsFilaNueva(id: string, nuevos: ReadonlySet<string>, indice = 0) {
  if (!nuevos.has(id)) return {}
  return { 'data-nueva': '', style: { '--i': Math.min(indice, 3) } as React.CSSProperties }
}
