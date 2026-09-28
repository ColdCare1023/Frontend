/**
 * Cálculos de paginación, separados del componente que los pinta.
 *
 * Viven aquí y no junto a `<Paginacion>` porque un archivo que exporta a la vez
 * componentes y funciones sueltas rompe el refresco en caliente de React.
 */

export const TAMANO_PAGINA = 15

/** Índices [inicio, fin) de la página, listos para `Array.slice`. */
export function rangoPagina(pagina: number, tamano = TAMANO_PAGINA): [number, number] {
  const inicio = (pagina - 1) * tamano
  return [inicio, inicio + tamano]
}

/** Siempre al menos 1: una lista vacía sigue siendo "página 1 de 1". */
export function totalPaginas(total: number, tamano = TAMANO_PAGINA): number {
  return Math.max(1, Math.ceil(total / tamano))
}
