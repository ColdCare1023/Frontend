/**
 * Colores para ECharts, que dibuja sobre canvas y no puede consumir las
 * clases Tailwind directamente. Lee los mismos tokens CSS que usan los
 * componentes; los fallback cubren pruebas y renderizados sin DOM.
 */
export function colorToken(nombre: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  return window.getComputedStyle(document.documentElement).getPropertyValue(`--color-${nombre}`).trim() || fallback
}

export function temaGrafica() {
  return {
    foreground: colorToken('foreground', '#0F172A'),
    muted: colorToken('faint', '#59677C'),
    surface: colorToken('surface', '#FFFFFF'),
    border: colorToken('border', '#DCE5F0'),
    grid: colorToken('cream-200', '#EDF2F8'),
    primary: colorToken('primary', '#0B5CFF'),
    secondary: colorToken('glacier-600', '#08738F'),
    // Rango de referencia 2–8 °C: cian de rango seguro (DESIGN.md) con texto
    // en el tono «normal» para que la etiqueta sea legible sobre la franja.
    safe: colorToken('secondary', '#00D1FF'),
    safeText: colorToken('glacier-700', '#07546A'),
    critical: colorToken('clay-700', '#802445'),
    // Líneas adicionales cuando la curva compara varios equipos.
    accent: colorToken('accent', '#FF7AA2'),
    warn: colorToken('honey-600', '#B45F06'),
  }
}
