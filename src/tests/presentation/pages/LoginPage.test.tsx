import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { setAccessToken } from '@/infrastructure/api/apiClient'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { instalarAdaptadorFalso, tokenDe } from '../../ayudas'

const TOKEN = tokenDe('farmaceutico')

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

describe('LoginPage', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    setAccessToken(null)
    useAuthStore.setState({ usuario: null, autenticado: false, requierePrivacidad: false })
  })

  afterEach(() => {
    adaptador?.restaurar()
  })

  it('renderiza el formulario con sus campos etiquetados', () => {
    adaptador = instalarAdaptadorFalso()

    montar()

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('el campo de contraseña no expone el valor en claro', () => {
    adaptador = instalarAdaptadorFalso()

    montar()

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('valida campos vacíos sin llamar al servidor y enfoca el primer campo', async () => {
    adaptador = instalarAdaptadorFalso()
    const usuario = userEvent.setup()

    montar()
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    const email = screen.getByLabelText('Correo electrónico')
    expect(email).toHaveFocus()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(screen.queryByText('panel de control')).not.toBeInTheDocument()
  })

  it('valida formato de correo y vincula el mensaje con el campo', async () => {
    adaptador = instalarAdaptadorFalso()
    const usuario = userEvent.setup()

    montar()
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'correo-invalido')
    await usuario.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    const email = screen.getByLabelText('Correo electrónico')
    expect(email).toHaveFocus()
    expect(email).toHaveAttribute('aria-describedby', 'email-error')
    expect(screen.getByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
  })

  it('con credenciales válidas autentica y navega al panel', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: TOKEN, token_type: 'bearer', require_privacy_consent: false },
    }))
    const usuario = userEvent.setup()

    montar()
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await usuario.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('panel de control')).toBeInTheDocument()
    expect(useAuthStore.getState().autenticado).toBe(true)
  })

  it('con credenciales incorrectas muestra el error y no navega', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: { detail: 'no' } }))
    const usuario = userEvent.setup()

    montar()
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await usuario.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.queryByText('panel de control')).not.toBeInTheDocument()
  })

  it('distingue el bloqueo por intentos (429) de un fallo de credenciales', async () => {
    // El backend limita el login a 5 intentos por IP cada 5 min. Mostrar
    // "credenciales incorrectas" haría que el usuario siguiera reintentando y
    // extendiera su propio bloqueo.
    adaptador = instalarAdaptadorFalso(() => ({ status: 429, data: { detail: 'demasiados' } }))
    const usuario = userEvent.setup()

    montar()
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await usuario.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).not.toHaveTextContent('Correo o contraseña incorrectos.')
  })

  it('avisa de la sesión expirada al volver al login', async () => {
    // El JWT vive solo en memoria: el usuario debe entender por qué volvió aquí
    // en vez de creer que el sistema lo expulsó sin motivo.
    adaptador = instalarAdaptadorFalso()
    sessionStorage.setItem('cf_aviso_login', 'expirada')

    montar()

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
  })

  it('no hay atajos de acceso demo fuera del build de demostración', () => {
    adaptador = instalarAdaptadorFalso()

    montar()

    expect(screen.queryByText(/acceso rápido/i)).not.toBeInTheDocument()
  })
})
