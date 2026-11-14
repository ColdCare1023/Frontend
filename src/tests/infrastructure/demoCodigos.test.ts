import { AxiosHeaders, AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'

import { CODIGO_VERIFICACION_DEMO } from '@/infrastructure/demo/constantesDemo'
import { demoAdapter } from '@/infrastructure/demo/demoAdapter'

/** La demo simula el contrato de códigos del backend (CODIGOS_VERIFICACION.md). */
function peticion(url: string, data: unknown, headers: Record<string, string> = {}): InternalAxiosRequestConfig {
  return {
    method: 'post',
    url,
    data: typeof data === 'string' ? data : JSON.stringify(data),
    headers: new AxiosHeaders(headers),
  } as InternalAxiosRequestConfig
}

const login = (email: string, password = 'demo-2026', headers: Record<string, string> = {}) =>
  demoAdapter(peticion('/api/auth/login', new URLSearchParams({ username: email, password }).toString(), headers))

async function rechazo(promesa: Promise<unknown>) {
  try {
    await promesa
  } catch (error) {
    if (error instanceof AxiosError) return error.response!
    throw error
  }
  throw new Error('Se esperaba un rechazo')
}

describe('demoAdapter: códigos de verificación', () => {
  it('el login con formulario devuelve un desafío en vez de token', async () => {
    const { data } = await login('farmaceutico@demo.pe')
    expect(data).toMatchObject({
      access_token: null,
      requiere_codigo: true,
      email_enmascarado: 'f***@demo.pe',
      expira_en_segundos: 600,
    })
    expect(String(data.desafio).length).toBeGreaterThanOrEqual(20)
  })

  it('el acceso rápido por rol sigue entrando sin código', async () => {
    const { data } = await login('auditor@demo.pe', 'demo-2026', { 'X-Demo-Acceso-Rapido': '1' })
    expect(data.access_token).toEqual(expect.any(String))
    expect(data.requiere_codigo).toBeUndefined()
  })

  it('canjea el desafío con el código demo y rechaza los incorrectos', async () => {
    const { data } = await login('tecnico@demo.pe')
    const malo = await rechazo(demoAdapter(peticion('/api/auth/login/verificar', { desafio: data.desafio, codigo: '000000' })))
    expect(malo.status).toBe(401)
    expect(malo.data).toEqual({ detail: 'El código no es correcto.' })

    const bueno = await demoAdapter(
      peticion('/api/auth/login/verificar', { desafio: data.desafio, codigo: CODIGO_VERIFICACION_DEMO }),
    )
    expect(bueno.data.access_token).toEqual(expect.any(String))

    // Un solo uso.
    const reuso = await rechazo(
      demoAdapter(peticion('/api/auth/login/verificar', { desafio: data.desafio, codigo: CODIGO_VERIFICACION_DEMO })),
    )
    expect(reuso.status).toBe(401)
  })

  it('al quinto fallo el código se quema', async () => {
    const { data } = await login('admin@demo.pe')
    let ultima
    for (let i = 0; i < 5; i++) {
      ultima = await rechazo(demoAdapter(peticion('/api/auth/login/verificar', { desafio: data.desafio, codigo: '999999' })))
    }
    expect(ultima!.data).toEqual({ detail: 'Se agotaron los intentos para este código. Vuelve a iniciar sesión.' })
  })

  it('el reenvío respeta la espera con Retry-After', async () => {
    const { data } = await login('farmaceutico@demo.pe')
    const espera = await rechazo(demoAdapter(peticion('/api/auth/login/reenviar', { desafio: data.desafio })))
    expect(espera.status).toBe(429)
    expect(Number(espera.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('recuperación: 202 sin revelar la cuenta y restablecimiento con el código demo', async () => {
    const solicitud = await demoAdapter(peticion('/api/auth/recuperar-password', { email: 'no-existe@demo.pe' }))
    expect(solicitud.status).toBe(202)

    const invalido = await rechazo(
      demoAdapter(
        peticion('/api/auth/restablecer-password', { email: 'tecnico@demo.pe', codigo: '111111', password_nueva: 'NuevaClave2026' }),
      ),
    )
    expect(invalido.status).toBe(400)

    const ok = await demoAdapter(
      peticion('/api/auth/restablecer-password', {
        email: 'tecnico@demo.pe',
        codigo: CODIGO_VERIFICACION_DEMO,
        password_nueva: 'NuevaClave2026',
      }),
    )
    expect(ok.status).toBe(204)

    // La contraseña nueva sirve para entrar (además de la común de la demo).
    const { data } = await login('tecnico@demo.pe', 'NuevaClave2026')
    expect(data.requiere_codigo).toBe(true)
  })

  it('aplica la política de contraseña del backend (422)', async () => {
    const debil = await rechazo(
      demoAdapter(
        peticion('/api/auth/restablecer-password', { email: 'tecnico@demo.pe', codigo: CODIGO_VERIFICACION_DEMO, password_nueva: 'corta' }),
      ),
    )
    expect(debil.status).toBe(422)
  })
})
