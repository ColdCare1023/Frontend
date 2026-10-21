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
    nombre: 'Usuaria Prueba',
    email: 'brenda@upc.pe',
    rol: 'farmaceutico',
    is_active: true,
    motivo_desactivacion: null,
    desactivado_en: null,
    ...over,
  }
}

function montar(usuarios: Usuario[], extra: Record<string, unknown> = {}) {
  useUsuarios.mockReturnValue({
    usuarios,
    cargando: false,
    crear: vi.fn(),
    desactivar: vi.fn(),
    ...extra,
  })
  render(<UsuariosPage />)
}

describe('UsuariosPage (HU-41, HU-45, RF-17)', () => {
  beforeEach(() => useUsuarios.mockReset())

  it('lista los usuarios con su rol', () => {
    montar([usuario()])

    expect(screen.getByText('Usuaria Prueba')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /opciones: usuaria prueba/i })).toBeInTheDocument()
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

describe('UsuariosPage — contraseñas temporales (FE-004)', () => {
  beforeEach(() => {
    useUsuarios.mockReset()
    useAuthStore.setState({
      usuario: { id: 'admin-1', email: 'admin@upc.pe', rol: 'administrador', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
    })
  })

  it('restablece la contraseña y muestra la temporal una sola vez', async () => {
    const asignarTemporal = vi.fn().mockResolvedValue({
      usuario: usuario({ debe_cambiar_password: true }),
      password_temporal: 'Temporal-xyz-2026',
    })
    montar([usuario()], { asignarTemporal })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Opciones: Usuaria Prueba/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Restablecer contraseña/ }))
    expect(screen.getByText(/se cerrarán las sesiones abiertas/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(asignarTemporal).toHaveBeenCalledWith('u-1', 'restablecer-password')
    expect(await screen.findByTestId('password-temporal')).toHaveTextContent('Temporal-xyz-2026')
    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' })
    await user.click(cerrar[cerrar.length - 1])
    expect(screen.queryByText('Temporal-xyz-2026')).toBeNull()
  })

  it('ofrece reactivar a un usuario desactivado', async () => {
    const asignarTemporal = vi.fn().mockResolvedValue({ usuario: usuario(), password_temporal: 'Otra-temporal-9' })
    montar([usuario({ id: 'u-2', nombre: 'Baja Dos', is_active: false })], { asignarTemporal })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Opciones: Baja Dos/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Reactivar/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(asignarTemporal).toHaveBeenCalledWith('u-2', 'reactivar')
    expect(await screen.findByTestId('password-temporal')).toHaveTextContent('Otra-temporal-9')
  })
})
