import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

/**
 * FE-002: en modo demo, toda pantalla autenticada avisa que los datos son
 * simulados (también en móvil, donde la insignia de la cabecera se oculta).
 */
async function montarLayout(modoDemo: boolean) {
  vi.resetModules()
  vi.doMock('@/infrastructure/demo/modoDemo', () => ({ MODO_DEMO: modoDemo }))
  // Mismo registro de módulos que el layout: store e i18n se importan después
  // de reiniciarlo.
  const { default: i18n } = await import('@/infrastructure/i18n')
  const { useAuthStore } = await import('@/application/stores/authStore')
  const { AppLayout } = await import('@/presentation/layouts/AppLayout')
  await i18n.changeLanguage('es')
  useAuthStore.setState({
    usuario: { id: 'u-1', email: 'farmaceutico@upc.pe', rol: 'farmaceutico', expiraEn: Date.now() + 3600_000 },
    autenticado: true,
  })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>,
  )
}

// Cada prueba reimporta el layout completo (vi.resetModules) para cambiar
// MODO_DEMO; con toda la suite en paralelo eso supera los 5 s por defecto.
const REIMPORTA_LAYOUT = { timeout: 20_000 }

describe('Aviso de datos simulados', () => {
  it('se muestra en modo demo', REIMPORTA_LAYOUT, async () => {
    await montarLayout(true)
    expect(screen.getByText(/Datos simulados/).closest('[role="status"]')).not.toBeNull()
  })

  it('no aparece con datos reales', REIMPORTA_LAYOUT, async () => {
    await montarLayout(false)
    expect(screen.queryByText(/Datos simulados/)).toBeNull()
  })
})
