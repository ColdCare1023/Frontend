import { describe, expect, it } from 'vitest'
import {
  googleAuthAdapter,
  facebookAuthAdapter,
} from '@/infrastructure/auth/socialAuthAdapters'
import { decodificarSesion } from '@/infrastructure/auth/authService'

describe('socialAuthAdapters (RBAC & Federado)', () => {
  describe('googleAuthAdapter', () => {
    it('otorga acceso cuando la cuenta de Google coincide con un usuario autorizado en ColdCare', async () => {
      const resultado = await googleAuthAdapter.authenticate('admin@demo.pe')
      expect(resultado.status).toBe('success')
      expect(resultado.accessToken).toBeDefined()
      expect(resultado.user?.email).toBe('admin@demo.pe')

      if (resultado.accessToken) {
        const sesion = decodificarSesion(resultado.accessToken)
        expect(sesion.email).toBe('admin@demo.pe')
        expect(sesion.rol).toBe('administrador')
      }
    })

    it('deniega acceso y devuelve not_authorized cuando la cuenta de Google no tiene rol en ColdCare', async () => {
      const resultado = await googleAuthAdapter.authenticate('desconocido@hospital.org')
      expect(resultado.status).toBe('not_authorized')
      expect(resultado.accessToken).toBeUndefined()
      expect(resultado.user?.email).toBe('desconocido@hospital.org')
      expect(resultado.errorMessage).toContain('no tiene acceso')
    })
  })

  describe('facebookAuthAdapter', () => {
    it('otorga acceso cuando la cuenta de Facebook coincide con un usuario autorizado', async () => {
      const resultado = await facebookAuthAdapter.authenticate('farmaceutico@demo.pe')
      expect(resultado.status).toBe('success')
      expect(resultado.accessToken).toBeDefined()

      if (resultado.accessToken) {
        const sesion = decodificarSesion(resultado.accessToken)
        expect(sesion.rol).toBe('farmaceutico')
      }
    })

    it('deniega acceso y devuelve not_authorized para cuentas no registradas en ColdCare', async () => {
      const resultado = await facebookAuthAdapter.authenticate('externo@fb.com')
      expect(resultado.status).toBe('not_authorized')
      expect(resultado.accessToken).toBeUndefined()
    })
  })
})
