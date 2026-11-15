import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { RecuperarContrasenaPage } from '@/presentation/pages/RecuperarContrasenaPage'
import { esperarAviso, instalarAdaptadorFalso } from '../../ayudas'

/**
 * Recuperación y activación por código (CODIGOS_VERIFICACION.md, flujos 2 y 3):
 * POST /api/auth/recuperar-password y POST /api/auth/restablecer-password con
 * `{email, codigo, password_nueva}`.
 */
function Ubicacion() {
  const { search, hash } = useLocation()
  return <output data-testid="ubicacion">{`${search}${hash}`}</output>
}

function montar(ruta = '/recuperar-contrasena') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Ubicacion />
      <Routes>
        <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
        <Route path="/login" element={<p>pantalla de acceso</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

let adaptador: ReturnType<typeof instalarAdaptadorFalso>
afterEach(() => adaptador?.restaurar())

async function completarCodigoYPassword(user: ReturnType<typeof userEvent.setup>, codigo = '654321') {
  await user.click(screen.getByLabelText('Dígito 1 de 6'))
  await user.keyboard(codigo)
  await user.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave2026')
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave2026')
}

describe('Recuperación con código', () => {
  it('recorre correo → código y contraseña → listo', async () => {
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/auth/recuperar-password' ? { status: 202, data: { detail: 'ok' } } : { status: 204, data: null },
    )
    const user = userEvent.setup()
    montar()

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    await user.type(screen.getByLabelText('Correo electrónico'), 'farma@upc.pe')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))

    await screen.findByRole('heading', { name: 'Crea tu nueva contraseña' })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('button', { name: /Reenviar en/ })).toBeDisabled()

    await completarCodigoYPassword(user)
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument()
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({
      email: 'farma@upc.pe',
      codigo: '654321',
      password_nueva: 'NuevaClave2026',
    })
    expect(screen.getByRole('link', { name: /Ir a iniciar sesión/ })).toHaveAttribute('href', '/login')
  })

  it('valida código incompleto y política de contraseña antes de llamar al backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 202, data: {} }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena?modo=activar&email=nuevo@upc.pe')
    const antes = adaptador.peticiones.length

    await user.click(screen.getByRole('button', { name: 'Activar cuenta' }))
    await esperarAviso('alert', 'Escribe los 6 dígitos')

    await user.click(screen.getByLabelText('Dígito 1 de 6'))
    await user.keyboard('111111')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'corta1')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'corta1')
    await user.click(screen.getByRole('button', { name: 'Activar cuenta' }))
    await esperarAviso('alert', 'al menos 10 caracteres')
    expect(adaptador.peticiones).toHaveLength(antes)
  })

  it('muestra los requisitos de la contraseña en vivo', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar('/recuperar-contrasena?modo=activar&email=nuevo@upc.pe')
    const requisitos = screen.getByRole('list', { name: /Mínimo 10 caracteres/ })
    expect(requisitos).toHaveTextContent('Al menos 10 caracteres(pendiente)')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave2026')
    expect(requisitos).toHaveTextContent('Al menos 10 caracteres(cumplido)')
    expect(requisitos).toHaveTextContent('Letras y números(cumplido)')
  })

  it('un código inválido o caducado se señala en el campo y se puede pedir otro', async () => {
    adaptador = instalarAdaptadorFalso((config) =>
      config.url === '/api/auth/restablecer-password'
        ? { status: 400, data: { detail: 'El código no es válido o ya caducó. Solicita uno nuevo.' } }
        : { status: 202, data: {} },
    )
    const user = userEvent.setup()
    montar('/recuperar-contrasena?modo=activar&email=nuevo@upc.pe')

    await completarCodigoYPassword(user)
    await user.click(screen.getByRole('button', { name: 'Activar cuenta' }))

    const error = await esperarAviso('alert', 'El código no es válido o ya caducó')
    // El error queda junto a las casillas (donde vuelve el foco) y se lee desde la primera.
    expect(error.parentElement).toHaveAttribute('id', 'recuperar-codigo-aviso')
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveFocus()
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveAccessibleDescription(/El código no es válido/)
    expect(screen.getByRole('group', { name: 'Código de verificación' })).toHaveAttribute('data-estado', 'error')

    // Escribir el código nuevo retira el error.
    await user.keyboard('1')
    expect(error).toHaveTextContent('')

    await user.click(screen.getByRole('button', { name: 'Reenviar código' }))
    await esperarAviso('status', 'te llegará un código nuevo. El anterior ya no sirve')
    expect(adaptador.ultima().url).toBe('/api/auth/recuperar-password')
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({ email: 'nuevo@upc.pe' })
  })
})

describe('Enlace del correo de recuperación', () => {
  it('modo=recuperar abre el paso del código sin pedir otro (anularía el que ya llegó)', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 204, data: null }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena?email=x@y.pe&modo=recuperar')

    expect(screen.getByRole('heading', { name: 'Crea tu nueva contraseña' })).toBeInTheDocument()
    expect(document.getElementById('recuperar-codigo-ayuda')).toHaveTextContent('x@y.pe')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(adaptador.peticiones).toHaveLength(0)

    await completarCodigoYPassword(user, '445566')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument()
    expect(adaptador.peticiones.some((p) => p.url === '/api/auth/recuperar-password')).toBe(false)
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({
      email: 'x@y.pe',
      codigo: '445566',
      password_nueva: 'NuevaClave2026',
    })
  })

  it('«Usar otro correo» vuelve al paso 1 con el foco en el correo', async () => {
    adaptador = instalarAdaptadorFalso()
    const user = userEvent.setup()
    montar('/recuperar-contrasena?email=x@y.pe&modo=recuperar')

    await user.click(screen.getByRole('button', { name: 'Usar otro correo' }))
    expect(await screen.findByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
  })
})

describe('Activación de cuenta', () => {
  it('el enlace de bienvenida empieza en el código con el correo y textos de activación', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 204, data: null }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena?email=nuevo@upc.pe&modo=activar')

    expect(screen.getByRole('heading', { name: 'Activa tu cuenta' })).toBeInTheDocument()
    expect(document.getElementById('recuperar-codigo-ayuda')).toHaveTextContent('nuevo@upc.pe')
    expect(adaptador.peticiones).toHaveLength(0)

    await completarCodigoYPassword(user, '112233')
    await user.click(screen.getByRole('button', { name: 'Activar cuenta' }))

    expect(await screen.findByRole('heading', { name: 'Cuenta activada' })).toBeInTheDocument()
    expect(adaptador.ultima().url).toBe('/api/auth/restablecer-password')
    expect(JSON.parse(adaptador.ultima().data as string)).toEqual({
      email: 'nuevo@upc.pe',
      codigo: '112233',
      password_nueva: 'NuevaClave2026',
    })
  })

  it('tras «Reenviar código» ya no promete el código de bienvenida de 48 h', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 202, data: {} }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena?email=nuevo@upc.pe&modo=activar')

    const ayuda = document.getElementById('recuperar-codigo-ayuda')
    expect(ayuda).toHaveTextContent('Vale 48 horas')
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }))

    await esperarAviso('status', 'El anterior ya no sirve')
    expect(ayuda).toHaveTextContent('nuevo@upc.pe')
    expect(ayuda).toHaveTextContent('Vale 10 minutos')
    expect(ayuda).not.toHaveTextContent('48 horas')
  })

  it('el correo del enlace se quita de la URL y el paso «Listo» recibe el foco', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 204, data: null }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena?email=nuevo@upc.pe&modo=activar')

    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\?modo=activar$/)
    expect(screen.getByRole('heading', { name: 'Activa tu cuenta' })).toBeInTheDocument()

    await completarCodigoYPassword(user)
    await user.click(screen.getByRole('button', { name: 'Activar cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Cuenta activada' })).toHaveFocus()
  })

  it('acepta también modo=activacion y sin correo pide el correo primero', () => {
    adaptador = instalarAdaptadorFalso()
    montar('/recuperar-contrasena?modo=activacion')
    expect(screen.getByRole('heading', { name: 'Activa tu cuenta' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
  })

  it('el botón del correo trae el código en #codigo=: llega rellenado y el foco va a la contraseña', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 204, data: null }))
    const user = userEvent.setup()
    montar('/recuperar-contrasena?modo=activar&email=nuevo@upc.pe#codigo=482915')

    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\?modo=activar$/)
    expect(['1', '2', '3', '4', '5', '6'].map((n) => (screen.getByLabelText(`Dígito ${n} de 6`) as HTMLInputElement).value)).toEqual(
      ['4', '8', '2', '9', '1', '5'],
    )
    expect(screen.getByText(/Completamos el código con el enlace de tu correo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toHaveFocus()

    await user.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave2026')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave2026')
    await user.click(screen.getByRole('button', { name: 'Activar cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Cuenta activada' })).toBeInTheDocument()
    expect(JSON.parse(adaptador.ultima().data as string)).toMatchObject({ email: 'nuevo@upc.pe', codigo: '482915' })
  })

  it('un fragmento que no es exactamente el código no rellena nada y también se quita de la URL', () => {
    adaptador = instalarAdaptadorFalso()
    montar('/recuperar-contrasena?email=x@y.pe&modo=recuperar#codigo=12a456')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\?modo=recuperar$/)
    expect((screen.getByLabelText('Dígito 1 de 6') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText(/Completamos el código/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveFocus()
  })

  it('sin correo válido en el enlace el código del fragmento se ignora', () => {
    adaptador = instalarAdaptadorFalso()
    montar('/recuperar-contrasena?modo=recuperar#codigo=482915')
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\?modo=recuperar$/)
  })
})
