import { render, screen, within } from '@testing-library/react'
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

function ProbeRuta() {
  return <output data-testid="ubicacion">{useLocation().pathname}</output>
}

function montar(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'qa', email: 'qa@example.test', expiraEn: Date.now() + 60_000, rol } })
  return render(<MemoryRouter initialEntries={['/dashboard']}><ProbeRuta /><ConsultasFarmacia equipoId="FRIO-1" /></MemoryRouter>)
}
afterEach(() => useAuthStore.setState({ usuario: null }))

describe('Consultas en el tablero', () => {
  it('mantiene el equipo y la ruta al cambiar entre lecturas y PDF y devuelve el foco al cerrar', async () => {
    const usuario = userEvent.setup()
    montar('farmaceutico')
    const abrir = screen.getByRole('button', { name: 'Consultas' })
    await usuario.click(abrir)
    const dialogo = within(await screen.findByRole('dialog', { name: 'Consultas' }))
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

  it('el técnico consulta lecturas, alertas, integridad y guía sin recibir una opción de reportes o de IA', async () => {
    montar('tecnico')
    await userEvent.click(screen.getByRole('button', { name: 'Consultas' }))
    const grupo = within(screen.getByRole('group', { name: 'Elegir consulta' }))
    expect(grupo.getAllByRole('button')).toHaveLength(4)
    expect(grupo.queryByRole('button', { name: 'Reportes' })).toBeNull()
    expect(grupo.queryByRole('button', { name: /clasificación/i })).toBeNull()
  })
})
