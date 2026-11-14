import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import i18n from '@/infrastructure/i18n'
import { AppLayout } from '@/presentation/layouts/AppLayout'

vi.mock('@/application/hooks/useEstadoVivo', () => ({ useFuenteEstadoVivo: () => {} }))

function Rompe(): never {
  throw new Error('fallo de render')
}

function montar(ruta = '/dashboard') {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: 'farmaceutico@upc.pe', rol: 'farmaceutico', expiraEn: Date.now() + 3600_000 },
    autenticado: true,
  })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<h1>Monitoreo</h1>} />
          <Route path="/alertas" element={<h1>Alertas</h1>} />
          <Route path="/historial" element={<Rompe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('es')
})
afterEach(() => useEstadoVivoStore.getState().reiniciar())

describe('AppLayout (shell)', () => {
  it('el enlace Alertas anuncia las alertas sin atender y las críticas', () => {
    useEstadoVivoStore.setState({ alertas: { total: 2, criticas: 1, truncado: false, recientes: [] } })
    montar()
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    const alertas = Array.from(nav.querySelectorAll('a')).find((a) => a.getAttribute('href') === '/alertas')!
    expect(alertas).toHaveAccessibleName('Alertas, 2 alertas sin atender, 1 crítica')
  })

  it('sin alertas el enlace se llama solo «Alertas»', () => {
    useEstadoVivoStore.setState({ alertas: { total: 0, criticas: 0, truncado: false, recientes: [] } })
    montar()
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(Array.from(nav.querySelectorAll('a')).find((a) => a.getAttribute('href') === '/alertas')).toHaveAccessibleName('Alertas')
  })

  it('cambiar de ruta actualiza document.title', async () => {
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(document.title).toBe('Monitoreo · ColdCare'))
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    await usuario.click(Array.from(nav.querySelectorAll('a')).find((a) => a.getAttribute('href') === '/alertas')!)
    await waitFor(() => expect(document.title).toBe('Alertas · ColdCare'))
    // Navegar desde el menú lleva el foco al contenido.
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('hay un único aviso de datos simulados y ninguna franja duplicada', () => {
    montar()
    expect(screen.queryAllByText('Datos simulados').length).toBeLessThanOrEqual(1)
  })

  it('una sección que falla muestra el error sin perder la navegación', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    montar('/historial')
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar esta sección.')
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Estado en vivo/ })).toBeInTheDocument()
  })

  it('en jsdom (sin riel) el menú de usuario vive en la cabecera, una sola vez', () => {
    montar()
    expect(screen.getAllByRole('button', { name: /^Menú de usuario/ })).toHaveLength(1)
  })
})
