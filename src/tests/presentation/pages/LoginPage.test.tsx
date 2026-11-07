import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

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

/** Deja el login pendiente para poder mirar el estado de carga. */
function loginSinRespuesta() {
  const original = useAuthStore.getState().login
  useAuthStore.setState({ login: () => new Promise<void>(() => {}) })
  onTestFinished(() => useAuthStore.setState({ login: original }))
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

  it('conserva la foto aprobada y el titular de marca', () => {
    adaptador = instalarAdaptadorFalso()
    const { container } = montar()
    // La dueña del proyecto la pidió de vuelta: si alguien la quita, esta prueba falla.
    expect(container.querySelector('img[src$="assets/coldcare-auth-editorial.webp"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Protege cada dosis. En cada grado.' })).toBeInTheDocument()
  })

  it('con el correo vacío marca solo el correo y enlaza el aviso', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const correo = screen.getByLabelText('Correo electrónico')
    expect(correo).toHaveAttribute('aria-invalid', 'true')
    expect(correo).toHaveAccessibleDescription('Ingresa tu correo electrónico.')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'false')
  })

  it('con el correo correcto y sin contraseña marca solo la contraseña', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'false')
  })

  it('credenciales incorrectas marcan ambos campos: no dice cuál de los dos falló', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: { detail: 'no' } }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    await screen.findByRole('alert')
    for (const campo of ['Correo electrónico', 'Contraseña']) {
      expect(screen.getByLabelText(campo)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(campo)).toHaveAccessibleDescription('Correo o contraseña incorrectos.')
    }
  })

  it('el bloqueo por intentos no culpa a ningún campo', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 429, data: { detail: 'rate limited' } }))
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'false')
  })

  it('cada cápsula de demostración conserva su rol y su nombre accesible', () => {
    adaptador = instalarAdaptadorFalso()
    montar()
    const grupo = screen.getByRole('group', { name: 'Acceso de demostración' })

    expect(within(grupo).getAllByRole('button').map((boton) => boton.getAttribute('data-demo-role'))).toEqual([
      'administrador',
      'farmaceutico',
      'tecnico',
      'auditor',
    ])
    expect(within(grupo).getByRole('button', { name: 'Administrador Gestión del sistema' })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: 'Químico Farmacéutico Gestión térmica' })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: 'Técnico de Farmacia Operación y consulta' })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: 'Auditor Consulta de registros' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Datos simulados')
  })

  it('mientras entra un rol, la carga se muestra en su cápsula y lo anuncia', async () => {
    adaptador = instalarAdaptadorFalso()
    loginSinRespuesta()
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: /Auditor/ }))

    const auditor = screen.getByRole('button', { name: /Auditor/ })
    expect(auditor).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: /Administrador/ })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Entrando como Auditor…')
    // El botón del formulario no finge una carga que no es suya, pero tampoco se puede usar.
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ingresar' })).not.toHaveAttribute('aria-busy')
  })

  it('mientras el formulario envía, el botón lo dice y las cápsulas esperan', async () => {
    adaptador = instalarAdaptadorFalso()
    loginSinRespuesta()
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Correo electrónico'), 'farmaceutico@upc.pe')
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const enviando = screen.getByRole('button', { name: 'Ingresando…' })
    expect(enviando).toBeDisabled()
    expect(enviando).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: /Auditor/ })).toBeDisabled()
  })

  it('permite autenticación rápida mediante las cápsulas de roles demo', async () => {
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
