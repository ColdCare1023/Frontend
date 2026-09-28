import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import {
  MAX_DIAS_RANGO_REPORTE,
  diasDeRango,
  useReportesBPA,
  validarRango,
} from '@/application/hooks/useReportesBPA'
import { instalarAdaptadorFalso } from '@/tests/ayudas'

/**
 * Contrato del reporte BPA (RF-13) contra el backend.
 *
 * El backend dejó de ignorar el periodo (hallazgo S-03 de su propia auditoría)
 * y añadió dos rechazos nuevos: rango invertido y periodos de más de 366 días,
 * ambos 400, más una cuota propia de 10 peticiones por minuto y usuario (429).
 * Estas pruebas fijan que el cliente hable ese mismo idioma.
 */

describe('Rango del periodo', () => {
  it('cuenta los días del periodo sin depender de la zona horaria', () => {
    expect(diasDeRango('2026-01-01', '2026-01-31')).toBe(30)
    expect(diasDeRango('2026-01-15', '2026-01-15')).toBe(0)
  })

  it('cuenta correctamente a través de un cambio de horario de verano', () => {
    // `(hasta - desde) / 86 400 000` sobre fechas locales daría 30.958… en un
    // huso con horario de verano. El cálculo va por `Date.UTC`, que no lo tiene.
    expect(diasDeRango('2026-03-01', '2026-04-01')).toBe(31)
    expect(diasDeRango('2026-10-01', '2026-11-01')).toBe(31)
  })

  it('acepta un periodo en el límite y rechaza el que lo supera', () => {
    expect(validarRango('2026-01-01', '2027-01-02')).toBe(null)
    expect(diasDeRango('2026-01-01', '2027-01-02')).toBe(MAX_DIAS_RANGO_REPORTE)
    expect(validarRango('2026-01-01', '2027-01-03')).toBe('periodo_excesivo')
  })

  it('rechaza el rango invertido', () => {
    expect(validarRango('2026-02-01', '2026-01-01')).toBe('rango_invertido')
  })
})

describe('useReportesBPA', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso> | null = null

  afterEach(() => {
    adaptador?.restaurar()
    adaptador = null
    vi.useRealTimers()
  })

  it('envía el inicio y el fin del día en hora local, no medianoche UTC', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: { lecturas: [] } }))
    const { result } = renderHook(() => useReportesBPA())

    await act(async () => {
      await result.current.generar('2026-01-15', '2026-01-15')
    })

    const params = adaptador.ultima().params as { fecha_desde: string; fecha_hasta: string }
    const desde = new Date(params.fecha_desde)
    const hasta = new Date(params.fecha_hasta)

    // El defecto: `new Date('2026-01-15')` es medianoche UTC y
    // `new Date('2026-01-15T23:59:59')` es hora local. Mezclarlos hacía que el
    // periodo empezara horas antes del día pedido. Ambos extremos deben caer
    // en el mismo día del calendario **local**.
    expect(desde.getFullYear()).toBe(2026)
    expect(desde.getMonth()).toBe(0)
    expect(desde.getDate()).toBe(15)
    expect(desde.getHours()).toBe(0)
    expect(desde.getMinutes()).toBe(0)

    expect(hasta.getDate()).toBe(15)
    expect(hasta.getHours()).toBe(23)
    expect(hasta.getMinutes()).toBe(59)
  })

  it('no llega a llamar al backend con un rango que sabe inválido', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: {} }))
    const { result } = renderHook(() => useReportesBPA())

    await act(async () => {
      await result.current.generar('2026-02-01', '2026-01-01')
    })

    // El endpoint tiene cuota propia: gastar un intento en algo que el backend
    // va a rechazar con 400 penaliza dos veces al usuario.
    expect(adaptador.peticiones).toHaveLength(0)
    expect(result.current.error).toBe('rango_invertido')
  })

  it('distingue la cuota agotada (429) de un fallo genérico', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 429, data: {} }))
    const { result } = renderHook(() => useReportesBPA())

    await act(async () => {
      await result.current.generar('2026-01-01', '2026-01-31')
    })

    expect(result.current.error).toBe('cuota')
  })

  it('clasifica como genérico cualquier otro fallo de la descarga PDF', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 500, data: {} }))
    const { result } = renderHook(() => useReportesBPA())

    await act(async () => {
      await result.current.descargarPdf('2026-01-01', '2026-01-31')
    })

    expect(result.current.error).toBe('generico')
    expect(result.current.descargandoPdf).toBe(false)
  })

  it('el PDF también respeta el periodo y lo pide al backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: new Blob(['%PDF']) }))
    const { result } = renderHook(() => useReportesBPA())

    await act(async () => {
      await result.current.descargarPdf('2026-01-01', '2026-01-31', 'FARM-01-CDL')
    })

    const peticion = adaptador.ultima()
    expect(peticion.url).toBe('/api/reportes/bpa/pdf')
    expect(peticion.params.device_id).toBe('FARM-01-CDL')
    expect(peticion.params.fecha_desde).toBeDefined()
    expect(peticion.params.fecha_hasta).toBeDefined()
  })
})
