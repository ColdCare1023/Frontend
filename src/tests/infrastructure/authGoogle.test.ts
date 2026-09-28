import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { getAccessToken } from '@/infrastructure/api/apiClient'
import { loginConGoogle } from '@/infrastructure/auth/authService'
import { instalarAdaptadorFalso, jwtFalso, VIGENCIA_TOKEN_S } from '../ayudas'

function tokenInterno() {
  return jwtFalso({
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'brenda@upc.pe',
    rol: 'farmaceutico',
    exp: Math.floor(Date.now() / 1000) + VIGENCIA_TOKEN_S,
  })
}

describe('Acceso con Google (RF-17, método alternativo)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    useAuthStore.setState({ usuario: null, autenticado: false, requierePrivacidad: false })
  })

  afterEach(() => adaptador.restaurar())

  it('envía el ID token de Google al endpoint del backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: tokenInterno(), token_type: 'bearer', require_privacy_consent: false },
    }))

    await loginConGoogle('id-token-de-google')

    const peticion = adaptador.ultima()
    expect(peticion.url).toBe('/api/auth/google')
    expect(peticion.method).toBe('post')
    expect(JSON.parse(String(peticion.data))).toEqual({ id_token: 'id-token-de-google' })
  })

  it('guarda el JWT interno, no el token de Google', async () => {
    // Si se guardara el de Google, el resto del frontend no podría leer el rol
    // ni la expiración que gobiernan el RBAC y el aviso de sesión.
    const interno = tokenInterno()
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: interno, token_type: 'bearer', require_privacy_consent: false },
    }))

    await useAuthStore.getState().loginConGoogle('id-token-de-google')

    expect(getAccessToken()).toBe(interno)
    expect(getAccessToken()).not.toBe('id-token-de-google')
  })

  it('deja la sesión con el rol que decidió el backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: tokenInterno(), token_type: 'bearer', require_privacy_consent: false },
    }))

    await useAuthStore.getState().loginConGoogle('id-token-de-google')

    const { usuario, autenticado } = useAuthStore.getState()
    expect(autenticado).toBe(true)
    expect(usuario?.rol).toBe('farmaceutico')
  })

  it('propaga el consentimiento de privacidad pendiente (HU-44)', async () => {
    // Entrar por Google no puede saltarse la Ley 29733: si el consentimiento
    // está pendiente, la bandera tiene que llegar igual que con contraseña.
    adaptador = instalarAdaptadorFalso(() => ({
      data: { access_token: tokenInterno(), token_type: 'bearer', require_privacy_consent: true },
    }))

    await useAuthStore.getState().loginConGoogle('id-token-de-google')

    expect(useAuthStore.getState().requierePrivacidad).toBe(true)
  })

  it('no abre sesión si el backend rechaza la cuenta', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: { detail: 'no autorizado' } }))

    await expect(useAuthStore.getState().loginConGoogle('id-token-de-google')).rejects.toThrow()
    expect(useAuthStore.getState().autenticado).toBe(false)
    expect(getAccessToken()).toBeNull()
  })
})
