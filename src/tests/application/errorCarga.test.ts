import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuditoria } from '@/application/hooks/useAuditoria'
import { useDispositivos } from '@/application/hooks/useDispositivos'
import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useUsuarios } from '@/application/hooks/useUsuarios'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/infrastructure/api/apiClient', async (original) => ({
  ...(await original<typeof import('@/infrastructure/api/apiClient')>()),
  apiClient: { get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const CASOS = [
  ['useUsuarios', useUsuarios],
  ['useDispositivos', useDispositivos],
  ['useAuditoria', useAuditoria],
  ['useTrazabilidad', useTrazabilidad],
] as const

describe('una carga fallida no parece una lista vacía', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it.each(CASOS)('%s avisa del error', async (_nombre, gancho) => {
    get.mockImplementation(() => Promise.reject(new Error('sin servicio')))
    const { result } = renderHook(() => gancho())
    await waitFor(() => expect(result.current.errorCarga).toBe(true))
    expect(result.current.cargando).toBe(false)
  })

  it.each(CASOS)('%s no avisa si la carga funciona', async (_nombre, gancho) => {
    get.mockResolvedValue({ data: [] })
    const { result } = renderHook(() => gancho())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.errorCarga).toBe(false)
  })
})
