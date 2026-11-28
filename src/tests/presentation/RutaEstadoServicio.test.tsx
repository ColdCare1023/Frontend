import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import { setAccessToken } from '@/infrastructure/api/apiClient'
import i18n from '@/infrastructure/i18n'
import { App } from '@/App'
import { instalarAdaptadorFalso, tokenDe } from '../ayudas'

/**
 * /estado-servicio vive en el bloque `RequireRoles roles={[]}` de App.tsx,
 * como /usuarios y /dispositivos: el backend exige ADMINISTRADOR en
 * GET /health/detalle. Un QF o un auditor no ve la página ni el enlace, y la
 * pantalla ni siquiera pide los datos.
 */
let adaptador: ReturnType<typeof instalarAdaptadorFalso>

function abrirComo(rol: Rol) {
  adaptador = instalarAdaptadorFalso((config) =>
    config.url === '/health/detalle' ? { data: { status: 'ok', db: 'ok', timestamp: '2026-11-15T15:30:00+00:00' } } : { data: [] },
  )
  setAccessToken(tokenDe(rol))
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
    requiereCambioPassword: false,
    requierePrivacidad: false,
  })
  window.history.replaceState(null, '', '/estado-servicio')
  render(<App />)
}

const enlacesAEstado = () => screen.queryAllByRole('link').filter((a) => a.getAttribute('href') === '/estado-servicio')

beforeEach(async () => {
  await i18n.changeLanguage('es')
})
afterEach(() => {
  adaptador?.restaurar()
  setAccessToken(null)
  useAuthStore.setState({ usuario: null, autenticado: false })
})

describe('ruta /estado-servicio (solo administrador)', () => {
  it('el administrador la abre desde el menú y la página consulta /health/detalle', async () => {
    abrirComo('administrador')
    expect(await screen.findByRole('heading', { level: 1, name: 'Estado del servicio' }, { timeout: 15_000 })).toBeInTheDocument()
    // El adaptador solo informa de la base de datos. El resto de componentes queda por revisar.
    expect(await screen.findByRole('heading', { name: 'Hay componentes que revisar' }, { timeout: 15_000 })).toBeInTheDocument()
    expect(adaptador.peticiones.some((p) => p.url === '/health/detalle')).toBe(true)
    expect(enlacesAEstado().length).toBeGreaterThan(0)
  }, 30_000)

  it.each(['farmaceutico', 'auditor', 'tecnico'] as const)('%s ve «sin permiso», sin enlace y sin pedir los datos', async (rol) => {
    abrirComo(rol)
    expect(await screen.findByText('No tienes permiso para ver esta sección.', undefined, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Estado del servicio' })).not.toBeInTheDocument()
    expect(enlacesAEstado()).toHaveLength(0)
    expect(adaptador.peticiones.some((p) => p.url === '/health/detalle')).toBe(false)
  }, 30_000)
})
