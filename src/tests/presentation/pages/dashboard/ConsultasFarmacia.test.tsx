import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { ConsultasFarmacia } from '@/presentation/pages/dashboard/ConsultasFarmacia'
import type { Rol } from '@/domain/value-objects/Rol'

vi.mock('@/presentation/pages/HistorialPage', () => ({
  HistorialPage: ({ equipoId }: { equipoId?: string }) => <><p>Lecturas de {equipoId}</p><input aria-label="Filtro de prueba" /></>,
}))
vi.mock('@/presentation/pages/ReportesPage', () => ({
  ReportesPage: ({ equipoId }: { equipoId?: string }) => <p>PDF de {equipoId}</p>,
}))

vi.mock('@/application/hooks/useClasificacionPreventiva', () => ({
  useClasificacionPreventiva: () => ({ clasificacion: null, operativa: false }),
}))
vi.mock('@/presentation/pages/AlertasPage', () => ({ AlertasPage: () => <p>Registro de alertas de prueba</p> }))
vi.mock('@/presentation/pages/TrazabilidadPage', () => ({ TrazabilidadPage: () => <p>Cadena de prueba</p> }))

function ProbeRuta() {
  return <output data-testid="ubicacion">{useLocation().pathname}</output>
}

function montar(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'qa', email: 'qa@example.test', expiraEn: Date.now() + 60_000, rol } })
  return render(<MemoryRouter initialEntries={['/dashboard']}><ProbeRuta /><div id="equipo-monitoreado" tabIndex={-1}>Equipo</div><div id="alertas-monitoreo" tabIndex={-1}>Bandeja</div><ConsultasFarmacia equipoId="FRIO-1" /></MemoryRouter>)
}
afterEach(() => useAuthStore.setState({ usuario: null }))

describe('Consultas en el tablero', () => {
  it('mantiene el equipo y la ruta al cambiar entre lecturas y PDF y devuelve el foco al cerrar', async () => {
    const usuario = userEvent.setup()
    montar('farmaceutico')
    const abrir = screen.getByRole('button', { name: 'Historial y reportes' })
    await usuario.click(abrir)
    const dialogo = within(await screen.findByRole('dialog', { name: 'Historial y reportes' }))
    expect(await dialogo.findByText('Lecturas de FRIO-1')).toBeVisible()
    await usuario.type(dialogo.getByRole('textbox', { name: 'Filtro de prueba' }), 'intervalo')
    await usuario.click(dialogo.getByRole('button', { name: 'Reportes' }))
    expect(await dialogo.findByText('PDF de FRIO-1')).toBeVisible()
    await usuario.click(dialogo.getByRole('button', { name: 'Historial' }))
    expect(dialogo.getByRole('textbox', { name: 'Filtro de prueba' })).toHaveValue('intervalo')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/dashboard')
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(abrir).toHaveFocus()
  })

  it.each([
    [/Atiende una alerta/, 'alertas-monitoreo'],
    [/Revisa el equipo/, 'equipo-monitoreado'],
  ] as const)('la guía vuelve al punto de trabajo de Monitoreo y le entrega el foco', async (nombre, id) => {
    const user = userEvent.setup()
    montar('farmaceutico')
    await user.click(screen.getByRole('button', { name: 'Historial y reportes' }))
    await user.click(screen.getByRole('button', { name: 'Guía de uso' }))
    await user.click(await screen.findByRole('button', { name: nombre }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(document.getElementById(id)).toHaveFocus())
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/dashboard')
  })

  it.each([
    [/Historial Busca/, 'Lecturas de FRIO-1'],
    [/Reportes de monitoreo/, 'PDF de FRIO-1'],
    [/Integridad de registros/, 'Cadena de prueba'],
    [/Alertas Revisa/, 'Registro de alertas de prueba'],
  ] as const)('el índice de la guía abre la consulta sin abandonar el equipo', async (nombre, resultado) => {
    const user = userEvent.setup()
    montar('farmaceutico')
    await user.click(screen.getByRole('button', { name: 'Historial y reportes' }))
    await user.click(screen.getByRole('button', { name: 'Guía de uso' }))
    await user.click(await screen.findByRole('tab', { name: /Encontrar una pantalla/ }))
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: nombre }))
    const destino = await screen.findByText(resultado)
    expect(destino).toBeVisible()
    expect(destino.closest('section')).toHaveFocus()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/dashboard')
  })

  it('el técnico consulta lecturas, alertas, integridad y guía sin recibir una opción de reportes o de IA', async () => {
    montar('tecnico')
    await userEvent.click(screen.getByRole('button', { name: 'Historial y reportes' }))
    const grupo = within(screen.getByRole('group', { name: 'Elegir consulta' }))
    expect(grupo.getAllByRole('button')).toHaveLength(4)
    expect(grupo.queryByRole('button', { name: 'Reportes' })).toBeNull()
    expect(grupo.queryByRole('button', { name: /clasificación/i })).toBeNull()
    await userEvent.click(grupo.getByRole('button', { name: 'Guía de uso' }))
    expect(await screen.findByText(/Abre Alertas para revisar/)).toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: /Encontrar una pantalla/ }))
    const indice = within(screen.getByRole('tabpanel'))
    expect(indice.queryByRole('button', { name: /Reportes|clasificador/i })).toBeNull()
    expect(indice.getByRole('button', { name: /Integridad de registros/ })).toBeVisible()
  })
})
