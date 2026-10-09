import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Usuario } from '@/domain/entities/Usuario'

const useUsuarios = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useUsuarios', () => ({ useUsuarios }))

import { UsuariosPage } from '@/presentation/pages/UsuariosPage'

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    nombre: 'Brenda Gamio',
    email: 'brenda@upc.pe',
    rol: 'farmaceutico',
    is_active: true,
    motivo_desactivacion: null,
    desactivado_en: null,
    ...over,
  }
}

function montar(usuarios: Usuario[]) {
  useUsuarios.mockReturnValue({
    usuarios,
    cargando: false,
    crear: vi.fn(),
    desactivar: vi.fn(),
  })
  render(<UsuariosPage />)
}

describe('UsuariosPage (HU-41, HU-45, RF-17)', () => {
  beforeEach(() => useUsuarios.mockReset())

  it('lista los usuarios con su rol', () => {
    montar([usuario()])

    expect(screen.getByText('Brenda Gamio')).toBeInTheDocument()
    expect(screen.getByText('brenda@upc.pe')).toBeInTheDocument()
  })

  it('distingue un usuario desactivado de uno activo', () => {
    // HU-45: la desactivación no borra al usuario (la auditoría debe seguir
    // apuntando a alguien), así que la lista tiene que diferenciarlos.
    montar([
      usuario({ id: 'u-1', nombre: 'Activo Uno' }),
      usuario({
        id: 'u-2',
        nombre: 'Baja Dos',
        email: 'baja@upc.pe',
        is_active: false,
        motivo_desactivacion: 'renuncia',
      }),
    ])

    expect(screen.getByText('Activo Uno')).toBeInTheDocument()
    expect(screen.getByText('Baja Dos')).toBeInTheDocument()
    expect(screen.getAllByText(/inactivo|desactivad|baja/i).length).toBeGreaterThan(0)
  })

  it('ofrece dar de alta un usuario nuevo', () => {
    montar([usuario()])
    expect(screen.getAllByText(/nuevo usuario|crear usuario/i).length).toBeGreaterThan(0)
  })
})

describe('UsuariosPage — HU-41: el sistema nunca queda sin administración', () => {
  beforeEach(() => {
    useUsuarios.mockReset()
    useAuthStore.setState({
      usuario: { id: 'admin-yo', email: 'yo@upc.pe', rol: 'administrador', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
    })
  })

  it('no ofrece acciones sobre la propia cuenta del administrador', () => {
    montar([usuario({ id: 'admin-yo', nombre: 'Yo Admin', rol: 'administrador' }), usuario()])

    expect(screen.getByText('Tu cuenta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /opciones: yo admin/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /opciones: brenda gamio/i })).toBeInTheDocument()
  })

  it('deshabilita quitar o desactivar al último administrador activo', async () => {
    useAuthStore.setState({
      usuario: { id: 'otro', email: 'otro@upc.pe', rol: 'administrador', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
    })
    montar([usuario({ id: 'admin-unico', nombre: 'Admin Único', rol: 'administrador' })])

    const usuarioEvento = userEvent.setup()
    await usuarioEvento.click(screen.getByRole('button', { name: /opciones: admin único/i }))
    const cambiar = await screen.findByRole('menuitem', { name: /cambiar rol.*admin único/i })
    expect(cambiar).toHaveAttribute('data-disabled')
    expect(cambiar).toHaveAttribute('title', expect.stringMatching(/último administrador/i))
  })
})
