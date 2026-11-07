/**
 * Cuántos aciertos de cada 100, a partir de la exactitud que muestra la pantalla. Nunca redondea a
 * 100 si hubo un solo error: «100 de cada 100» diría algo que los datos no dicen.
 */
export function aciertosDeCada100(exactitud: number): number {
  const redondeo = Math.round(exactitud * 100)
  return exactitud < 1 ? Math.min(redondeo, 99) : redondeo
}
