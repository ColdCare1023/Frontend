/**
 * HU-28: enlace de la Cronología de una alerta a Trazabilidad con la cadena de
 * su equipo ya elegida. La cadena de un equipo es su `chain_id`, que el backend
 * hace igual al `device_id` (HU-25); los eventos sin equipo van a «SISTEMA».
 */
export const PARAMETRO_CADENA = 'cadena'

/** `/trazabilidad?cadena=<chain_id>`, con el identificador codificado. */
export function enlaceVerificarCadena(chainId: string): string {
  return `/trazabilidad?${new URLSearchParams({ [PARAMETRO_CADENA]: chainId })}`
}

/**
 * La cadena que pide la URL, solo si es una de las cadenas existentes. Un
 * valor vacío, desconocido o con otra forma (mayúsculas, espacios) se ignora,
 * igual que mientras la lista no ha llegado o el backend no la ofrece.
 */
export function cadenaDeEnlace(valor: string | null, cadenas: readonly { chain_id: string }[]): string | null {
  if (!valor) return null
  return cadenas.some((cadena) => cadena.chain_id === valor) ? valor : null
}
