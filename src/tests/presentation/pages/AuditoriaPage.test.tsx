import { render, screen, within } from '@testing-library/react'
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

  it('un fallo de carga se muestra como error, no como bitácora vacía', async () => {
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [], cargando: false, errorCarga: true, consultar })
    render(<AuditoriaPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar/i)
    expect(screen.queryByText(/no.*acciones registradas|no recorded actions/i)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(consultar).toHaveBeenCalled()
  })

  it('lista las acciones críticas registradas', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    expect(screen.getByText(/alerta reconocida|alert acknowledged/i)).toBeInTheDocument()
    expect(screen.getByText('alertas/9f1')).toBeInTheDocument()
  })

  it('muestra la IP de origen: sin ella la entrada no sirve como evidencia', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)

    expect(within(screen.getByRole('region', { name: /bitácora de auditoría/i })).getByText('190.12.4.7')).toBeInTheDocument()
  })

  it('el usuario corto se muestra entero y un UUID se abrevia a 8 caracteres', () => {
    useAuditoria.mockReturnValue({
      registros: [
        registro({ id: 'a-1', usuario_id: 'u-02' }),
        registro({ id: 'a-2', usuario_id: '3f2b9c1e-7d4a-4f6b-9a0e-1c2d3e4f5a6b' }),
      ],
      cargando: false,
    })
    render(<AuditoriaPage />)
    const tabla = within(screen.getByRole('region', { name: /bitácora de auditoría/i }))
    expect(tabla.getByText('u-02')).toBeInTheDocument()
    expect(tabla.queryByText('u-02…')).not.toBeInTheDocument()
    expect(tabla.getByText('3f2b9c1e…')).toBeInTheDocument()
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

    await usuario.type(screen.getByLabelText(/acción/i), 'LOGIN_FALLIDO')
    await usuario.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN_FALLIDO' }))
  })
})

describe('AuditoriaPage — rediseño P6 (registros)', () => {
  beforeEach(() => useAuditoria.mockReset())

  it('agrupa la bitácora por día', () => {
    useAuditoria.mockReturnValue({
      registros: [registro(), registro({ id: 'a-2', created_at: '2026-07-20T10:00:00Z' })],
      cargando: false,
    })
    render(<AuditoriaPage />)
    const cabeceras = screen.getAllByRole('columnheader').filter((th) => th.getAttribute('scope') === 'colgroup')
    expect(cabeceras).toHaveLength(2)
    expect(cabeceras[0]).toHaveTextContent(/1 acción/)
  })

  it('el detalle muestra el usuario completo, el recurso y el detalle registrado', async () => {
    useAuditoria.mockReturnValue({
      registros: [registro({ usuario_id: 'u-1234567890', detalle: { motivo: 'credenciales_invalidas' } })],
      cargando: false,
    })
    render(<AuditoriaPage />)
    await userEvent.click(screen.getByRole('button', { name: /ver detalle de/i }))
    const detalle = document.getElementById('detalle-a-1') as HTMLElement
    expect(detalle).toHaveTextContent('u-1234567890')
    expect(detalle).toHaveTextContent('alertas/9f1')
    expect(detalle).toHaveTextContent('credenciales_invalidas')
  })

  it('HU-42/HU-50: el filtro de resultado consulta al servidor con el resultado real', async () => {
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({
      registros: [registro(), registro({ id: 'a-2', accion: 'LOGIN_FALLIDO', resultado: 'fallido', recurso: 'auth/login' })],
      cargando: false,
      consultar,
    })
    render(<AuditoriaPage />)
    const selector = screen.getByLabelText(/^resultado$/i) as HTMLSelectElement
    expect([...selector.options].map((o) => o.value)).toEqual(['', 'exitoso', 'fallido', 'denegado', 'bloqueado'])
    await userEvent.selectOptions(selector, 'denegado')
    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'denegado' }))
    expect(screen.getByText('Resultado: Denegado')).toBeInTheDocument()
  })

  it('muestra Sin sesión cuando no hay usuario', () => {
    useAuditoria.mockReturnValue({ registros: [registro({ usuario_id: null })], cargando: false })
    render(<AuditoriaPage />)
    expect(screen.getByText(/sin sesión/i)).toBeInTheDocument()
  })

  it('el aviso de bloqueos se mantiene como guía con role status', () => {
    useAuditoria.mockReturnValue({ registros: [registro({ accion: 'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO', resultado: 'bloqueado' })], cargando: false })
    render(<AuditoriaPage />)
    expect(screen.getByRole('status', { name: '' , hidden: false })).toBeDefined()
    expect(screen.getByText(/bloqueo temporal de acceso registrado/i).closest('[role="status"]')).not.toBeNull()
  })
})

describe('AuditoriaPage — HU-42/HU-50: resultado real, seguridad y exportación del servidor', () => {
  beforeEach(() => useAuditoria.mockReset())

  it('los KPI cuentan fallidas, denegadas y bloqueos por el resultado del backend', () => {
    useAuditoria.mockReturnValue({
      registros: [
        registro({ id: 'a-1', accion: 'LOGIN_FALLIDO', resultado: 'fallido' }),
        registro({ id: 'a-2', accion: 'RBAC_DENEGADO', resultado: 'denegado' }),
        registro({ id: 'a-3', accion: 'SESION_RECHAZADA', resultado: 'denegado' }),
        registro({ id: 'a-4', accion: 'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO', resultado: 'bloqueado', usuario_id: null }),
        registro({ id: 'a-5', accion: 'LOGIN_EXITOSO', resultado: 'exitoso' }),
      ],
      cargando: false,
    })
    render(<AuditoriaPage />)
    const tira = screen.getByRole('region', { name: /resumen de la bitácora/i })
    expect(tira).toHaveTextContent(/fallidas\s*1/i)
    expect(tira).toHaveTextContent(/denegadas\s*2/i)
    expect(tira).toHaveTextContent(/bloqueos temporales\s*1/i)
    expect(screen.getByText(/1 bloqueo temporal de acceso registrado/i)).toBeInTheDocument()
    // El resultado se rotula traducido, no con el código crudo.
    const tabla = within(screen.getByRole('region', { name: /bitácora de auditoría/i }))
    expect(tabla.getAllByText('Denegado')).toHaveLength(2)
    expect(tabla.getByText('Límite de intentos superado')).toBeInTheDocument()
    expect(tabla.getByText('Sesión rechazada')).toBeInTheDocument()
  })

  it('«Exportar CSV» pide la exportación al servidor con los filtros aplicados', async () => {
    const exportar = vi.fn().mockResolvedValue('ok')
    const consultar = vi.fn()
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar, exportar, exportando: false })
    render(<AuditoriaPage />)
    await userEvent.selectOptions(screen.getByLabelText(/^resultado$/i), 'bloqueado')
    await userEvent.click(screen.getByRole('button', { name: /exportar csv/i }))
    expect(exportar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'bloqueado' }))
    expect(screen.getByRole('button', { name: /exportar csv/i })).toHaveAccessibleDescription(/hasta 10 000 filas/i)
  })

  it('avisa del límite de exportaciones por minuto (429)', async () => {
    const exportar = vi.fn().mockResolvedValue('cuota')
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false, consultar: vi.fn(), exportar, exportando: false })
    render(<AuditoriaPage />)
    await userEvent.click(screen.getByRole('button', { name: /exportar csv/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/límite de exportaciones por minuto/i)
  })

  it('un usuario que no es UUID (422) explica qué corregir', () => {
    useAuditoria.mockReturnValue({ registros: [], cargando: false, errorCarga: true, motivoError: 'validacion', consultar: vi.fn() })
    render(<AuditoriaPage />)
    expect(screen.getByRole('alert')).toHaveTextContent(/identificador completo \(UUID\)/i)
  })

  it('sugiere los códigos de seguridad en el filtro de acción', () => {
    useAuditoria.mockReturnValue({ registros: [registro()], cargando: false })
    render(<AuditoriaPage />)
    const codigos = [...document.querySelectorAll('#fa-accion-codigos option')].map((o) => (o as HTMLOptionElement).value)
    expect(codigos).toEqual(expect.arrayContaining(['LOGIN_FALLIDO', 'RBAC_DENEGADO', 'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO', 'ALERTA_REVISADA']))
    expect(codigos).not.toContain('BLOQUEO_TEMPORAL')
  })
})
