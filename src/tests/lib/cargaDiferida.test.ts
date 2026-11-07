import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { alAcercarse, enMomentoLibre, observarVista } from '@/lib/cargaDiferida'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('alAcercarse', () => {
  let avisar: (entradas: Array<{ isIntersecting: boolean }>) => void
  let opciones: IntersectionObserverInit & { scrollMargin?: string }
  const disconnect = vi.fn()

  beforeEach(() => {
    disconnect.mockClear()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof avisar, op: typeof opciones) {
          avisar = cb
          opciones = op
        }
        observe() {}
        disconnect = disconnect
      },
    )
  })

  it('avisa una sola vez, al entrar, y deja de observar', () => {
    const hacer = vi.fn()
    alAcercarse(document.createElement('div'), hacer)
    avisar([{ isIntersecting: false }])
    expect(hacer).not.toHaveBeenCalled()
    avisar([{ isIntersecting: true }])
    avisar([{ isIntersecting: true }])
    expect(hacer).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalled()
  })

  it('el margen vale también para contenedores con scroll propio', () => {
    alAcercarse(document.createElement('div'), vi.fn(), '50% 0px')
    expect(opciones).toMatchObject({ rootMargin: '50% 0px', scrollMargin: '50% 0px' })
  })

  it('se puede cancelar antes de que llegue', () => {
    const hacer = vi.fn()
    const cancelar = alAcercarse(document.createElement('div'), hacer)
    cancelar()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('sin IntersectionObserver', () => {
  it('da el elemento por visible', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const hacer = vi.fn()
    alAcercarse(document.createElement('div'), hacer)
    expect(hacer).toHaveBeenCalledTimes(1)
    const alCambiar = vi.fn()
    observarVista(document.createElement('div'), alCambiar)
    expect(alCambiar).toHaveBeenCalledWith(true)
  })
})

describe('enMomentoLibre', () => {
  it('usa requestIdleCallback con su tope de espera', () => {
    const pedir = vi.fn(() => 7)
    const cancelar = vi.fn()
    vi.stubGlobal('requestIdleCallback', pedir)
    vi.stubGlobal('cancelIdleCallback', cancelar)
    enMomentoLibre(vi.fn(), 400)()
    expect(pedir).toHaveBeenCalledWith(expect.any(Function), { timeout: 400 })
    expect(cancelar).toHaveBeenCalledWith(7)
  })

  it('en Safari, sin requestIdleCallback, espera un respiro corto y se puede cancelar', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const hacer = vi.fn()
    enMomentoLibre(hacer, 5000)
    vi.advanceTimersByTime(120)
    expect(hacer).toHaveBeenCalledTimes(1)
    const otra = vi.fn()
    enMomentoLibre(otra, 5000)()
    vi.advanceTimersByTime(500)
    expect(otra).not.toHaveBeenCalled()
  })
})
