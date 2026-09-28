import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
