import { memo, useEffect, useRef, useState } from 'react'
import type { EChartsCoreOption } from 'echarts/core'

import { montarGrafica, type EstadoGrafica, type GraficaViva } from './graficaViva'

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
 * Wrapper propio sobre Apache ECharts (decisión del stack: se descartó
 * echarts-for-react por incidente de seguridad en npm y peer dependency
 * inestable con React 19).
 *
 * Este archivo no importa ECharts: reserva el alto, muestra un esqueleto y deja que `graficaViva`
 * lo descargue cuando la gráfica va a verse. Con `memo`, el reloj de cada segundo del monitoreo no lo
 * toca; una instancia vive tanto como el componente y cada lectura solo la actualiza.
 */
export const EChartWrapper = memo(function EChartWrapper({
  option,
  height = '300px',
  className = '',
  ariaLabel,
  ariaDescribedBy,
}: EChartWrapperProps) {
  const host = useRef<HTMLDivElement>(null)
  const viva = useRef<GraficaViva | null>(null)
  const opcionInicial = useRef(option)
  const [estado, setEstado] = useState<EstadoGrafica>('esperando')

  useEffect(() => {
    if (!host.current) return
    const grafica = montarGrafica(host.current, opcionInicial.current, setEstado)
    viva.current = grafica
    return () => {
      grafica.cerrar()
      viva.current = null
    }
  }, [])

  useEffect(() => {
    viva.current?.actualizar(option)
  }, [option])

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      // Sin el paquete no queda un hueco: los mismos datos siguen en la tabla de la pantalla.
      style={{ height: estado === 'fallo' ? 0 : height, width: '100%', position: 'relative', fontVariantNumeric: 'tabular-nums' }}
      className={className}
    >
      {estado === 'esperando' && <div aria-hidden className="esqueleto absolute inset-0 rounded-(--radius-field)" />}
      <div
        ref={host}
        className={`absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none ${estado === 'lista' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
})
