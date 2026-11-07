import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Cada prueba carga el módulo de nuevo: la detección se guarda la primera vez que se pregunta. */
async function cargar() {
  vi.resetModules()
  return import('@/lib/rendimiento')
}

const GRAFICA_REAL = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'

function simularEquipo({
  grafica = GRAFICA_REAL,
  nucleos = 8,
  memoria = 16,
  ancho = 1440,
  tactil = false,
}: { grafica?: string | null; nucleos?: number; memoria?: number; ancho?: number; tactil?: boolean }) {
  vi.stubGlobal('WebGLRenderingContext', grafica === null ? undefined : class {})
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: nucleos, configurable: true })
  Object.defineProperty(navigator, 'deviceMemory', { value: memoria, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: ancho, configurable: true })
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: tactil && query.includes('coarse') }) as MediaQueryList)
  const loseContext = vi.fn()
  const contexto = {
    RENDERER: 1,
    getExtension: (nombre: string) => (nombre === 'WEBGL_lose_context' ? { loseContext } : { UNMASKED_RENDERER_WEBGL: 2 }),
    getParameter: () => grafica,
  }
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as never)
  return { getContext, loseContext }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('niveles de rendimiento', () => {
  it('una tarjeta real en un equipo sobrado es nivel alto y libera el contexto de prueba', async () => {
    const { loseContext } = simularEquipo({})
    const { rendimiento, segunNivel } = await cargar()
    expect(rendimiento.nivel).toBe('alto')
    expect(rendimiento.sinAceleracion).toBe(false)
    expect(segunNivel('a', 'm', 'b')).toBe('a')
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('no prueba WebGL hasta que alguien pregunta, y solo una vez', async () => {
    const { getContext } = simularEquipo({})
    const { rendimiento } = await cargar()
    expect(getContext).not.toHaveBeenCalled()
    void rendimiento.nivel
    void rendimiento.nivel
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('un teléfono, pocos núcleos o una integrada de Intel son nivel medio', async () => {
    simularEquipo({ tactil: true, ancho: 402 })
    expect((await cargar()).rendimiento.nivel).toBe('medio')
    simularEquipo({ nucleos: 4 })
    expect((await cargar()).rendimiento.nivel).toBe('medio')
    simularEquipo({ grafica: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)' })
    expect((await cargar()).rendimiento.nivel).toBe('medio')
  })

  it('poca memoria es nivel bajo, pero aún dibuja el 3D', async () => {
    simularEquipo({ memoria: 2 })
    const { rendimiento } = await cargar()
    expect(rendimiento.nivel).toBe('bajo')
    expect(rendimiento.sinAceleracion).toBe(false)
  })

  it('sin WebGL o dibujando por CPU, el 3D no se descarga', async () => {
    simularEquipo({ grafica: 'Google SwiftShader' })
    let { rendimiento } = await cargar()
    expect(rendimiento.nivel).toBe('bajo')
    expect(rendimiento.sinAceleracion).toBe(true)
    simularEquipo({ grafica: null })
    ;({ rendimiento } = await cargar())
    expect(rendimiento.sinAceleracion).toBe(true)
  })

  it('el vial quieto pide menos cuadros cuanto más modesto es el equipo', async () => {
    simularEquipo({})
    const { rendimiento, ritmoQuieto } = await cargar()
    const alto = ritmoQuieto()
    rendimiento.nivel = 'bajo'
    expect(ritmoQuieto()).toBeGreaterThan(alto)
  })
})

describe('vigilancia de cuadros', () => {
  let pendientes: FrameRequestCallback[] = []
  let reloj = 0

  /** Da `cuantos` cuadros de `ms` milisegundos cada uno. */
  function pasarCuadros(cuantos: number, ms: number) {
    for (let i = 0; i < cuantos; i += 1) {
      reloj += ms
      const ahora = pendientes
      pendientes = []
      ahora.forEach((cuadro) => cuadro(reloj))
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    pendientes = []
    reloj = 0
    vi.stubGlobal('requestAnimationFrame', (cuadro: FrameRequestCallback) => {
      pendientes.push(cuadro)
      return pendientes.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      pendientes = []
    })
    vi.spyOn(performance, 'now').mockImplementation(() => reloj)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no pide cuadros mientras espera: vigila a ratos para no despertar la pantalla', async () => {
    simularEquipo({})
    const { vigilarRendimiento } = await cargar()
    const detener = vigilarRendimiento()
    expect(pendientes).toHaveLength(0)
    vi.advanceTimersByTime(4000)
    expect(pendientes).toHaveLength(1)
    detener()
    expect(pendientes).toHaveLength(0)
  })

  it('un tramo muy lento baja un nivel, salvo que alguien pueda aliviar antes con menos resolución', async () => {
    simularEquipo({})
    const { rendimiento, vigilarRendimiento } = await cargar()
    const alivio = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const detener = vigilarRendimiento(alivio)

    vi.advanceTimersByTime(4000)
    pasarCuadros(76, 40)
    expect(alivio).toHaveBeenCalledTimes(1)
    expect(rendimiento.nivel).toBe('alto')

    vi.advanceTimersByTime(15000)
    pasarCuadros(76, 40)
    expect(alivio).toHaveBeenCalledTimes(2)
    expect(rendimiento.nivel).toBe('medio')
    detener()
  })

  it('un tramo apenas lento puede ser un tropiezo: hacen falta dos seguidos', async () => {
    simularEquipo({})
    const { rendimiento, vigilarRendimiento } = await cargar()
    const detener = vigilarRendimiento()

    vi.advanceTimersByTime(4000)
    pasarCuadros(76, 25)
    expect(rendimiento.nivel).toBe('alto')
    vi.advanceTimersByTime(15000)
    pasarCuadros(76, 25)
    expect(rendimiento.nivel).toBe('medio')
    detener()
  })

  it('las pausas largas (pestaña oculta, carga de una escena) no cuentan como lentitud', async () => {
    simularEquipo({})
    const { rendimiento, vigilarRendimiento } = await cargar()
    const detener = vigilarRendimiento()
    vi.advanceTimersByTime(4000)
    pasarCuadros(10, 900)
    pasarCuadros(76, 16)
    expect(rendimiento.nivel).toBe('alto')
    detener()
  })
})
