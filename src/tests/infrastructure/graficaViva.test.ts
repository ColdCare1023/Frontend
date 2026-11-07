import type { EChartsCoreOption } from 'echarts/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { montarGrafica } from '@/infrastructure/charts/graficaViva'

type Observado = (entradas: Array<{ isIntersecting: boolean }>) => void

let observadores: Observado[] = []
let alCambiarTamano: (() => void) | null = null

const grafica = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn() }
const crearGrafica = vi.fn(() => grafica)
const motor = { crearGrafica } as never

function verVista(visible: boolean) {
  observadores.forEach((avisar) => avisar([{ isIntersecting: visible }]))
}

/** Deja correr las promesas y el momento libre (requestIdleCallback no existe en jsdom: un temporizador). */
async function asentar() {
  await vi.advanceTimersByTimeAsync(1000)
}

function opcion(extra: Partial<EChartsCoreOption> = {}): EChartsCoreOption {
  return { textStyle: { color: '#000' }, series: [{ name: 'interna' }], ...extra }
}

beforeEach(() => {
  vi.useFakeTimers()
  observadores = []
  alCambiarTamano = null
  grafica.setOption.mockClear()
  grafica.resize.mockClear()
  grafica.dispose.mockClear()
  grafica.on.mockClear()
  crearGrafica.mockClear()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(avisar: Observado) {
        observadores.push(avisar)
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(avisar: () => void) {
        alCambiarTamano = avisar
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (cuadro: FrameRequestCallback) => setTimeout(() => cuadro(0), 16) as unknown as number)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ciclo de una gráfica', () => {
  it('no descarga ECharts hasta que el contenedor va a verse', async () => {
    const cargar = vi.fn(async () => motor)
    const viva = montarGrafica(document.createElement('div'), opcion(), vi.fn(), cargar)
    await asentar()
    expect(cargar).not.toHaveBeenCalled()
    verVista(true)
    await asentar()
    expect(cargar).toHaveBeenCalledTimes(1)
    expect(crearGrafica).toHaveBeenCalledTimes(1)
    viva.cerrar()
    expect(grafica.dispose).toHaveBeenCalledTimes(1)
  })

  it('una lectura nueva actualiza la misma instancia: no vuelve a crearla', async () => {
    const estado = vi.fn()
    const viva = montarGrafica(document.createElement('div'), opcion(), estado, async () => motor)
    verVista(true)
    await asentar()
    expect(estado).toHaveBeenCalledWith('lista')
    expect(grafica.setOption).toHaveBeenCalledTimes(1)

    viva.actualizar(opcion({ series: [{ name: 'interna', data: [[1, 2]] }] }))
    await asentar()
    viva.actualizar(opcion({ series: [{ name: 'interna', data: [[2, 3]] }] }))
    await asentar()

    expect(crearGrafica).toHaveBeenCalledTimes(1)
    expect(grafica.setOption).toHaveBeenCalledTimes(3)
    expect(grafica.setOption.mock.calls[2][1]).toEqual({ notMerge: false, lazyUpdate: true })
    viva.cerrar()
  })

  it('la misma opción no repinta nada', async () => {
    const inicial = opcion()
    const viva = montarGrafica(document.createElement('div'), inicial, vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    viva.actualizar(inicial)
    await asentar()
    expect(grafica.setOption).toHaveBeenCalledTimes(1)
    viva.cerrar()
  })

  it('fuera de pantalla no repinta; al volver aplica solo la última lectura', async () => {
    const viva = montarGrafica(document.createElement('div'), opcion(), vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    verVista(false)
    viva.actualizar(opcion({ series: [{ name: 'interna', data: [[1, 2]] }] }))
    const ultima = opcion({ series: [{ name: 'interna', data: [[2, 3]] }] })
    viva.actualizar(ultima)
    await asentar()
    expect(grafica.setOption).toHaveBeenCalledTimes(1)

    verVista(true)
    expect(grafica.setOption).toHaveBeenCalledTimes(2)
    expect(grafica.setOption.mock.calls[1][0]).toBe(ultima)
    viva.cerrar()
  })

  it('con la pestaña oculta no repinta; al volver a ella, sí', async () => {
    const viva = montarGrafica(document.createElement('div'), opcion(), vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    const oculta = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    viva.actualizar(opcion({ series: [{ name: 'interna', data: [[1, 2]] }] }))
    await asentar()
    expect(grafica.setOption).toHaveBeenCalledTimes(1)

    oculta.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(grafica.setOption).toHaveBeenCalledTimes(2)
    viva.cerrar()
  })

  it('el cambio de tema no espera al momento libre: va junto al resto de la página', async () => {
    const viva = montarGrafica(document.createElement('div'), opcion(), vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    viva.actualizar(opcion({ textStyle: { color: '#fff' } }))
    expect(grafica.setOption).toHaveBeenCalledTimes(2)
    expect(grafica.setOption.mock.calls[1][1]).toMatchObject({ lazyUpdate: false })
    viva.cerrar()
  })

  it('si cambian las series, las que sobran se van', async () => {
    const dos = opcion({ series: [{ name: 'FARM-01' }, { name: 'FARM-02' }] })
    const viva = montarGrafica(document.createElement('div'), dos, vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    viva.actualizar(opcion({ series: [{ name: 'interna' }] }))
    await asentar()
    expect(grafica.setOption.mock.calls[1][1]).toMatchObject({ notMerge: true })
    viva.cerrar()
  })

  it('una lectura nueva no deshace lo que se eligió en la leyenda', async () => {
    const conLeyenda = (extra: Partial<EChartsCoreOption> = {}) =>
      opcion({ legend: { selected: { ambiental: false } }, ...extra })
    const viva = montarGrafica(document.createElement('div'), conLeyenda(), vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    const [, alElegir] = grafica.on.mock.calls.find(([evento]) => evento === 'legendselectchanged')!
    alElegir({ selected: { ambiental: true } })

    viva.actualizar(conLeyenda({ series: [{ name: 'interna', data: [[1, 2]] }] }))
    await asentar()
    expect(grafica.setOption.mock.calls[1][0].legend.selected).toEqual({ ambiental: true })
    viva.cerrar()
  })

  it('solo se redimensiona si cambió el tamaño, y lo pendiente espera a que se vea', async () => {
    const host = document.createElement('div')
    let ancho = 300
    Object.defineProperty(host, 'clientWidth', { get: () => ancho })
    const viva = montarGrafica(host, opcion(), vi.fn(), async () => motor)
    verVista(true)
    await asentar()
    alCambiarTamano?.()
    await asentar()
    expect(grafica.resize).not.toHaveBeenCalled()

    ancho = 320
    alCambiarTamano?.()
    await asentar()
    expect(grafica.resize).toHaveBeenCalledTimes(1)

    verVista(false)
    ancho = 340
    alCambiarTamano?.()
    await asentar()
    expect(grafica.resize).toHaveBeenCalledTimes(1)
    verVista(true)
    expect(grafica.resize).toHaveBeenCalledTimes(2)
    viva.cerrar()
  })

  it('si el paquete no llega avisa del fallo sin lanzar, y también si la recuperación deja la promesa sin módulo', async () => {
    const estado = vi.fn()
    const viva = montarGrafica(document.createElement('div'), opcion(), estado, () => Promise.reject(new Error('sin red')))
    verVista(true)
    await asentar()
    expect(estado).toHaveBeenCalledWith('fallo')
    viva.cerrar()

    const otroEstado = vi.fn()
    observadores = []
    const otra = montarGrafica(document.createElement('div'), opcion(), otroEstado, async () => undefined)
    verVista(true)
    await asentar()
    expect(otroEstado).toHaveBeenCalledWith('fallo')
    otra.cerrar()
  })

  it('cerrar mientras se descarga no crea nada', async () => {
    const viva = montarGrafica(document.createElement('div'), opcion(), vi.fn(), async () => motor)
    verVista(true)
    viva.cerrar()
    await asentar()
    expect(crearGrafica).not.toHaveBeenCalled()
  })
})
