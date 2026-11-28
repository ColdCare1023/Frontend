import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAlertasPendientes } from '@/application/hooks/useAlertasPendientes'
import { useAuthStore } from '@/application/stores/authStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { Rol } from '@/domain/value-objects/Rol'
import { BandejaAlertasOperativa } from '@/presentation/pages/dashboard/BandejaAlertasOperativa'
import { instalarAdaptadorFalso } from '@/tests/ayudas'

vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseTiempoReal: () => () => {} }))

function alerta(id: string): AlertaTermica {
  return {
    id, reading_id: 'l-1', device_id: id, nivel_riesgo: 'excursion_critica', mensaje: 'Temperatura fuera de rango.',
    estado: 'pendiente', created_at: '2026-11-01T12:00:00Z', temperatura_pico: 9.7,
    revisada: false, revisada_por: null, reconocida_en: null, atendida_en: null,
  }
}

const nombres = new Map([['EQ-1', 'Nevera principal']])
function Vista() {
  return <BandejaAlertasOperativa bandeja={useAlertasPendientes()} nombres={nombres} />
}

describe('Atención de alertas en la pantalla de monitoreo', () => {
  let filas: AlertaTermica[]
  let fallaListado: boolean
  let estadoAlGuardar: number
  let estadoAlReconocer: number
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  function montar(rol: Rol = 'farmaceutico') {
    useAuthStore.setState({ usuario: { id: 'qa', email: 'qa@example.test', rol, expiraEn: Date.now() + 60_000 }, autenticado: true })
    render(<MemoryRouter><Vista /></MemoryRouter>)
    return userEvent.setup()
  }

  beforeEach(() => {
    filas = [alerta('EQ-1')]
    fallaListado = false
    estadoAlGuardar = 201
    estadoAlReconocer = 200
    adaptador = instalarAdaptadorFalso((req) => {
      if (req.method === 'get' && req.url === '/api/alertas') {
        return fallaListado ? { status: 503 } : { data: filas.filter((a) => a.estado === req.params.estado) }
      }
      if (req.method === 'patch' && req.url === '/api/alertas/EQ-1/revisar') {
        if (estadoAlReconocer === 200) filas[0] = { ...filas[0], estado: 'reconocida', revisada: true }
        return { status: estadoAlReconocer }
      }
      if (req.method === 'post' && req.url === '/api/alertas/EQ-1/acciones-correctivas') {
        if (estadoAlGuardar === 201) filas[0] = { ...filas[0], estado: 'atendida' }
        return { status: estadoAlGuardar }
      }
      return { data: [] }
    })
  })
  afterEach(() => adaptador.restaurar())

  it('abre una sola alerta, recuerda el borrador al cerrar y devuelve el foco al botón', async () => {
    const user = montar()
    const abrir = await screen.findByRole('button', { name: /Atender.*Nevera principal/ })
    await user.click(abrir)
    const dialogo = await screen.findByRole('dialog')
    const decision = within(dialogo).getByRole('textbox', { name: /decisión adoptada/i })
    await user.type(decision, 'Trasladar')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(abrir).toHaveFocus())
    await user.click(abrir)
    expect(within(await screen.findByRole('dialog')).getByRole('textbox', { name: /decisión adoptada/i })).toHaveValue('Trasladar')
  })

  it('reconoce, conserva la alerta abierta en la bandeja y registra su acción sin cambiar de ruta', async () => {
    const user = montar()
    await user.click(await screen.findByRole('button', { name: /Atender.*Nevera principal/ }))
    const dialogo = within(await screen.findByRole('dialog'))
    await user.click(dialogo.getByRole('button', { name: 'Reconocer' }))
    expect(await dialogo.findByText('Reconocida')).toBeVisible()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await user.type(dialogo.getByRole('textbox', { name: /decisión/i }), 'Trasladar')
    await user.type(dialogo.getByRole('textbox', { name: /acción realizada/i }), 'Traslado al equipo de reserva')
    await user.type(dialogo.getByRole('textbox', { name: /justificación/i }), 'Temperatura fuera de rango')
    await user.click(dialogo.getByRole('button', { name: 'Guardar acción' }))
    expect(await dialogo.findByText(/acción correctiva registrada/i)).toBeVisible()
    expect(dialogo.queryByRole('link')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alertas pendientes' })).toHaveFocus())
    expect(screen.getByText('No hay alertas sin atender.')).toBeVisible()
  })

  it.each(['tecnico', 'auditor'] as const)('el rol %s consulta la cronología sin acciones de escritura ni salida del tablero', async (rol) => {
    const user = montar(rol)
    await user.click(await screen.findByRole('button', { name: /Ver detalle.*Nevera principal/ }))
    const dialogo = within(await screen.findByRole('dialog'))
    expect(await dialogo.findByText('Cronología de atención')).toBeVisible()
    expect(dialogo.queryByRole('button', { name: /reconocer|guardar acción/i })).not.toBeInTheDocument()
    expect(dialogo.queryByRole('link')).not.toBeInTheDocument()
  })

  it('permite reintentar la carga y conserva los campos si el permiso cambia o falla el servidor', async () => {
    fallaListado = true
    const user = montar('administrador')
    expect(await screen.findByRole('alert')).toHaveTextContent(/alertas/i)
    fallaListado = false
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
    await user.click(await screen.findByRole('button', { name: /Atender.*Nevera principal/ }))
    const dialogo = within(await screen.findByRole('dialog'))
    estadoAlReconocer = 403
    await user.click(dialogo.getByRole('button', { name: 'Reconocer' }))
    expect(await dialogo.findByRole('alert')).toHaveTextContent(/farmacéutico/i)
    estadoAlGuardar = 503
    await user.type(dialogo.getByRole('textbox', { name: /decisión/i }), 'Traslado')
    await user.type(dialogo.getByRole('textbox', { name: /acción realizada/i }), 'A reserva')
    await user.type(dialogo.getByRole('textbox', { name: /justificación/i }), 'Excursión')
    await user.click(dialogo.getByRole('button', { name: 'Guardar acción' }))
    expect(await dialogo.findByText(/tu texto se conserva/i)).toBeVisible()
    expect(dialogo.getByRole('textbox', { name: /decisión/i })).toHaveValue('Traslado')
  })

  it('presenta tres alertas y revela las restantes en la misma pantalla', async () => {
    filas = [1, 2, 3, 4].map((n) => alerta(`EQ-${n}`))
    const user = montar()
    const mas = await screen.findByText('Otras alertas (1)')
    expect(screen.queryByRole('button', { name: /Atender.*EQ-4/ })).not.toBeInTheDocument()
    await user.click(mas)
    expect(screen.getByRole('button', { name: /Atender.*EQ-4/ })).toBeVisible()
  })
})
