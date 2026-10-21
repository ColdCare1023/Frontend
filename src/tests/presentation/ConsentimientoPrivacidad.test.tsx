import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { apiClient, getAccessToken, setAccessToken, setOnPrivacidadRequerida } from '@/infrastructure/api/apiClient'
import { App } from '@/App'
import { instalarAdaptadorFalso, tokenDe } from '../ayudas'

/**
 * FE-005 / HU-44: el backend (BE-014) no presume el consentimiento. El
 * cliente debe pedirlo de forma bloqueante y registrar la decisión.
 */
const SESION = { id: 'u-1', email: 'tecnico@upc.pe', rol: 'tecnico' as const, expiraEn: Date.now() + 3600_000 }

let adaptador: ReturnType<typeof instalarAdaptadorFalso>

beforeEach(() => {
  window.history.replaceState(null, '', '/login')
  setAccessToken(null)
  useAuthStore.setState({ usuario: null, autenticado: false, requiereCambioPassword: false, requierePrivacidad: false })
})

afterEach(() => adaptador?.restaurar())

describe('Consentimiento de privacidad', () => {
  it('el login que lo exige abre un aviso que no se puede descartar', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: tokenDe('tecnico'), token_type: 'bearer', require_privacy_consent: true },
    }))
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Correo electrónico'), 'tecnico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Aviso de privacidad' })
    await user.keyboard('{Escape}')
    expect(dialogo).toBeInTheDocument()
    expect(useAuthStore.getState().requierePrivacidad).toBe(true)
  })

  it('aceptar lo registra en el backend y cierra el aviso', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: { privacy_accepted: true, privacy_version_accepted: '1.0' } }))
    setAccessToken(tokenDe('tecnico'))
    useAuthStore.setState({ usuario: SESION, autenticado: true, requierePrivacidad: true })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Acepto' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Aviso de privacidad' })).toBeNull())
    expect(adaptador.peticiones.some((p) => p.url === '/api/auth/privacidad/aceptar')).toBe(true)
    expect(useAuthStore.getState().requierePrivacidad).toBe(false)
  })

  it('rechazar revoca la sesión en el servidor y la cierra en el cliente', async () => {
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/auth/privacidad/rechazar' ? { status: 401, data: {} } : { data: [] },
    )
    const token = tokenDe('tecnico')
    setAccessToken(token)
    useAuthStore.setState({ usuario: SESION, autenticado: true, requierePrivacidad: true })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))

    await waitFor(() => expect(useAuthStore.getState().autenticado).toBe(false))
    const rechazo = adaptador.peticiones.find((p) => p.url === '/api/auth/privacidad/rechazar')
    expect(rechazo?.headers.Authorization).toBe(`Bearer ${token}`)
    expect(getAccessToken()).toBeNull()
  })

  it('con una contraseña temporal pendiente, primero se cambia la contraseña', async () => {
    adaptador = instalarAdaptadorFalso()
    setAccessToken(tokenDe('tecnico'))
    useAuthStore.setState({ usuario: SESION, autenticado: true, requierePrivacidad: true, requiereCambioPassword: true })
    window.history.replaceState(null, '', '/dashboard')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Aviso de privacidad' })).toBeNull()
  })

  it('un 403 por consentimiento a mitad de sesión vuelve a pedirlo', async () => {
    const manejador = vi.fn()
    setOnPrivacidadRequerida(manejador)
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/alertas'
        ? { status: 403, data: { detail: 'Debe aceptar la política de privacidad y consentimiento para acceder a este recurso' } }
        : { status: 403, data: { detail: 'Permisos insuficientes' } },
    )

    await apiClient.get('/api/usuarios').catch(() => undefined)
    expect(manejador).not.toHaveBeenCalled()
    await apiClient.get('/api/alertas').catch(() => undefined)
    expect(manejador).toHaveBeenCalledTimes(1)
  })
})
