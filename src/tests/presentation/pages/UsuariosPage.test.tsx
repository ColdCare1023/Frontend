import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Usuario } from '@/domain/entities/Usuario'

const useUsuarios = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useUsuarios', () => ({ useUsuarios }))

import { UsuariosPage } from '@/presentation/pages/UsuariosPage'
import { iniciales } from '@/presentation/pages/usuarios/personas'

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

  it('envía el celular al crear la cuenta y lo omite si se deja vacío', async () => {
    const crear = vi.fn().mockResolvedValue('ok')
    montar([usuario()], { crear })
    const u = userEvent.setup()

    await u.click(screen.getAllByRole('button', { name: /nuevo usuario/i })[0])
    await u.type(screen.getByLabelText('Nombre completo'), 'Ana Prueba')
    await u.type(screen.getByLabelText('Correo electrónico'), 'ana@prueba.pe')
    await u.type(screen.getByLabelText('Celular (opcional)'), '+51999888777')
    await u.type(screen.getByLabelText('Contraseña'), 'Clave-Segura-2026!x')
    await u.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(crear).toHaveBeenLastCalledWith('Ana Prueba', 'ana@prueba.pe', 'Clave-Segura-2026!x', 'tecnico', '+51999888777')

    await u.clear(screen.getByLabelText('Celular (opcional)'))
    await u.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(crear).toHaveBeenLastCalledWith('Ana Prueba', 'ana@prueba.pe', 'Clave-Segura-2026!x', 'tecnico', undefined)
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

describe('UsuariosPage — rediseño: personas y permisos por perfil', () => {
  beforeEach(() => {
    useUsuarios.mockReset()
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  it('cada persona es una fila con sus iniciales, su rol y su estado', () => {
    montar([usuario({ nombre: 'Ana María Ríos', email: 'ana@upc.pe', rol: 'auditor' })])

    const fila = screen.getByRole('row', { name: /Ana María Ríos/ })
    expect(within(fila).getByText('AM')).toBeInTheDocument()
    expect(within(fila).getByText('ana@upc.pe')).toBeInTheDocument()
    expect(within(fila).getByText('Auditor')).toBeInTheDocument()
    expect(within(fila).getByText('Activo')).toBeInTheDocument()
  })

  it('una cuenta desactivada enseña el motivo a la vista, no solo al lector de pantalla', () => {
    montar([usuario({ nombre: 'Baja Dos', is_active: false, motivo_desactivacion: 'renuncia' })])

    const fila = screen.getByRole('row', { name: /Baja Dos/ })
    expect(within(fila).getByText('Inactivo')).toBeInTheDocument()
    expect(within(fila).getByText(/Renuncia/)).toBeVisible()
  })

  it('avisa de la contraseña temporal pendiente', () => {
    montar([usuario({ debe_cambiar_password: true })])
    expect(screen.getByText('Contraseña temporal')).toHaveAttribute('title', expect.stringMatching(/cambiarla al ingresar/))
  })

  it('una frase dice cuántas personas tienen acceso, sin cuatro indicadores', () => {
    montar([usuario(), usuario({ id: 'u-2', is_active: false, rol: 'administrador' })])

    const frase = screen.getByText(/persona con acceso · 1 cuenta desactivada$/)
    // La cifra rueda: el lector de pantalla la lee una vez, entera.
    expect(within(frase).getByText('1', { selector: '.sr-only' })).toBeInTheDocument()
    expect(screen.queryByRole('term')).toBeNull()
  })

  it('los permisos tienen su propia vista y salen de la misma lista que arma el menú', async () => {
    montar([usuario()])
    const user = userEvent.setup()
    expect(screen.queryByRole('table', { name: 'Qué puede ver cada perfil' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Permisos' }))

    // Primero, qué puede hacer cada rol en una frase; la tabla de pantallas queda a un clic.
    expect(screen.getByText(/Solo mira: temperaturas, reportes y quién hizo qué/)).toBeInTheDocument()
    const verTabla = screen.getByRole('button', { name: 'Ver pantalla por pantalla' })
    expect(verTabla).toHaveAttribute('aria-expanded', 'false')
    await user.click(verTabla)
    const tabla = screen.getByRole('table', { name: 'Qué puede ver cada perfil' })
    const accesos = (pantalla: string) =>
      within(within(tabla).getByRole('row', { name: new RegExp(`^${pantalla}`) }))
        .getAllByRole('cell')
        .map((celda) => celda.textContent)
    const si = 'Con acceso'
    const no = 'Sin acceso'
    // Orden de columnas: administrador, farmacéutico, técnico, auditor.
    expect(accesos('Usuarios')).toEqual([si, no, no, no])
    expect(accesos('Auditoría')).toEqual([si, no, no, si])
    expect(accesos('Reportes')).toEqual([si, si, no, si])
    expect(accesos('Inicio')).toEqual([si, si, si, si])
    // Cada perfil dice cuántas pantallas abre.
    expect(within(tabla).getByText('10 pantallas')).toBeInTheDocument()
    expect(within(tabla).getByText('5 pantallas')).toBeInTheDocument()
    // Al volver, las personas siguen ahí.
    await user.click(screen.getByRole('button', { name: 'Personas' }))
    expect(screen.getByText('Usuaria Prueba')).toBeInTheDocument()
  })

  it('al crear, dice qué abrirá el rol elegido y conserva las validaciones del formulario', async () => {
    montar([usuario()])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    expect(screen.getByText(/Verá 5 de 10 pantallas/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Rol'), 'administrador')
    expect(screen.getByText(/Verá 10 de 10 pantallas/)).toBeInTheDocument()

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('minlength', '8')
    expect(screen.getByLabelText('Contraseña')).toBeRequired()
    expect(screen.getByLabelText('Celular (opcional)')).toHaveAttribute('pattern', '^\\+[1-9][0-9]{7,14}$')
    expect(screen.getByLabelText('Celular (opcional)')).not.toBeRequired()
  })

  it('carga, vacío y error se distinguen', () => {
    useUsuarios.mockReturnValue({ usuarios: [], cargando: true })
    const { unmount } = render(<UsuariosPage />)
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
    expect(screen.queryByText('No hay usuarios registrados.')).toBeNull()
    unmount()

    montar([])
    expect(screen.getByText('No hay usuarios registrados.')).toBeInTheDocument()
    cleanup()

    montar([], { errorCarga: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las cuentas.')
    expect(screen.queryByText('No hay usuarios registrados.')).toBeNull()
  })
})

describe('iniciales', () => {
  it('toma dos palabras con letras y respeta acentos', () => {
    expect(iniciales('Técnico Demo 2')).toBe('TD')
    expect(iniciales('Ángel')).toBe('Á')
    expect(iniciales('  ñandú   ñu  ')).toBe('ÑÑ')
    expect(iniciales('')).toBe('')
  })
})
