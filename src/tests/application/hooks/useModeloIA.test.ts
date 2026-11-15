import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { interpretarModeloNoDisponible, useModeloIA } from '@/application/hooks/useModeloIA'
import { instalarAdaptadorFalso } from '../../ayudas'
import openapi from '../../contrato/openapi-backend.json'

const DETALLE_RECHAZO =
  'El modelo Random Forest no está disponible: el artefacto no superó la verificación de integridad o compatibilidad al cargarse.'
const DETALLE_NO_ENTRENADO = 'El modelo Random Forest no está entrenado en este entorno.'

/** HU-16 (P1-7): el 503 de GET /api/ia/modelo distingue rechazo de modelo no entrenado. */
describe('interpretarModeloNoDisponible', () => {
  it.each(['checksum_invalido', 'hash_distinto_de_la_version_activa', 'sin_verificacion_de_integridad', 'incompatible', 'error_de_lectura'])(
    'rechazado_por_verificacion=true con motivo %s es «rechazado»',
    (motivo) => {
      expect(interpretarModeloNoDisponible({ detail: DETALLE_RECHAZO, motivo, rechazado_por_verificacion: true })).toEqual({
        estado: 'rechazado',
        motivo,
      })
    },
  )

  it.each(['no_entrenado', 'sin_metricas'])('rechazado_por_verificacion=false con motivo %s es «no entrenado»', (motivo) => {
    expect(interpretarModeloNoDisponible({ detail: DETALLE_NO_ENTRENADO, motivo, rechazado_por_verificacion: false })).toEqual({
      estado: 'no_entrenado',
      motivo,
    })
  })

  it('un motivo desconocido no se inventa: queda sin motivo, pero el estado se respeta', () => {
    expect(interpretarModeloNoDisponible({ motivo: 'otro', rechazado_por_verificacion: true })).toEqual({ estado: 'rechazado', motivo: null })
    expect(interpretarModeloNoDisponible({ motivo: 'checksum_invalido', rechazado_por_verificacion: false })).toEqual({
      estado: 'no_entrenado',
      motivo: null,
    })
  })

  it('backend anterior (solo `detail`): el texto de la verificación lo hace «rechazado»', () => {
    expect(interpretarModeloNoDisponible({ detail: DETALLE_RECHAZO })).toEqual({ estado: 'rechazado', motivo: null })
    expect(interpretarModeloNoDisponible({ detail: DETALLE_NO_ENTRENADO })).toEqual({ estado: 'no_entrenado', motivo: null })
    expect(interpretarModeloNoDisponible(undefined)).toEqual({ estado: 'no_entrenado', motivo: null })
  })

  it('el contrato del backend declara el 503 de GET /api/ia/modelo', () => {
    const respuestas = (openapi as unknown as { paths: Record<string, { get: { responses: Record<string, unknown> } }> }).paths['/api/ia/modelo'].get
      .responses
    expect(Object.keys(respuestas)).toContain('503')
  })
})

describe('useModeloIA', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso> | undefined
  afterEach(() => adaptador?.restaurar())

  it('200: disponible', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: { modelo_disponible: true, metadata: null, metricas: { model_version: 'v' } } }))
    const { result } = renderHook(() => useModeloIA())
    await waitFor(() => expect(result.current.estado).toBe('disponible'))
    expect(result.current.datos?.modelo_disponible).toBe(true)
    expect(result.current.rechazado).toBe(false)
    expect(adaptador.ultima().url).toBe('/api/ia/modelo')
  })

  it('503 rechazado por verificación', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      status: 503,
      data: { detail: DETALLE_RECHAZO, motivo: 'hash_distinto_de_la_version_activa', rechazado_por_verificacion: true },
    }))
    const { result } = renderHook(() => useModeloIA())
    await waitFor(() => expect(result.current.estado).toBe('rechazado'))
    expect(result.current.motivo).toBe('hash_distinto_de_la_version_activa')
    expect(result.current.noEntrenado).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('503 no entrenado', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      status: 503,
      data: { detail: DETALLE_NO_ENTRENADO, motivo: 'sin_metricas', rechazado_por_verificacion: false },
    }))
    const { result } = renderHook(() => useModeloIA())
    await waitFor(() => expect(result.current.estado).toBe('no_entrenado'))
    expect(result.current.motivo).toBe('sin_metricas')
    expect(result.current.noEntrenado).toBe(true)
  })

  it('otro fallo es un error de carga', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 500, data: {} }))
    const { result } = renderHook(() => useModeloIA())
    await waitFor(() => expect(result.current.estado).toBe('error'))
    expect(result.current.error).toBe(true)
  })

  it('P-12: recargar relee el estado sin pasar por «cargando» (tras desactivar una versión)', async () => {
    // Con una versión activa, la huella del legado queda fijada a ella y el legado se rechaza…
    let respuesta: { status?: number; data: unknown } = {
      status: 503,
      data: { detail: DETALLE_RECHAZO, motivo: 'hash_distinto_de_la_version_activa', rechazado_por_verificacion: true },
    }
    adaptador = instalarAdaptadorFalso(() => respuesta)
    const estados: string[] = []
    const { result } = renderHook(() => {
      const valor = useModeloIA()
      estados.push(valor.estado)
      return valor
    })
    await waitFor(() => expect(result.current.estado).toBe('rechazado'))
    // …y al desactivarla vuelve la línea base: el legado experimental está disponible.
    respuesta = { data: { modelo_disponible: true, metadata: null, metricas: { model_version: 'v' } } }
    estados.length = 0
    await act(() => result.current.recargar())
    expect(result.current.estado).toBe('disponible')
    expect(result.current.motivo).toBeNull()
    expect(estados).not.toContain('cargando')
  })
})
