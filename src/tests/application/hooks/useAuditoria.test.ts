import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nombreDeContentDisposition, useAuditoria } from '@/application/hooks/useAuditoria'
import { instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'
import openapi from '../../contrato/openapi-backend.json'

type Parametro = { name: string; schema?: { anyOf?: Array<{ enum?: string[] }> } }
const parametrosDe = (ruta: string) =>
  ((openapi as unknown as { paths: Record<string, { get: { parameters: Parametro[] } }> }).paths[ruta].get.parameters ?? [])

describe('useAuditoria — HU-42/HU-50: filtros del servidor', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('envía el resultado, el usuario y el periodo que acepta GET /api/auditoria', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [] }))
    const { result } = renderHook(() => useAuditoria())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    await act(async () => {
      await result.current.consultar({ resultado: 'denegado', usuario_id: '3f2b9c1e-7d4a-4f6b-9a0e-1c2d3e4f5a6b', desde: '2026-07-01T00:00' })
    })
    const peticion = adaptador.peticiones.at(-1)!
    expect(existeRuta('get', peticion.url)).toBe(true)
    expect(peticion.params).toMatchObject({ resultado: 'denegado', usuario_id: '3f2b9c1e-7d4a-4f6b-9a0e-1c2d3e4f5a6b', limite: '200' })
    const aceptados = parametrosDe('/api/auditoria').map((p) => p.name)
    for (const nombre of Object.keys(peticion.params)) expect(aceptados).toContain(nombre)
    const valores = parametrosDe('/api/auditoria').find((p) => p.name === 'resultado')?.schema?.anyOf?.find((o) => o.enum)?.enum
    expect(valores).toEqual(['exitoso', 'fallido', 'denegado', 'bloqueado'])
  })

  it('un 422 (usuario que no es UUID) se distingue de un fallo del servidor', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 422, data: { detail: [] } }))
    const { result } = renderHook(() => useAuditoria())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.errorCarga).toBe(true)
    expect(result.current.motivoError).toBe('validacion')
  })
})

describe('useAuditoria — exportación CSV del servidor (HU-42 esc. 1, HU-50 esc. 4)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  const crear = vi.fn(() => 'blob:auditoria')
  const revocar = vi.fn()
  let descargado: string | null = null

  beforeEach(() => {
    descargado = null
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargado = this.download
    })
  })
  afterEach(() => {
    adaptador?.restaurar()
    vi.restoreAllMocks()
  })

  it('pide /api/auditoria/exportar con los mismos filtros y usa el nombre del servidor', async () => {
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/auditoria/exportar'
        ? { data: new Blob(['# alcance\n']), headers: { 'content-disposition': 'attachment; filename="bitacora_20261114T120000Z.csv"' } }
        : { data: [] },
    )
    const { result } = renderHook(() => useAuditoria())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let resultado = ''
    await act(async () => {
      resultado = await result.current.exportar({ resultado: 'bloqueado', accion: 'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO' })
    })
    expect(resultado).toBe('ok')
    const peticion = adaptador.peticiones.find((p) => p.url === '/api/auditoria/exportar')!
    expect(existeRuta('get', peticion.url)).toBe(true)
    expect(peticion.params).toEqual({ resultado: 'bloqueado', accion: 'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO' })
    expect(descargado).toBe('bitacora_20261114T120000Z.csv')
  })

  it('el 429 de la cuota por usuario se informa como «cuota»', async () => {
    adaptador = instalarAdaptadorFalso((config) => (config.url === '/api/auditoria/exportar' ? { status: 429 } : { data: [] }))
    const { result } = renderHook(() => useAuditoria())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    let resultado = ''
    await act(async () => {
      resultado = await result.current.exportar({})
    })
    expect(resultado).toBe('cuota')
    expect(descargado).toBeNull()
  })

  it('lee Content-Disposition con y sin comillas, y no admite rutas', () => {
    expect(nombreDeContentDisposition('attachment; filename="bitacora_1.csv"')).toBe('bitacora_1.csv')
    expect(nombreDeContentDisposition('attachment; filename=bitacora_2.csv')).toBe('bitacora_2.csv')
    expect(nombreDeContentDisposition("attachment; filename*=UTF-8''bit%C3%A1cora.csv")).toBe('bitácora.csv')
    expect(nombreDeContentDisposition('attachment; filename="../x/y.csv"')).toBe('.._x_y.csv')
    expect(nombreDeContentDisposition(undefined)).toBe('coldcare-auditoria.csv')
  })
})
