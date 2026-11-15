/**
 * HU-33 esc. 1 («valores numéricos actuales exactos en °C y % HR»): la
 * humedad del SHT31 llega con dos decimales y se muestra con uno, la misma
 * precisión que la temperatura; antes se redondeaba a entero.
 */
export const DECIMALES_HUMEDAD = 1

/** Espacio fino no separable entre valor y unidad (DIRECTION §6). */
export const ESPACIO_FINO = '\u202F'
/** Signo menos tipográfico. */
const MENOS = '\u2212'

/** «5.2», «-0.4» con signo menos tipográfico: siempre con `decimales` y el signo menos tipográfico. */
export function formatearCifra(valor: number, decimales = 1): string {
  const texto = Math.abs(valor).toFixed(decimales)
  return valor < 0 && Number(texto) !== 0 ? `${MENOS}${texto}` : texto
}

/** «5.2 °C» con espacio fino. */
export function formatearTemperatura(valor: number, decimales = 1): string {
  return `${formatearCifra(valor, decimales)}${ESPACIO_FINO}°C`
}

/** Texto visible de un conteo: «99+» y «n+» si la consulta vino truncada. */
export function textoConteo(valor: number, truncado = false): string {
  if (valor > 99) return '99+'
  return truncado ? `${valor}+` : String(valor)
}
