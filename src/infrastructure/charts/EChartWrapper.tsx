import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
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
 * Antes de añadir un tipo de gráfica nuevo hay que registrarlo aquí; si falta,
 * ECharts no dibuja la serie y no avisa.
 */
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  LegendComponent,
  CanvasRenderer,
])

interface EChartWrapperProps {
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

  useEffect(() => {
    if (!containerRef.current) return
    chartRef.current = echarts.init(containerRef.current)
    const observer = new ResizeObserver(() => chartRef.current?.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: false })
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
