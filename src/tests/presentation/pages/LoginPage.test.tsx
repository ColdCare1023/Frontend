import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/demo/modoDemo', () => ({
  MODO_DEMO: true,
}))

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
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  afterEach(() => adaptador?.restaurar())

  it('muestra formulario de acceso con etiquetas reales', () => {
    adaptador = instalarAdaptadorFalso()
    montar()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('permite mostrar y ocultar la contraseña', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('valida campos antes de llamar al servicio', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa tu correo electrónico.')
    expect(adaptador.peticiones).toHaveLength(0)
  })

  it('rechaza formato de correo inválido', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'correo-invalido')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo electrónico válido.')
    expect(adaptador.peticiones).toHaveLength(0)
  })

  it('autentica con credenciales válidas y navega al panel', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: TOKEN, token_type: 'bearer' },
    }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByText('panel de control')).toBeInTheDocument()
    expect(useAuthStore.getState().autenticado).toBe(true)
  })

  it('muestra error genérico para credenciales incorrectas', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: { detail: 'no' } }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.queryByText('panel de control')).not.toBeInTheDocument()
  })

  it('comunica bloqueo temporal sin confundirlo con error de credenciales', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 429, data: { detail: 'rate limited' } }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos fallidos.')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Correo o contraseña incorrectos.')
  })

  it('enlaza la recuperación real y no ofrece autorregistro simulado (FE-004)', () => {
    adaptador = instalarAdaptadorFalso()
    montar()
    const enlaceRecuperar = screen.getByRole('link', { name: /¿Olvidaste tu contraseña\?/i })
    expect(enlaceRecuperar).toHaveAttribute('href', '/recuperar-contrasena')

    expect(screen.queryByRole('link', { name: /Solicitar acceso|Crear cuenta/i })).toBeNull()
    expect(screen.getByText(/Pídela al administrador/)).toBeInTheDocument()
  })

  it('permite autenticación rápida mediante el grid 2x2 de roles demo', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: TOKEN, token_type: 'bearer' },
    }))
    const user = userEvent.setup()
    montar()

    const botonAuditor = screen.getByRole('button', { name: /Cajero|Auditor/i })
    expect(botonAuditor).toBeInTheDocument()

    await user.click(botonAuditor)
    expect(await screen.findByText('panel de control')).toBeInTheDocument()
    expect(useAuthStore.getState().autenticado).toBe(true)
  })
})
