import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RegistroAuditoria } from '@/domain/entities/Usuario'

const useAuditoria = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAuditoria', () => ({ useAuditoria }))

import { AuditoriaPage } from '@/presentation/pages/AuditoriaPage'

function registro(over: Partial<RegistroAuditoria> = {}): RegistroAuditoria {
  return {
    id: 'a-1',
    usuario_id: 'u-1',
    accion: 'ALERTA_REVISADA',
    recurso: 'alertas/9f1',
    detalle: null,
    ip_origen: '190.12.4.7',
    created_at: '2026-07-25T10:00:00Z',
    ...over,
  }
}

describe('AuditoriaPage (HU-42, RF-16)', () => {
  beforeEach(() => useAuditoria.mockReset())

  it('lista las acciones críticas registradas', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText('ALERTA_REVISADA')).toBeInTheDocument()
    expect(screen.getByText('alertas/9f1')).toBeInTheDocument()
  })

  it('muestra la IP de origen: sin ella la entrada no sirve como evidencia', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText('190.12.4.7')).toBeInTheDocument()
  })

  it('declara explícitamente que no hay registros en vez de mostrar una tabla vacía', () => {
    useAuditoria.mockReturnValue({ registros: [], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText(/no hay acciones críticas/i)).toBeInTheDocument()
  })

  it('HU-50 criterio 1: permite filtrar por acción, usuario y periodo', async () => {
    const usuario = userEvent.setup()
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar })
    render(<AuditoriaPage />)

    await usuario.type(screen.getByLabelText(/acción/i), 'LOGIN_FALLIDO')
    await usuario.click(screen.getByRole('button', { name: /aplicar|consultar|filtrar|buscar/i }))

    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN_FALLIDO' }))
  })
})
