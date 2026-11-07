import type { EChartsCoreOption } from 'echarts/core'

import { alAcercarse, enMomentoLibre, observarVista } from '@/lib/cargaDiferida'

type Motor = typeof import('./motorEcharts')
type Grafica = ReturnType<Motor['crearGrafica']>

export type EstadoGrafica = 'esperando' | 'lista' | 'fallo'

export interface GraficaViva {
  actualizar: (opcion: EChartsCoreOption) => void
  cerrar: () => void
}

/* Antes de que asome: al llegar con el scroll ya está dibujada. */
const MARGEN_CARGA = '80% 0px'
/* Fuera de este margen una lectura nueva no repinta nada: se aplica al volver. */
const MARGEN_VISTA = '25% 0px'
/* Una lectura nueva espera a que el hilo esté libre, sin pasar de esto: nadie nota 300 ms en una curva. */
const ESPERA_ACTUALIZAR_MS = 300
const ESPERA_FUENTE_MS = 800

/** Con el tema cambia el color del texto; ese cambio no espera, va junto al resto de la página. */
function colorDeTexto(opcion: EChartsCoreOption) {
  return (opcion.textStyle as { color?: unknown } | undefined)?.color
}

function nombresDeSeries(opcion: EChartsCoreOption) {
  const series = opcion.series as Array<{ name?: string }> | undefined
  return series?.map((serie) => serie.name).join('|') ?? ''
}

/** El texto del lienzo no se repinta solo si la fuente llega tarde: se espera a Inter un momento. */
function esperarFuente(): Promise<unknown> {
  if (!document.fonts?.load) return Promise.resolve()
  return Promise.race([
    document.fonts.load('500 11px "Inter Variable"').catch(() => undefined),
    new Promise((listo) => setTimeout(listo, ESPERA_FUENTE_MS)),
  ])
}

/**
 * El ciclo de una gráfica: se descarga ECharts cuando el contenedor va a verse, se crea una sola
 * instancia para toda su vida y cada lectura solo la actualiza. Fuera de pantalla o con la pestaña
 * oculta no se repinta; lo pendiente se aplica al volver.
 */
export function montarGrafica(
  host: HTMLElement,
  opcionInicial: EChartsCoreOption,
  alCambiarEstado: (estado: EstadoGrafica) => void,
  cargarMotor: () => Promise<Motor | undefined> = () => import('./motorEcharts'),
): GraficaViva {
  let opcion = opcionInicial
  let aplicada: EChartsCoreOption | null = null
  let grafica: Grafica | null = null
  let cerrada = false
  let enVista = typeof IntersectionObserver === 'undefined'
  let tamanoPendiente = false
  let anchoVisto = 0
  let altoVisto = 0
  let rafTamano = 0
  let cancelarLibre: (() => void) | undefined
  let cancelarActualizacion: (() => void) | undefined
  let leyendaElegida: Record<string, boolean> | null = null

  const aplicar = (deInmediato = false) => {
    cancelarActualizacion = undefined
    if (!grafica || opcion === aplicada) return
    // La opción trae la leyenda por defecto: sin esto, cada lectura deshacía lo que eligió la persona.
    const leyenda = opcion.legend as { selected?: Record<string, boolean> } | undefined
    const conLeyenda =
      leyendaElegida && leyenda
        ? { ...opcion, legend: { ...leyenda, selected: { ...leyenda.selected, ...leyendaElegida } } }
        : opcion
    // Si la consulta pasa de varios equipos a uno, las series que sobran no pueden quedarse. No sirve
    // `replaceMerge`: ECharts también lo aplica a `media`, que no trae series, y las borraba todas.
    const cambiaLaForma = aplicada !== null && nombresDeSeries(aplicada) !== nombresDeSeries(opcion)
    // `lazyUpdate`: interpretar la opción y pintar van en dos tareas, no en una larga.
    grafica.setOption(conLeyenda, { notMerge: cambiaLaForma, lazyUpdate: !deInmediato })
    aplicada = opcion
  }

  const ponerAlDia = () => {
    if (!grafica || !enVista || document.hidden) return
    if (tamanoPendiente) {
      tamanoPendiente = false
      grafica.resize()
    }
    aplicar()
  }

  const crear = (motor: Motor) => {
    if (cerrada) return
    grafica = motor.crearGrafica(host)
    grafica.on('legendselectchanged', (evento) => {
      leyendaElegida = (evento as { selected: Record<string, boolean> }).selected
    })
    anchoVisto = host.clientWidth
    altoVisto = host.clientHeight
    aplicar()
    alCambiarEstado('lista')
  }

  const dejarDeEsperar = alAcercarse(
    host,
    () => {
      Promise.all([cargarMotor(), esperarFuente()])
        .then(([motor]) => {
          if (cerrada) return
          // Si el fragmento no llega, `main.tsx` recarga la página y esta promesa queda sin módulo.
          if (!motor) {
            alCambiarEstado('fallo')
            return
          }
          // Evaluar el paquete y dibujar por primera vez son dos tareas: mejor que no vayan pegadas.
          cancelarLibre = enMomentoLibre(() => crear(motor), 400)
        })
        .catch(() => {
          if (!cerrada) alCambiarEstado('fallo')
        })
    },
    MARGEN_CARGA,
  )

  const dejarDeObservar = observarVista(
    host,
    (visible) => {
      enVista = visible
      if (visible) ponerAlDia()
    },
    MARGEN_VISTA,
  )

  const observaTamano =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          const ancho = host.clientWidth
          const alto = host.clientHeight
          if (ancho === anchoVisto && alto === altoVisto) return
          anchoVisto = ancho
          altoVisto = alto
          if (!grafica) return
          if (!enVista || document.hidden) {
            tamanoPendiente = true
            return
          }
          if (rafTamano) return
          rafTamano = requestAnimationFrame(() => {
            rafTamano = 0
            grafica?.resize()
          })
        })
  observaTamano?.observe(host)

  document.addEventListener('visibilitychange', ponerAlDia)

  return {
    actualizar: (nueva) => {
      if (nueva === opcion) return
      const cambioDeTema = colorDeTexto(nueva) !== colorDeTexto(opcion)
      opcion = nueva
      if (!grafica) return
      if (cambioDeTema) {
        cancelarActualizacion?.()
        aplicar(true)
        return
      }
      if (!enVista || document.hidden || cancelarActualizacion) return
      cancelarActualizacion = enMomentoLibre(() => aplicar(), ESPERA_ACTUALIZAR_MS)
    },
    cerrar: () => {
      cerrada = true
      dejarDeEsperar()
      dejarDeObservar()
      observaTamano?.disconnect()
      document.removeEventListener('visibilitychange', ponerAlDia)
      cancelarLibre?.()
      cancelarActualizacion?.()
      cancelAnimationFrame(rafTamano)
      grafica?.dispose()
      grafica = null
    },
  }
}
