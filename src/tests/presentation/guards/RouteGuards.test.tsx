import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { RequireAuth, RequireRoles } from '@/presentation/components/RouteGuards'
import type { Rol } from '@/domain/value-objects/Rol'

function sesionCon(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
    requierePrivacidad: false,
  })
}

/** Monta el árbol de rutas real: guardia → página protegida, más /login. */
function montar(rutaInicial = '/protegida', roles?: Rol[]) {
  const protegida = <p>contenido protegido</p>
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route path="/login" element={<p>pantalla de inicio de sesión</p>} />
        <Route element={<RequireAuth />}>
          {roles ? (
            <Route element={<RequireRoles roles={roles} />}>
              <Route path="/protegida" element={protegida} />
            </Route>
          ) : (
            <Route path="/protegida" element={protegida} />
          )}
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({ usuario: null, autenticado: false, requierePrivacidad: false })
  })

  it('sin sesión redirige a /login', () => {
    montar()

    expect(screen.getByText('pantalla de inicio de sesión')).toBeInTheDocument()
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
  })

  it('con sesión deja pasar', () => {
    sesionCon('tecnico')

    montar()

    expect(screen.getByText('contenido protegido')).toBeInTheDocument()
  })
})

describe('RequireRoles (RBAC)', () => {
  beforeEach(() => {
    useAuthStore.setState({ usuario: null, autenticado: false, requierePrivacidad: false })
  })

  it('deja pasar al rol permitido', () => {
    sesionCon('farmaceutico')

    montar('/protegida', ['farmaceutico'])

    expect(screen.getByText('contenido protegido')).toBeInTheDocument()
  })

  it('bloquea al rol no permitido sin filtrar el contenido', () => {
    // El técnico no firma verificaciones BPA ni exporta reportes: la página no
    // debe renderizarse siquiera, no basta con ocultarla visualmente.
    sesionCon('tecnico')

    montar('/protegida', ['farmaceutico'])

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
    expect(screen.getByText(/permiso/i)).toBeInTheDocument()
  })

  it('el administrador accede a todo (RBAC jerárquico)', () => {
    sesionCon('administrador')

    montar('/protegida', ['farmaceutico'])

    expect(screen.getByText('contenido protegido')).toBeInTheDocument()
  })

  it('roles vacíos significa solo administrador, no "todos"', () => {
    // `roles={[]}` protege auditoría, usuarios, dispositivos y firmware. Si se
    // interpretara como "sin restricción", cualquier técnico entraría a la
    // gestión de usuarios.
    sesionCon('farmaceutico')

    montar('/protegida', [])

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
    expect(screen.getByText(/permiso/i)).toBeInTheDocument()
  })

  it('sin usuario en el store redirige a /login en vez de mostrar el 403', () => {
    useAuthStore.setState({ usuario: null, autenticado: true, requierePrivacidad: false })

    montar('/protegida', ['farmaceutico'])

    expect(screen.getByText('pantalla de inicio de sesión')).toBeInTheDocument()
  })
})
