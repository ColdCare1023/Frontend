import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import { getAccessToken, setAccessToken } from '@/infrastructure/api/apiClient'
import { consumirMotivoAviso } from '@/infrastructure/auth/avisoSesion'
import {
  instalarAdaptadorFalso,
  esperarMicrotasks,
  tokenDe,
  VIGENCIA_TOKEN_S,
} from '../../ayudas'

const TOKEN = tokenDe('farmaceutico', 'farmaceutico@upc.pe')

function respuestaLogin(requierePrivacidad = false) {
  return {
    access_token: TOKEN,
    token_type: 'bearer',
    require_privacy_consent: requierePrivacidad,
  }
}

describe('authStore', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    setAccessToken(null)
    useAuthStore.setState({ usuario: null, autenticado: false, requierePrivacidad: false })
  })

  afterEach(() => {
    adaptador?.restaurar()
  })

  describe('login', () => {
    it('guarda el token en memoria y decodifica el usuario del JWT', async () => {
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin() }))

      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')

      const estado = useAuthStore.getState()
      expect(estado.autenticado).toBe(true)
      expect(estado.usuario).toMatchObject({
        id: '11111111-1111-1111-1111-111111111111',
        email: 'farmaceutico@upc.pe',
        rol: 'farmaceutico',
      })
      expect(getAccessToken()).toBe(TOKEN)
    })

    it('envía las credenciales como formulario, no como JSON', async () => {
      // El backend expone /api/auth/login con el flujo OAuth2 de FastAPI, que
      // exige `application/x-www-form-urlencoded` y el campo `username`.
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin() }))

      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')

      const peticion = adaptador.ultima()
      expect(peticion.url).toBe('/api/auth/login')
      expect(peticion.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      expect(String(peticion.data)).toContain('username=farmaceutico%40upc.pe')
    })

    it('normaliza el exp del JWT a milisegundos (FS5)', async () => {
      // El `exp` del RFC 7519 viene en segundos; el aviso de expiración compara
      // contra `Date.now()`, que está en milisegundos. Sin la conversión el
      // usuario aparecería como caducado desde el primer segundo.
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin() }))

      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')

      const restanteMs = useAuthStore.getState().usuario!.expiraEn - Date.now()
      expect(restanteMs).toBeGreaterThan((VIGENCIA_TOKEN_S - 5) * 1000)
      expect(restanteMs).toBeLessThanOrEqual(VIGENCIA_TOKEN_S * 1000)
    })

    it('propaga el requisito de consentimiento de privacidad (HU-44)', async () => {
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin(true) }))

      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')

      expect(useAuthStore.getState().requierePrivacidad).toBe(true)
    })

    it('no deja sesión a medias si el backend rechaza las credenciales', async () => {
      adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: { detail: 'no' } }))

      await expect(
        useAuthStore.getState().login('farmaceutico@upc.pe', 'incorrecta'),
      ).rejects.toThrow()

      expect(useAuthStore.getState().autenticado).toBe(false)
      expect(getAccessToken()).toBeNull()
    })

    it('no persiste el JWT fuera de memoria (mitigación XSS)', async () => {
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin() }))

      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')

      const volcado = JSON.stringify({ ...localStorage, ...sessionStorage })
      expect(volcado).not.toContain(TOKEN)
    })
  })

  describe('logout', () => {
    beforeEach(async () => {
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin() }))
      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')
    })

    it('limpia la sesión local', () => {
      useAuthStore.getState().logout()

      const estado = useAuthStore.getState()
      expect(estado.autenticado).toBe(false)
      expect(estado.usuario).toBeNull()
      expect(getAccessToken()).toBeNull()
    })

    it('pide al backend revocar el jti del token', async () => {
      useAuthStore.getState().logout()
      await esperarMicrotasks()

      const revocacion = adaptador.peticiones.find((p) => p.url === '/api/auth/logout')
      expect(revocacion).toBeDefined()
      expect(revocacion?.method).toBe('post')
    })

    it('REGRESIÓN: la revocación viaja autenticada', async () => {
      // Defecto real detectado en implementación: el interceptor de petición
      // lee `accessToken` en un microtask, cuando `setAccessToken(null)` ya
      // corrió. La petición salía sin cabecera, el backend respondía 401 y el
      // jti quedaba sin revocar — un JWT robado del tráfico seguiría siendo
      // válido hasta expirar pese a haber cerrado sesión.
      useAuthStore.getState().logout()
      await esperarMicrotasks()

      const revocacion = adaptador.peticiones.find((p) => p.url === '/api/auth/logout')
      expect(revocacion?.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    })

    it('cierra la sesión local aunque la revocación falle por red', async () => {
      adaptador.restaurar()
      adaptador = instalarAdaptadorFalso(() => {
        throw new Error('Network Error')
      })

      expect(() => useAuthStore.getState().logout()).not.toThrow()
      await esperarMicrotasks()

      expect(useAuthStore.getState().autenticado).toBe(false)
      expect(getAccessToken()).toBeNull()
    })

    it('con revocar:false no llama al backend (token ya expirado)', async () => {
      const antes = adaptador.peticiones.length

      useAuthStore.getState().logout({ revocar: false })
      await esperarMicrotasks()

      expect(adaptador.peticiones.length).toBe(antes)
      expect(useAuthStore.getState().autenticado).toBe(false)
    })

    it('borra la marca de sesión activa para no avisar de "recarga" al volver', () => {
      useAuthStore.getState().logout()

      expect(consumirMotivoAviso()).toBeNull()
    })
  })

  describe('consentimiento de privacidad (Ley N.° 29733)', () => {
    beforeEach(async () => {
      adaptador = instalarAdaptadorFalso(() => ({ data: respuestaLogin(true) }))
      await useAuthStore.getState().login('farmaceutico@upc.pe', 'Secreta-2026')
    })

    it('aceptar levanta el bloqueo tras confirmar el backend', async () => {
      await useAuthStore.getState().aceptarPrivacidad()

      expect(adaptador.ultima().url).toBe('/api/auth/privacidad/aceptar')
      expect(useAuthStore.getState().requierePrivacidad).toBe(false)
    })

    it('rechazar no lanza pese al 401 intencional del backend', async () => {
      adaptador.restaurar()
      adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: {} }))

      await expect(useAuthStore.getState().rechazarPrivacidad()).resolves.toBeUndefined()
    })
  })
})
