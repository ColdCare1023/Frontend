import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * FE-001: el acceso con Google solo abre sesión con el JWT que devuelve el
 * backend tras verificar el ID token. No hay Facebook ni tokens fabricados
 * en el cliente.
 */
const google = vi.hoisted(() => ({
  habilitado: true,
  callback: null as ((idToken: string) => void) | null,
}))

vi.mock('@/infrastructure/auth/googleIdentity', () => ({
  get GOOGLE_HABILITADO() {
    return google.habilitado
  },
  montarBotonGoogle: vi.fn(async (_contenedor: HTMLElement, alRecibirToken: (idToken: string) => void) => {
    google.callback = alRecibirToken
  }),
}))

import { useAuthStore } from '@/application/stores/authStore'
import { setAccessToken } from '@/infrastructure/api/apiClient'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { instalarAdaptadorFalso, tokenDe } from '../ayudas'

function montar() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<p>panel de control</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Acceso con Google', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    google.habilitado = true
    google.callback = null
    setAccessToken(null)
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  afterEach(() => adaptador?.restaurar())

  it('canjea el ID token en el backend y abre la sesión que este emite', async () => {
    const token = tokenDe('farmaceutico', 'farma@upc.pe')
    adaptador = instalarAdaptadorFalso(() => ({ data: { access_token: token, token_type: 'bearer' } }))
    montar()
    await waitFor(() => expect(google.callback).not.toBeNull())

    google.callback?.('id-token-de-google')

    expect(await screen.findByText('panel de control')).toBeInTheDocument()
    expect(adaptador.peticiones).toHaveLength(1)
    expect(adaptador.peticiones[0].url).toBe('/api/auth/google')
    expect(JSON.parse(adaptador.peticiones[0].data as string)).toEqual({ id_token: 'id-token-de-google' })
    expect(useAuthStore.getState().usuario?.email).toBe('farma@upc.pe')
  })

  it('una cuenta no dada de alta no abre sesión', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: { detail: 'no autorizado' } }))
    montar()
    await waitFor(() => expect(google.callback).not.toBeNull())

    google.callback?.('id-token-ajeno')

    expect(await screen.findByRole('alert')).toHaveTextContent('no tiene acceso a ColdCare')
    expect(useAuthStore.getState().autenticado).toBe(false)
  })

  it('sin client ID no se ofrece Google ni ningún otro proveedor', () => {
    google.habilitado = false
    adaptador = instalarAdaptadorFalso()
    montar()
    expect(screen.queryByTestId('boton-google')).toBeNull()
    expect(screen.queryByRole('button', { name: /Google|Facebook/i })).toBeNull()
  })

  it('el store ya no permite instalar un token arbitrario', () => {
    expect('loginConToken' in useAuthStore.getState()).toBe(false)
  })
})
