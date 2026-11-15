/**
 * Colores para ECharts, que dibuja sobre canvas y no puede consumir las
 * clases Tailwind directamente. Lee los mismos tokens CSS que usan los
 * componentes; los fallback (por tema) cubren pruebas y renderizados sin DOM.
 */
export function colorToken(nombre: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  return window.getComputedStyle(document.documentElement).getPropertyValue(`--color-${nombre}`).trim() || fallback
}

export type TemaGrafica = 'dark' | 'light'

/**
 * Paleta de la curva (DIRECTION §3, §4 y §18): tinta navy de registrador
 * para el trazo, franja verde 2–8 °C (HU-31) con cotas discontinuas, carmesí solo
 * para lo que sale del rango y acero con trama para «sin datos». Rosa y cian
 * son de la marca y no aparecen en datos.
 */
export function temaGrafica(tema: TemaGrafica = 'light') {
  const oscuro = tema === 'dark'
  return {
    foreground: colorToken('foreground', oscuro ? '#E8EDF5' : '#0B1E3A'),
    /** Texto de etiquetas activas (leyenda). */
    texto: colorToken('muted', oscuro ? '#9AA6B8' : '#475A75'),
    /** Ejes, cotas y metadatos. */
    muted: colorToken('faint', oscuro ? '#7F8BA0' : '#5B6B82'),
    surface: colorToken('surface', oscuro ? '#121826' : '#FFFFFF'),
    /** Lo que flota (tooltip): un nivel sobre la tarjeta. */
    raised: colorToken('surface-raised', oscuro ? '#19202F' : '#FFFFFF'),
    border: colorToken('border', oscuro ? '#232B3A' : '#E1E7EF'),
    grid: colorToken('neutral-200', oscuro ? '#19202F' : '#EDF1F6'),
    /** Trazo interno: tinta de registrador. */
    primary: colorToken('grafica-1', oscuro ? '#DCE4F0' : '#1B2B47'),
    /** Ambiente: línea discontinua. */
    secondary: colorToken('grafica-2', oscuro ? '#6B778C' : '#7A879C'),
    /** HU-31 esc. 1: franja 2–8 °C en verde («zonas rojo/verde») y sus cotas. */
    banda: colorToken('grafica-zona', oscuro ? '#0F2418' : '#E8F6EC'),
    safe: colorToken('grafica-zona-borde', oscuro ? '#46B06C' : '#2B8A4E'),
    // Texto sobre la franja: verde legible (AA) en ambos temas.
    safeText: colorToken('grafica-zona-texto', oscuro ? '#72D197' : '#1B6337'),
    /** Tramos fuera de 2–8 °C, episodios y marcadores de excursión. */
    critical: colorToken('danger-700', oscuro ? '#FF7A87' : '#A4233F'),
    /** HU-31 esc. 1: zonas por debajo de 2 °C y por encima de 8 °C, rojo tenue. */
    zonaFuera: colorToken('critical-tint', oscuro ? '#2A0F14' : '#FFF0F3'),
    /** Sin datos: acero con trama, nunca rojo (HU-54). */
    nodata: colorToken('nodata-100', oscuro ? '#1A2130' : '#E9EDF3'),
    nodataTrama: colorToken('nodata-trama', oscuro ? '#2C3546' : '#C9D2DE'),
    nodataTexto: colorToken('nodata-700', oscuro ? '#B4BFCF' : '#4A5A73'),
    /** HU-30: condición documental (calibración vencida), ámbar y nunca rojo. */
    warning: colorToken('warning-600', oscuro ? '#E4A23A' : '#B45F06'),
    warningText: colorToken('warning-700', oscuro ? '#F5B94F' : '#8A4B06'),
  }
}
