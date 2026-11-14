import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSerieTermica } from '@/application/hooks/useSerieTermica'
import type { SerieTermica } from '@/domain/entities/SerieTermica'
import { instalarAdaptadorFalso } from '@/tests/ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

const SERIE: SerieTermica = {
  device_id: 'FARM-01-CDL',
  desde: '2026-11-13T12:00:00Z',
  hasta: '2026-11-14T12:00:00Z',
  bucket_segundos: 60,
  bucket_automatico: true,
  intervalo_reporte_segundos: 10,
  umbral_brecha_segundos: 30,
  total_lecturas: 1,
  lecturas_sin_hora: 0,
  lecturas_manuales: 0,
  buckets: [
    {
      inicio: '2026-11-14T11:59:00Z',
      fin: '2026-11-14T12:00:00Z',
      lecturas: 1,
      temperatura_interna: { min: 5, max: 5, promedio: 5, n: 1 },
      temperatura_ambiental: { min: 22, max: 22, promedio: 22, n: 1 },
      humedad_ambiental: { min: 60, max: 60, promedio: 60, n: 1 },
    },
  ],
  brechas: [],
  resumen: {
    lecturas: 1,
    temperatura_interna: { min: 5, max: 5, promedio: 5, n: 1 },
    temperatura_ambiental: { min: 22, max: 22, promedio: 22, n: 1 },
    humedad_ambiental: { min: 60, max: 60, promedio: 60, n: 1 },
  },
}

describe('useSerieTermica (HU-31: serie agregada de 24 h y 7 d)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => {
    adaptador?.restaurar()
    vi.useRealTimers()
  })

  it('pide la ventana completa del equipo con intervalo automático, a una ruta que existe en el backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: SERIE }))
    const { result } = renderHook(() => useSerieTermica('FARM-01-CDL', 24))
    expect(result.current.estado).toBe('cargando')
    await act(async () => {})

    const peticion = adaptador.peticiones[0]
    expect(peticion.url).toBe('/api/lecturas/serie')
    expect(existeRuta('get', peticion.url)).toBe(true)
    expect(peticion.params).toMatchObject({ device_id: 'FARM-01-CDL', bucket: 'auto' })
    const lapso = Date.parse(String(peticion.params.hasta)) - Date.parse(String(peticion.params.desde))
    expect(lapso).toBe(24 * 3_600_000)
    expect(result.current).toMatchObject({ estado: 'lista', serie: SERIE })
  })

  it('7 d pide siete días', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: SERIE }))
    renderHook(() => useSerieTermica('FARM-01-CDL', 168))
    await act(async () => {})
    const { desde, hasta } = adaptador.peticiones[0].params
    expect(Date.parse(String(hasta)) - Date.parse(String(desde))).toBe(168 * 3_600_000)
  })

  it('la ventana de 1 h y la falta de equipo no la piden (usan lecturas crudas)', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: SERIE }))
    const corta = renderHook(() => useSerieTermica('FARM-01-CDL', 1))
    const sinEquipo = renderHook(() => useSerieTermica(null, 24))
    await act(async () => {})
    expect(adaptador.peticiones).toHaveLength(0)
    expect(corta.result.current).toMatchObject({ estado: 'inactiva', serie: null })
    expect(sinEquipo.result.current.estado).toBe('inactiva')
  })

  it('con un backend sin el endpoint vuelve a las lecturas crudas', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 404, data: { detail: 'Not Found' } }))
    const { result } = renderHook(() => useSerieTermica('FARM-01-CDL', 24))
    await act(async () => {})
    expect(result.current).toMatchObject({ estado: 'no_disponible', serie: null })
  })

  it('un refresco fallido conserva la serie ya mostrada', async () => {
    let falla = false
    adaptador = instalarAdaptadorFalso(() => (falla ? { status: 500 } : { data: SERIE }))
    const { result } = renderHook(() => useSerieTermica('FARM-01-CDL', 24))
    await act(async () => {})
    falla = true
    await act(async () => result.current.recargar())
    expect(result.current).toMatchObject({ estado: 'lista', serie: SERIE })
  })

  it('al cambiar de equipo descarta la serie del anterior mientras llega la nueva', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: SERIE }))
    const { result, rerender } = renderHook(({ id }) => useSerieTermica(id, 24), { initialProps: { id: 'FARM-01-CDL' } })
    await act(async () => {})
    expect(result.current.serie).toBe(SERIE)
    rerender({ id: 'FARM-02-CDL' })
    expect(result.current.serie).toBeNull()
    expect(result.current.estado).toBe('cargando')
  })

  it('se refresca periódicamente para incorporar lo sincronizado del buffer (HU-48 esc. 3)', async () => {
    vi.useFakeTimers()
    adaptador = instalarAdaptadorFalso(() => ({ data: SERIE }))
    renderHook(() => useSerieTermica('FARM-01-CDL', 24))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(adaptador.peticiones).toHaveLength(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(adaptador.peticiones.length).toBeGreaterThanOrEqual(2)
  })
})
