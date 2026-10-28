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

export function temaGrafica(tema: TemaGrafica = 'light') {
  const oscuro = tema === 'dark'
  return {
    foreground: colorToken('foreground', oscuro ? '#EDEDED' : '#0F172A'),
    muted: colorToken('faint', oscuro ? '#8F8F8F' : '#5B6B82'),
    surface: colorToken('surface', oscuro ? '#0A0A0A' : '#FFFFFF'),
    border: colorToken('border', oscuro ? '#1F1F1F' : '#DFE6F0'),
    grid: colorToken('cream-200', oscuro ? '#1A1A1A' : '#EDF2F8'),
    primary: colorToken('grafica-1', oscuro ? '#6E9BFF' : '#0B5CFF'),
    secondary: colorToken('grafica-2', oscuro ? '#5CD6E8' : '#08738F'),
    // Rango de referencia 2–8 °C: cian de rango seguro (DESIGN.md) con texto
    // en el tono «normal» para que la etiqueta sea legible sobre la franja.
    safe: colorToken('secondary', oscuro ? '#5CD6E8' : '#00D1FF'),
    safeText: colorToken('glacier-700', oscuro ? '#4FD1A5' : '#07546A'),
    critical: colorToken('clay-700', oscuro ? '#FF7A87' : '#A4233F'),
    // Líneas adicionales cuando la curva compara varios equipos.
    accent: colorToken('accent', oscuro ? '#FF8FB1' : '#FF7AA2'),
    warn: colorToken('honey-600', oscuro ? '#E9A93A' : '#B45F06'),
  }
}
