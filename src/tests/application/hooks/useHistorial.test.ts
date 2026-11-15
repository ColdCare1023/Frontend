import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { periodoEfectivo, useHistorial } from '@/application/hooks/useHistorial'
import type { SerieTermica } from '@/domain/entities/SerieTermica'
import { instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

function serie(device_id: string, total_lecturas = 10): SerieTermica {
  const e = { min: 4, max: 5, promedio: 4.5, n: total_lecturas }
  return {
    device_id,
    desde: '2026-07-24T12:00:00Z',
    hasta: '2026-07-25T12:00:00Z',
    bucket_segundos: 60,
    bucket_automatico: true,
    intervalo_reporte_segundos: 30,
    umbral_brecha_segundos: 90,
    total_lecturas,
    lecturas_sin_hora: 0,
    lecturas_manuales: 0,
    buckets: total_lecturas ? [{ inicio: '2026-07-25T11:00:00Z', fin: '2026-07-25T11:01:00Z', lecturas: total_lecturas, temperatura_interna: e, temperatura_ambiental: e, humedad_ambiental: e }] : [],
    brechas: [],
    resumen: { lecturas: total_lecturas, temperatura_interna: e, temperatura_ambiental: e, humedad_ambiental: e },
  }
}

/** HU-36 / B-14: el filtro de riesgo usa el riesgo efectivo, igual que la tabla. */
describe('useHistorial — filtro de riesgo', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('envía riesgo_efectivo, no nivel_riesgo', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [] }))
    const { result } = renderHook(() => useHistorial())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    await act(async () => {
      await result.current.consultar({ riesgo_efectivo: 'excursion_critica' })
    })

    const peticion = adaptador.peticiones.filter((p) => p.url === '/api/lecturas').at(-1)!
    expect(existeRuta('get', peticion.url)).toBe(true)
    expect(peticion.params).toMatchObject({ riesgo_efectivo: 'excursion_critica' })
    expect(peticion.params).not.toHaveProperty('nivel_riesgo')
  })
})

describe('useHistorial — HU-36: periodo completo, tabla paginada y serie', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('sin rango consulta las últimas 24 h y pagina con limite + offset', async () => {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url === '/api/lecturas') return { data: [], headers: { 'x-total-count': '0' } }
      if (config.url === '/api/lecturas/serie') return { data: serie(String((config.params as { device_id: string }).device_id), 0) }
      return { data: [] }
    })
    const { result } = renderHook(() => useHistorial({ device_id: 'FARM-01-CDL' }, 15))
    await waitFor(() => expect(result.current.cargandoSerie).toBe(false))

    const tabla = adaptador.peticiones.find((p) => p.url === '/api/lecturas')!
    expect(tabla.params).toMatchObject({ limite: '15', offset: '0', device_id: 'FARM-01-CDL' })
    const horas = (Date.parse(String(tabla.params.hasta)) - Date.parse(String(tabla.params.desde))) / 3_600_000
    expect(horas).toBe(24)
    expect(result.current.periodo.porDefecto).toBe(true)
    // La curva pide la serie del MISMO periodo que la tabla (HU-36 esc. 1).
    const curva = adaptador.peticiones.find((p) => p.url === '/api/lecturas/serie')!
    expect(existeRuta('get', curva.url)).toBe(true)
    expect(curva.params).toMatchObject({ device_id: 'FARM-01-CDL', desde: tabla.params.desde, hasta: tabla.params.hasta })
  })

  it('lee el total de X-Total-Count y pide la página siguiente con su offset', async () => {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url === '/api/lecturas') return { data: [], headers: { 'x-total-count': '8640' } }
      if (config.url === '/api/lecturas/serie') return { data: serie('FARM-01-CDL') }
      return { data: [] }
    })
    const { result } = renderHook(() => useHistorial({ device_id: 'FARM-01-CDL' }, 15))
    await waitFor(() => expect(result.current.total).toBe(8640))

    await act(async () => {
      await result.current.irAPagina(3)
    })

    expect(result.current.pagina).toBe(3)
    const ultima = adaptador.peticiones.filter((p) => p.url === '/api/lecturas').at(-1)!
    expect(ultima.params).toMatchObject({ limite: '15', offset: '30' })
    // Cambiar de página no vuelve a pedir la serie.
    expect(adaptador.peticiones.filter((p) => p.url === '/api/lecturas/serie')).toHaveLength(1)
  })

  it('sin filtro de equipo pide una serie por equipo activo y descarta los que no tienen lecturas', async () => {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url === '/api/dispositivos/estado-operativo') return { data: [{ id: 'FARM-01-CDL' }, { id: 'FARM-02-CDL' }] }
      if (config.url === '/api/lecturas/serie') {
        const id = String((config.params as { device_id: string }).device_id)
        return { data: serie(id, id === 'FARM-02-CDL' ? 0 : 12) }
      }
      return { data: [], headers: { 'x-total-count': '12' } }
    })
    const { result } = renderHook(() => useHistorial({}, 15))
    await waitFor(() => expect(result.current.cargandoSerie).toBe(false))

    const pedidas = adaptador.peticiones.filter((p) => p.url === '/api/lecturas/serie').map((p) => p.params.device_id)
    expect(pedidas).toEqual(['FARM-01-CDL', 'FARM-02-CDL'])
    expect(result.current.series.map((s) => s.device_id)).toEqual(['FARM-01-CDL'])
    expect(result.current.equiposConocidos).toEqual(['FARM-01-CDL', 'FARM-02-CDL'])
  })

  it('un equipo inexistente deja la tabla vacía y avisa en la curva', async () => {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.url === '/api/lecturas/serie') return { status: 404, data: { detail: 'Dispositivo no encontrado' } }
      return { data: [], headers: { 'x-total-count': '0' } }
    })
    const { result } = renderHook(() => useHistorial({ device_id: 'NO-EXISTE' }, 15))
    await waitFor(() => expect(result.current.cargandoSerie).toBe(false))
    expect(result.current.errorSerie).toBe('no_encontrado')
    expect(result.current.series).toEqual([])
  })

  it('sin X-Total-Count (backend anterior) ofrece una página más si la actual vino llena', async () => {
    const filas = Array.from({ length: 5 }, (_, i) => ({ id: `l-${i}`, device_id: 'FARM-01-CDL', timestamp: '2026-07-25T12:00:00Z' }))
    adaptador = instalarAdaptadorFalso((config) => (config.url === '/api/lecturas' ? { data: filas } : { data: serie('FARM-01-CDL') }))
    const { result } = renderHook(() => useHistorial({ device_id: 'FARM-01-CDL' }, 5))
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.total).toBe(6)
  })
})

describe('periodoEfectivo', () => {
  it('respeta desde y hasta y marca el periodo por defecto', () => {
    const ahora = Date.parse('2026-07-25T12:00:00Z')
    expect(periodoEfectivo({}, ahora)).toEqual({ desde: '2026-07-24T12:00:00.000Z', hasta: '2026-07-25T12:00:00.000Z', porDefecto: true })
    expect(periodoEfectivo({ hasta: '2026-07-20T00:00:00Z' }, ahora).desde).toBe('2026-07-19T00:00:00.000Z')
    expect(periodoEfectivo({ desde: '2026-07-01T00:00:00Z' }, ahora)).toMatchObject({ desde: '2026-07-01T00:00:00.000Z', porDefecto: false })
  })
})
