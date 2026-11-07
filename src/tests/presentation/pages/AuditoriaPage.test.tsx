import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
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
  beforeEach(() => {
    useAuditoria.mockReset()
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  it('lista las acciones críticas registradas, en palabras y no con su código', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText('Revisó una alerta')).toBeInTheDocument()
    expect(screen.getByText('alertas/9f1')).toBeInTheDocument()
  })

  it('responde quién hizo qué y cuándo en una frase', () => {
    useAuditoria.mockReturnValue({
      registros: [
        registro({ id: 'a-1', created_at: new Date().toISOString(), resultado: 'exitoso' }),
        registro({ id: 'a-2', created_at: '2024-03-14T15:00:00Z', resultado: 'fallido' }),
      ],
      cargando: false,
    })
    render(<AuditoriaPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Quién hizo qué y cuándo' })).toBeInTheDocument()
    expect(screen.getByText(/acciones registradas; 1 no salió bien\. La última fue hoy a las \d{2}:\d{2}\./)).toBeInTheDocument()
  })

  it('dice quién lo hizo: «Tú» para lo propio y el código de usuario para el resto', () => {
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'auditor@upc.pe', rol: 'auditor', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
    })
    useAuditoria.mockReturnValue({
      registros: [
        registro({ id: 'a-1' }),
        registro({ id: 'a-2', usuario_id: 'u-9' }),
        registro({ id: 'a-3', usuario_id: null, accion: 'LOGIN_FALLIDO', resultado: 'fallido' }),
      ],
      cargando: false,
    })
    render(<AuditoriaPage />)

    expect(screen.getByText('Tú')).toBeInTheDocument()
    expect(screen.getByText('Usuario u-9')).toBeInTheDocument()
    expect(screen.getByText('Sin usuario identificado')).toBeInTheDocument()
  })

  it('lo técnico (usuario, recurso, IP, código) se abre con «Ver detalle» en su fila', async () => {
    const usuario = userEvent.setup()
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    const boton = screen.getByRole('button', { name: /^ver detalle: revisó una alerta/i })
    const fila = boton.closest('[role="row"]')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(fila).not.toHaveAttribute('data-abierta')
    // Siguen en la fila para el lector de pantalla, aunque estén plegados.
    expect(fila).toHaveTextContent('ALERTA_REVISADA')

    await usuario.click(boton)

    expect(screen.getByRole('button', { name: /^ocultar detalle: revisó una alerta/i })).toHaveAttribute('aria-expanded', 'true')
    expect(fila).toHaveAttribute('data-abierta')
  })

  it('muestra la IP de origen: sin ella la entrada no sirve como evidencia', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText('190.12.4.7')).toBeInTheDocument()
  })

  it('declara explícitamente que no hay registros en vez de mostrar una tabla vacía', () => {
    useAuditoria.mockReturnValue({ registros: [], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText(/no.*acciones registradas|no recorded actions/i)).toBeInTheDocument()
  })

  it('HU-50 criterio 1: permite filtrar por acción, usuario y periodo', async () => {
    const usuario = userEvent.setup()
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar })
    render(<AuditoriaPage />)

    // Los filtros viven en un panel plegado: primero se abre la barra.
    await usuario.click(screen.getByRole('button', { name: /^filtros$/i }))
    await usuario.type(screen.getByLabelText(/acción/i), 'LOGIN_FALLIDO')
    await usuario.type(screen.getByLabelText(/usuario/i), 'u-7')
    await usuario.click(screen.getByRole('button', { name: /aplicar|consultar|filtrar|buscar/i }))

    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN_FALLIDO', usuario_id: 'u-7' }))
  })

  it('HU-50: lo escrito en el panel se aplica también al cerrarlo, sin perder nada', async () => {
    const usuario = userEvent.setup()
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar })
    render(<AuditoriaPage />)

    await usuario.click(screen.getByRole('button', { name: /^filtros$/i }))
    await usuario.type(screen.getByLabelText(/acción/i), 'LOGIN')
    expect(consultar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: /listo/i }))

    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN' }))
  })

  it('cada filtro aplicado queda a la vista y se quita por separado', async () => {
    const usuario = userEvent.setup()
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar })
    render(<AuditoriaPage />)

    await usuario.click(screen.getByRole('button', { name: /^filtros$/i }))
    await usuario.type(screen.getByLabelText(/acción/i), 'LOGIN')
    await usuario.type(screen.getByLabelText(/usuario/i), 'u-7')
    await usuario.click(screen.getByRole('button', { name: /aplicar filtros/i }))
    await usuario.keyboard('{Escape}')

    await usuario.click(await screen.findByRole('button', { name: /quitar filtro: acción: login/i }))

    expect(consultar).toHaveBeenLastCalledWith({ accion: undefined, usuario_id: 'u-7' })
    expect(screen.getByRole('button', { name: /quitar filtro: usuario: u-7/i })).toBeInTheDocument()
  })

  it('agrupa por día y conserva las columnas para el lector de pantalla', () => {
    useAuditoria.mockReturnValue({
      registros: [
        registro({ id: 'a-1', created_at: new Date().toISOString() }),
        registro({ id: 'a-2', created_at: new Date().toISOString(), resultado: 'fallido' }),
        registro({ id: 'a-3', created_at: '2024-03-14T15:00:00Z' }),
      ],
      cargando: false,
    })
    render(<AuditoriaPage />)

    expect(screen.getByRole('table', { name: /bitácora de auditoría/i })).toBeInTheDocument()
    for (const columna of [/resultado/i, /recurso/i, /ip de origen/i, /id de usuario/i]) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeInTheDocument()
    }
    // Una cabecera por día, con la cuenta de su día.
    const dias = screen.getAllByRole('rowheader')
    expect(dias).toHaveLength(2)
    expect(dias[0]).toHaveTextContent(/hoy/i)
    expect(dias[0]).toHaveTextContent(/2 acciones/i)
    expect(dias[0]).toHaveTextContent(/1 sin éxito/i)
    expect(dias[1]).toHaveTextContent(/2024/)
  })

  it('el resultado se lee en cada acción y un bloqueo no se pinta de crítico', () => {
    useAuditoria.mockReturnValue({
      registros: [
        registro({ id: 'a-1', resultado: 'exitoso' }),
        registro({ id: 'a-2', resultado: 'fallido' }),
        registro({ id: 'a-3', accion: 'BLOQUEO_TEMPORAL', resultado: 'bloqueado' }),
        registro({ id: 'a-4', resultado: 'denegado' }),
      ],
      cargando: false,
    })
    render(<AuditoriaPage />)

    expect(screen.getByText('exitoso')).toBeInTheDocument()
    expect(screen.getByText('fallido')).toHaveClass('bg-critical-solid')
    expect(screen.getByText('denegado')).toBeInTheDocument()
    expect(screen.getByText('bloqueado')).toHaveClass('bg-honey-100')
    expect(screen.getByText('bloqueado')).not.toHaveClass('bg-critical-solid')
  })

  it('avisa de los bloqueos temporales sin afirmar un ataque', () => {
    useAuditoria.mockReturnValue({
      registros: [registro({ accion: 'BLOQUEO_TEMPORAL', resultado: 'bloqueado' })],
      cargando: false,
    })
    render(<AuditoriaPage />)

    expect(screen.getByRole('status')).toHaveTextContent(/1 bloqueo temporal.*no confirma un ataque/i)
  })

  it('distingue una bitácora vacía de un filtro sin coincidencias', async () => {
    const usuario = userEvent.setup()
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [], cargando: false, consultar })
    render(<AuditoriaPage />)
    expect(screen.getByText(/todavía no hay acciones registradas/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /^filtros$/i }))
    await usuario.type(screen.getByLabelText(/acción/i), 'NADA')
    await usuario.click(screen.getByRole('button', { name: /aplicar filtros/i }))
    await usuario.keyboard('{Escape}')

    expect(await screen.findByText(/ninguna acción coincide/i)).toBeInTheDocument()
  })

  it('si la consulta falla lo dice y permite reintentar con los mismos filtros', async () => {
    const usuario = userEvent.setup()
    const consultar = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValue(undefined)
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar })
    render(<AuditoriaPage />)

    await usuario.click(screen.getByRole('button', { name: /^filtros$/i }))
    await usuario.type(screen.getByLabelText(/acción/i), 'LOGIN')
    await usuario.click(screen.getByRole('button', { name: /aplicar filtros/i }))
    await usuario.keyboard('{Escape}')

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos consultar la bitácora/i)
    await usuario.click(screen.getByRole('button', { name: /volver a intentar/i }))

    expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'LOGIN' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('exportar CSV sigue disponible y se bloquea sin registros', () => {
    useAuditoria.mockReturnValue({ registros: [], cargando: false, consultar: vi.fn() })
    render(<AuditoriaPage />)

    expect(screen.getByRole('button', { name: /exportar csv/i })).toBeDisabled()
  })
})
