import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

/**
 * Registro explícito de módulos: ECharts solo empaqueta lo que se declara aquí.
 *
 * `BarChart`, `GaugeChart` y `DataZoomComponent` estaban registrados pero
 * ninguna pantalla los usaba —la única gráfica del sistema es la curva térmica
 * del dashboard, de tipo `line`; las barras de importancias de MetricasIA son
 * `div` con CSS—. Al declararlos se desactivaba su sacudida de árbol y
 * viajaban íntegros en el trozo `echarts`, que es lo que se descarga justo
 * después de iniciar sesión (RNF-10).
 *
 * Antes de añadir un tipo de gráfica nuevo hay que registrarlo aquí. Si falta,
 * ECharts no crea esa serie y, si además hay marcadores (markLine/markArea/
 * markPoint), `setOption` lanza «Cannot read properties of undefined (reading
 * 'get')» y la sección entera cae al límite de error. Así se rompía Historial:
 * la curva añade la serie `scatter` `extremos-fuera` en cuanto un intervalo sale
 * de 2–8 °C. `registroEcharts.test.ts` dibuja las opciones reales con este
 * registro.
 */
echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  LegendComponent,
  CanvasRenderer,
])

export interface EChartWrapperProps {
  option: EChartsCoreOption
  height?: string
  className?: string
  /**
   * Nombre accesible de la gráfica (WCAG 1.1.1). Obligatorio: el renderizador
   * es un `<canvas>`, un mapa de píxeles sin nodos que un lector de pantalla
   * pueda recorrer. Sin `role="img"` + nombre, la gráfica sencillamente no
   * existe para quien no la ve.
   *
   * El nombre no sustituye a los datos: quien necesite las cifras debe
   * encontrarlas en una tabla equivalente cerca de la gráfica
   * (`TablaAlternativa`).
   */
  ariaLabel: string
  /** `id` del resumen o tabla que amplía la gráfica, si existe. */
  ariaDescribedBy?: string
}

/**
 * Wrapper propio sobre Apache ECharts v5 (decisión del stack: se descartó
 * echarts-for-react por incidente de seguridad en npm y peer dependency
 * inestable con React 19). Tree-shaking por módulos + ResizeObserver.
 */
export function EChartWrapper({
  option,
  height = '300px',
  className = '',
  ariaLabel,
  ariaDescribedBy,
}: EChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  // Lo que la persona eligió en la leyenda (p. ej. mostrar «ambiental»): la
  // opción se reconstruye con cada lectura y no debe deshacer esa elección.
  const seleccionLeyenda = useRef<Record<string, boolean> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    chart.on('legendselectchanged', (evento) => {
      seleccionLeyenda.current = { ...(evento as { selected: Record<string, boolean> }).selected }
    })
    // PERFORMANCE C6: un solo resize al terminar de cambiar el tamaño (≈100 ms)
    // en vez de uno por fotograma mientras el contenedor se ajusta.
    let espera: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      clearTimeout(espera)
      espera = setTimeout(() => chartRef.current?.resize(), 100)
    })
    observer.observe(containerRef.current)
    return () => {
      clearTimeout(espera)
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leyenda = (option as { legend?: unknown }).legend
    const elegida = seleccionLeyenda.current
    const conLeyenda =
      elegida && leyenda && typeof leyenda === 'object' && !Array.isArray(leyenda)
        ? { legend: { ...leyenda, selected: { ...((leyenda as { selected?: Record<string, boolean> }).selected ?? {}), ...elegida } } }
        : {}
    // `replaceMerge` sustituye las series: una que desaparece (los tramos fuera
    // de rango, otro equipo) no queda dibujada de la opción anterior.
    chartRef.current?.setOption(
      { ...option, ...conLeyenda, ...(reducedMotion ? { animation: false } : {}) },
      { replaceMerge: ['series'] },
    )
  }, [option])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      style={{ height, width: '100%' }}
      className={className}
    />
  )
}
