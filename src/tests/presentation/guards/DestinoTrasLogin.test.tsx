import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/demo/modoDemo', () => ({ MODO_DEMO: false }))

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import { setAccessToken } from '@/infrastructure/api/apiClient'
import { destinoSeguro } from '@/lib/destinoTrasLogin'
import { RequireAuth, RequireRoles } from '@/presentation/components/RouteGuards'
import { destinoTrasLogin } from '@/presentation/navegacion'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { instalarAdaptadorFalso, tokenDe } from '../../ayudas'

function Pantalla({ nombre }: { nombre: string }) {
  const { pathname, search } = useLocation()
  return <p data-testid="pantalla">{`${nombre} ${pathname}${search}`}</p>
}

/** El árbol real: RequireAuth → RequireRoles → página, más /login y /dashboard. */
function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Pantalla nombre="monitoreo" />} />
          <Route path="/alertas" element={<Pantalla nombre="alertas" />} />
          <Route element={<RequireRoles roles={[]} />}>
            <Route path="/usuarios" element={<Pantalla nombre="usuarios" />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

async function entrarComo(rol: Rol) {
  const usuario = userEvent.setup()
  await usuario.type(screen.getByLabelText('Correo electrónico'), `${rol}@upc.pe`)
  await usuario.type(screen.getByLabelText('Contraseña'), 'Secreta-2026')
  await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))
}

/**
 * HU-52 / HU-54: el correo enlaza `/alertas?id=…` (o `/alertas`). Sin sesión,
 * el login no puede perder ese destino: tras autenticarse se vuelve a él.
 */
describe('Destino tras el login (enlaces de los correos)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  let rol: Rol = 'farmaceutico'

  beforeEach(() => {
    setAccessToken(null)
    useAuthStore.setState({ usuario: null, autenticado: false })
    rol = 'farmaceutico'
    adaptador = instalarAdaptadorFalso(() => ({ data: { access_token: tokenDe(rol), token_type: 'bearer' } }))
  })

  afterEach(() => adaptador.restaurar())

  it('el enlace de la excursión lleva al login y, tras entrar, a la alerta del correo', async () => {
    montar('/alertas?id=0b6c7e0e-1111-2222-3333-444455556666')
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()

    await entrarComo('farmaceutico')

    expect(await screen.findByTestId('pantalla')).toHaveTextContent('alertas /alertas?id=0b6c7e0e-1111-2222-3333-444455556666')
  })

  it('el enlace SIN_DATOS (`/alertas`) también vuelve a Alertas', async () => {
    rol = 'tecnico'
    montar('/alertas')
    await entrarComo('tecnico')

    expect(await screen.findByTestId('pantalla')).toHaveTextContent('alertas /alertas')
  })

  it('un destino que el rol no puede abrir cae al monitoreo, no a «Sin permiso»', async () => {
    rol = 'auditor'
    montar('/usuarios')
    await entrarComo('auditor')

    expect(await screen.findByTestId('pantalla')).toHaveTextContent('monitoreo /dashboard')
  })

  it('sin destino previo, el login sigue llevando al monitoreo', async () => {
    montar('/login')
    await entrarComo('farmaceutico')

    expect(await screen.findByTestId('pantalla')).toHaveTextContent('monitoreo /dashboard')
  })
})

describe('destinoSeguro: sin redirecciones abiertas', () => {
  it.each([
    ['/alertas?id=abc', '/alertas?id=abc'],
    ['/alertas', '/alertas'],
    ['https://evil.example/alertas', null],
    ['//evil.example/alertas', null],
    ['/\\evil.example', null],
    ['alertas', null],
    ['/login?sesion=expirada', null],
    ['/cambiar-password', null],
    [42, null],
  ])('%s → %s', (desde, esperado) => {
    expect(destinoSeguro({ desde })).toBe(esperado)
  })

  it('sin estado no hay destino', () => {
    expect(destinoSeguro(null)).toBeNull()
    expect(destinoSeguro(undefined)).toBeNull()
  })

  it('destinoTrasLogin respeta el rol (el administrador pasa todo)', () => {
    expect(destinoTrasLogin({ desde: '/usuarios' }, 'administrador')).toBe('/usuarios')
    expect(destinoTrasLogin({ desde: '/usuarios' }, 'farmaceutico')).toBe('/dashboard')
    expect(destinoTrasLogin({ desde: '/alertas?id=x' }, 'auditor')).toBe('/alertas?id=x')
    expect(destinoTrasLogin({ desde: '/no-existe' }, 'farmaceutico')).toBe('/dashboard')
    expect(destinoTrasLogin({ desde: '/alertas' }, null)).toBe('/dashboard')
  })
})
