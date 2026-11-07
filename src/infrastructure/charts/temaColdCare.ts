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

/** Una serie apagada en la leyenda sigue siendo un control: 3:1 sobre la superficie. */
export function colorInactivo(tema: TemaGrafica = 'light'): string {
  return colorToken('border-field', tema === 'dark' ? '#5B6B82' : '#8090A7')
}

export function temaGrafica(tema: TemaGrafica = 'light') {
  const oscuro = tema === 'dark'
  return {
    foreground: colorToken('foreground', oscuro ? '#F1F5FA' : '#0F172A'),
    muted: colorToken('faint', oscuro ? '#8F9DB1' : '#5B6B82'),
    surface: colorToken('surface', oscuro ? '#131C30' : '#FFFFFF'),
    // Lo que flota sobre la gráfica: el tooltip.
    raised: colorToken('surface-raised', oscuro ? '#1A2439' : '#FFFFFF'),
    border: colorToken('border', oscuro ? '#222D44' : '#E3E9F2'),
    borderStrong: colorToken('border-strong', oscuro ? '#33415C' : '#CBD5E3'),
    grid: colorToken('cream-200', oscuro ? '#1A2439' : '#EDF2F8'),
    // La línea: azul en claro y cian en oscuro, como la línea del día de la landing.
    primary: colorToken('grafica-1', oscuro ? '#5CD6E8' : '#0B5CFF'),
    secondary: colorToken('grafica-2', oscuro ? '#8F9DB1' : '#08738F'),
    // Rango de referencia 2–8 °C: cian de rango seguro (DESIGN.md) con texto
    // en el tono «normal» para que la etiqueta sea legible sobre la franja.
    safe: colorToken('instrumento', oscuro ? '#5CD6E8' : '#008EAF'),
    safeText: colorToken(oscuro ? 'instrumento' : 'glacier-700', oscuro ? '#5CD6E8' : '#07546A'),
    // Texto crítico, y rojo sólido para las marcas (DESIGN.md: nunca salmón).
    critical: colorToken('critical', oscuro ? '#FF8A80' : '#B42318'),
    criticalSolid: colorToken('critical-solid', '#D92D20'),
    // Líneas adicionales cuando la curva compara varios equipos: ninguna repite a la primera en ningún tema.
    equipos: oscuro
      ? [colorToken('grafica-1', '#5CD6E8'), '#6E9BFF', colorToken('accent', '#FF8FB1'), colorToken('honey-600', '#F79009')]
      : [colorToken('grafica-1', '#0B5CFF'), colorToken('instrumento', '#008EAF'), colorToken('accent-hover', '#E75A85'), colorToken('honey-600', '#DC6803')],
  }
}
