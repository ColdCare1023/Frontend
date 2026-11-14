import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosRequestConfig } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { getAccessToken, setAccessToken } from '@/infrastructure/api/apiClient'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { esperarAviso, instalarAdaptadorFalso, tokenDe } from '../../ayudas'

/**
 * Login con segundo factor (OTP_LOGIN_ENABLED=true): contrato de
 * auth_router.py (/login, /login/verificar, /login/reenviar).
 */
const DESAFIO = 'desafio-opaco-de-prueba-0123456789'
const TOKEN = tokenDe('farmaceutico')

const respuestaDesafio = {
  access_token: null,
  token_type: 'bearer',
  require_privacy_consent: false,
  require_password_change: false,
  requiere_codigo: true,
  desafio: DESAFIO,
  email_enmascarado: 'f***@upc.pe',
  expira_en_segundos: 600,
  reenviar_en_segundos: 0,
}

type Respuesta = { status?: number; data?: unknown }

function backend(verificar: (codigo: string) => Respuesta, reenviar: () => Respuesta = () => ({ data: respuestaDesafio })) {
  return (config: AxiosRequestConfig): Respuesta => {
    if (config.url === '/api/auth/login') return { data: respuestaDesafio }
    if (config.url === '/api/auth/login/verificar') return verificar(JSON.parse(config.data as string).codigo)
    if (config.url === '/api/auth/login/reenviar') return reenviar()
    return {}
  }
}

const aceptarSolo = (correcto: string) => (codigo: string): Respuesta =>
  codigo === correcto
    ? { data: { access_token: TOKEN, token_type: 'bearer' } }
    : { status: 401, data: { detail: 'El código no es correcto.' } }

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

async function pasarCredenciales(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
  await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
  await screen.findByRole('heading', { name: 'Revisa tu correo' })
}

let adaptador: ReturnType<typeof instalarAdaptadorFalso>

beforeEach(() => {
  setAccessToken(null)
  useAuthStore.setState({ usuario: null, autenticado: false, requiereCambioPassword: false })
})

afterEach(() => adaptador?.restaurar())

describe('Login con código', () => {
  it('sin segundo factor el login sigue entrando directo', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: { access_token: TOKEN, token_type: 'bearer' } }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByText('panel de control')).toBeInTheDocument()
  })

  it('con desafío muestra el correo enmascarado, la vigencia y no abre sesión', async () => {
    adaptador = instalarAdaptadorFalso(backend(aceptarSolo('123456')))
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)

    expect(document.getElementById('login-codigo-ayuda')).toHaveTextContent('f***@upc.pe')
    expect(screen.getByText(/Vence en 10:00|Vence en 9:5\d/)).toBeInTheDocument()
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveFocus()
    expect(useAuthStore.getState().autenticado).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('al completar el código lo canjea con el desafío y entra al panel', async () => {
    adaptador = instalarAdaptadorFalso(backend(aceptarSolo('123456')))
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)

    await user.keyboard('123456')

    expect(await screen.findByText('panel de control')).toBeInTheDocument()
    const verificacion = adaptador.peticiones.find((p) => p.url === '/api/auth/login/verificar')
    expect(JSON.parse(verificacion!.data as string)).toEqual({ desafio: DESAFIO, codigo: '123456' })
    expect(useAuthStore.getState().autenticado).toBe(true)
  })

  it('un código incorrecto avisa, limpia las casillas y permite reintentar', async () => {
    adaptador = instalarAdaptadorFalso(backend(aceptarSolo('123456')))
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)

    await user.keyboard('000000')
    await esperarAviso('alert', 'El código no es correcto')
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveValue('')
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveFocus()

    await user.keyboard('123456')
    expect(await screen.findByText('panel de control')).toBeInTheDocument()
  })

  it('intentos agotados obliga a volver a iniciar sesión', async () => {
    adaptador = instalarAdaptadorFalso(
      backend(() => ({ status: 401, data: { detail: 'Se agotaron los intentos para este código. Vuelve a iniciar sesión.' } })),
    )
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)

    await user.keyboard('999999')
    await esperarAviso('alert', 'Se agotaron los intentos')
    expect(screen.getByLabelText('Dígito 1 de 6')).toBeDisabled()
    // Las casillas se deshabilitan: el foco pasa a la única acción posible.
    const volver = screen.getByRole('button', { name: 'Volver a iniciar sesión' })
    expect(volver).toHaveFocus()
    expect(volver).toHaveAccessibleDescription(/Se agotaron los intentos/)

    await user.click(volver)
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('farmaceutico@upc.pe')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
  })

  it('una verificación caducada también vuelve al inicio', async () => {
    adaptador = instalarAdaptadorFalso(
      backend(() => ({ status: 401, data: { detail: 'La verificación caducó o no es válida. Vuelve a iniciar sesión.' } })),
    )
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)
    await user.keyboard('123456')
    await esperarAviso('alert', 'La verificación caducó')
    expect(screen.getByRole('button', { name: 'Volver a iniciar sesión' })).toBeInTheDocument()
  })

  it('reenvía el código con el mismo desafío y confirma el envío', async () => {
    adaptador = instalarAdaptadorFalso(backend(aceptarSolo('123456')))
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)

    await user.click(screen.getByRole('button', { name: 'Reenviar código' }))

    await esperarAviso('status', 'Te enviamos un código nuevo')
    const reenvio = adaptador.peticiones.find((p) => p.url === '/api/auth/login/reenviar')
    expect(JSON.parse(reenvio!.data as string)).toEqual({ desafio: DESAFIO })
  })

  it('un 503 al reenviar avisa que el código anterior ya no sirve', async () => {
    adaptador = instalarAdaptadorFalso(
      backend(aceptarSolo('123456'), () => ({ status: 503, data: { detail: 'No se pudo enviar el correo.' } })),
    )
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)
    await user.keyboard('12')

    await user.click(screen.getByRole('button', { name: 'Reenviar código' }))

    await esperarAviso('alert', 'el anterior ya no sirve')
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveValue('')
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveFocus()
  })

  it('respeta la espera de reenvío que indica el backend', async () => {
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/auth/login' ? { data: { ...respuestaDesafio, reenviar_en_segundos: 45 } } : {},
    )
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)
    expect(screen.getByRole('button', { name: /Reenviar en 4\d s/ })).toBeDisabled()
  })

  it('un 503 al pedir el código explica que el correo no salió', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 503, data: { detail: 'correo' } }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar el código')
  })

  it('«Usar otra cuenta» vuelve a las credenciales', async () => {
    adaptador = instalarAdaptadorFalso(backend(aceptarSolo('123456')))
    const user = userEvent.setup()
    montar()
    await pasarCredenciales(user)
    await user.click(screen.getByRole('button', { name: 'Usar otra cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    // Otra cuenta: el foco va al correo (seleccionado, escribir lo reemplaza).
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
  })
})
