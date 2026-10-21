/**
 * FE-006: construye rutas de la API sin que un identificador pueda alterarlas.
 *
 * Cada valor interpolado se codifica como UN segmento (`/`, `?`, `#`, `%`…
 * quedan escapados). Codificar no basta para `.` y `..`: el parser de URL del
 * navegador trata también `%2e%2e` como "directorio padre" y normaliza la
 * ruta antes de enviarla. Por eso esos segmentos (y el vacío) se rechazan.
 *
 * Uso: rutaApi`/api/dispositivos/${deviceId}/baja`
 */
export function rutaApi(partes: TemplateStringsArray, ...valores: Array<string | number>): string {
  return partes.reduce((ruta, parte, indice) => {
    if (indice >= valores.length) return ruta + parte
    return ruta + parte + segmento(valores[indice])
  }, '')
}

const SEGMENTO_DE_PUNTOS = /^(\.|%2e){1,2}$/i

export function segmento(valor: string | number): string {
  const texto = String(valor)
  if (texto === '' || SEGMENTO_DE_PUNTOS.test(texto)) {
    throw new Error('Identificador no válido en la ruta de la API')
  }
  return encodeURIComponent(texto)
}
