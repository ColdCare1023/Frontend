import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { getAccessToken, setAccessToken } from '@/infrastructure/api/apiClient'
import { RequireAuth, RequirePasswordPropia } from '@/presentation/components/RouteGuards'
import { CambiarPasswordPage } from '@/presentation/pages/CambiarPasswordPage'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { RecuperarContrasenaPage } from '@/presentation/pages/RecuperarContrasenaPage'
import { RestablecerContrasenaPage } from '@/presentation/pages/RestablecerContrasenaPage'
import { instalarAdaptadorFalso, tokenDe } from '../../ayudas'

/**
 * FE-004: recuperación, restablecimiento y cambio de contraseña contra el
 * backend real (BE-025). Sin tokens fijos, sin "envíos" simulados.
 */
function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
        <Route path="/restablecer-password" element={<RestablecerContrasenaPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route element={<RequirePasswordPropia />}>
            <Route path="/dashboard" element={<p>panel de control</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

let adaptador: ReturnType<typeof instalarAdaptadorFalso>

beforeEach(() => {
  setAccessToken(null)
  useAuthStore.setState({ usuario: null, autenticado: false, requiereCambioPassword: false })
})

afterEach(() => {
  adaptador?.restaurar()
  window.history.replaceState(null, '', '/')
})

describe('Recuperar contraseña', () => {
  it('envía la solicitud al backend y confirma sin revelar si la cuenta existe', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 202, data: { detail: 'ok' } }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena')

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'farma@upc.pe')
    await user.click(screen.getByRole('button', { name: /Enviar instrucciones/i }))

    expect(await screen.findByText(/Instrucciones enviadas/)).toBeInTheDocument()
    expect(adaptador.ultima().url).toBe('/api/auth/recuperar-password')
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({ email: 'farma@upc.pe' })
  })

  it('sin SMTP en el servidor remite al administrador', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 503, data: {} }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena')

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'farma@upc.pe')
    await user.click(screen.getByRole('button', { name: /Enviar instrucciones/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/administrador/)
  })
})

describe('Restablecer contraseña con enlace', () => {
  it('sin token no hay formulario ni valor por defecto', () => {
    adaptador = instalarAdaptadorFalso()
    window.history.replaceState(null, '', '/restablecer-password')
    montar('/restablecer-password')

    expect(screen.getByRole('alert')).toHaveTextContent(/no es válido o ha expirado/)
    expect(screen.queryByLabelText('Nueva contraseña')).toBeNull()
  })

  it('lee el token del fragmento, lo borra de la URL y lo envía con la contraseña nueva', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 204, data: null }))
    window.history.replaceState(null, '', '/restablecer-password#token=enlace-de-un-solo-uso-0123')
    const user = userEvent.setup()
    montar('/restablecer-password')

    expect(window.location.hash).toBe('')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'corta1')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'corta1')
    await user.click(screen.getByRole('button', { name: /Actualizar contraseña/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 10 caracteres/)
    expect(adaptador.peticiones).toHaveLength(0)

    await user.clear(screen.getByLabelText('Nueva contraseña'))
    await user.clear(screen.getByLabelText('Confirmar contraseña'))
    await user.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave2026')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave2026')
    await user.click(screen.getByRole('button', { name: /Actualizar contraseña/ }))

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(adaptador.ultima().url).toBe('/api/auth/restablecer-password')
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({
      token: 'enlace-de-un-solo-uso-0123',
      password_nueva: 'NuevaClave2026',
    })
  })

  it('un enlace usado o caducado lleva a pedir uno nuevo', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 400, data: { detail: 'caducado' } }))
    window.history.replaceState(null, '', '/restablecer-password#token=enlace-caducado-0123456')
    const user = userEvent.setup()
    montar('/restablecer-password')

    await user.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave2026')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave2026')
    await user.click(screen.getByRole('button', { name: /Actualizar contraseña/ }))

    expect(await screen.findByRole('link', { name: /Solicitar nuevo enlace/ })).toBeInTheDocument()
  })
})

describe('Contraseña temporal', () => {
  it('tras el login obliga a cambiarla y no deja entrar al panel', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: tokenDe('tecnico'), token_type: 'bearer', require_password_change: true },
    }))
    const user = userEvent.setup()
    montar('/login')

    await user.type(screen.getByLabelText('Correo electrónico'), 'tecnico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Temporal-1234')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText(/Tu contraseña es temporal/)).toBeInTheDocument()
    expect(useAuthStore.getState().requiereCambioPassword).toBe(true)
  })

  it('el panel redirige al cambio mientras la contraseña sea temporal', () => {
    adaptador = instalarAdaptadorFalso()
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'tecnico@upc.pe', rol: 'tecnico', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
      requiereCambioPassword: true,
    })
    montar('/dashboard')

    expect(screen.queryByText('panel de control')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
  })

  it('al cambiarla instala el token nuevo del backend y entra al panel', async () => {
    const nuevo = tokenDe('tecnico', 'tecnico@upc.pe')
    adaptador = instalarAdaptadorFalso(() => ({ data: { access_token: nuevo, token_type: 'bearer' } }))
    setAccessToken('token-anterior')
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'tecnico@upc.pe', rol: 'tecnico', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
      requiereCambioPassword: true,
    })
    const user = userEvent.setup()
    montar('/cambiar-password')

    await user.type(screen.getByLabelText('Contraseña actual'), 'Temporal-1234')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'PropiaClave2026')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'PropiaClave2026')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('panel de control')).toBeInTheDocument()
    expect(adaptador.ultima().url).toBe('/api/auth/cambiar-password')
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({
      password_actual: 'Temporal-1234',
      password_nueva: 'PropiaClave2026',
    })
    await waitFor(() => expect(getAccessToken()).toBe(nuevo))
    expect(useAuthStore.getState().requiereCambioPassword).toBe(false)
  })

  it('una contraseña actual incorrecta no cambia nada', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 400, data: { detail: 'La contraseña actual no es correcta' } }))
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'tecnico@upc.pe', rol: 'tecnico', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
      requiereCambioPassword: true,
    })
    const user = userEvent.setup()
    montar('/cambiar-password')

    await user.type(screen.getByLabelText('Contraseña actual'), 'equivocada1')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'PropiaClave2026')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'PropiaClave2026')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.')
    expect(useAuthStore.getState().requiereCambioPassword).toBe(true)
  })
})
