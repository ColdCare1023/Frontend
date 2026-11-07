import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendPlainComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import { segunNivel } from '@/lib/rendimiento'

/**
 * Registro explícito de módulos: ECharts solo empaqueta lo que se declara aquí, y este archivo es la
 * única puerta a ECharts. Nadie lo importa de forma estática: lo pide `graficaViva` cuando una gráfica
 * va a verse, así que ninguna pantalla espera a sus cientos de KB para pintar.
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
  MarkPointComponent,
  LegendPlainComponent,
  VisualMapPiecewiseComponent,
  CanvasRenderer,
])

export function crearGrafica(host: HTMLElement) {
  return echarts.init(host, undefined, {
    renderer: 'canvas',
    // Más de 2× no se distingue en una línea de 2 px y cuesta el doble de píxeles en cada repintado.
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, segunNivel(2, 2, 1.25)),
  })
}
