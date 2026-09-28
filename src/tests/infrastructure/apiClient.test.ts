import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiClient,
  getAccessToken,
  setAccessToken,
  setOnSesionExpirada,
} from '@/infrastructure/api/apiClient'
import { instalarAdaptadorFalso, tokenDe } from '../ayudas'

const TOKEN = tokenDe('tecnico')

describe('apiClient', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    setAccessToken(null)
    setOnSesionExpirada(() => {})
  })

  afterEach(() => {
    adaptador?.restaurar()
  })

  it('adjunta el token a las peticiones cuando hay sesión', async () => {
    adaptador = instalarAdaptadorFalso()
    setAccessToken(TOKEN)

    await apiClient.get('/api/dispositivos')

    expect(adaptador.ultima().headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('no inventa una cabecera de autorización sin sesión', async () => {
    adaptador = instalarAdaptadorFalso()

    await apiClient.get('/api/dispositivos')

    expect(adaptador.ultima().headers.Authorization).toBeUndefined()
  })

  it('un 401 descarta el token en memoria y avisa de la sesión expirada', async () => {
    // Sin esto la aplicación seguiría reenviando un token ya rechazado en cada
    // petición posterior, y el usuario vería fallos sin explicación.
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: {} }))
    setAccessToken(TOKEN)
    const avisar = vi.fn()
    setOnSesionExpirada(avisar)

    await expect(apiClient.get('/api/alertas')).rejects.toThrow()

    expect(getAccessToken()).toBeNull()
    expect(avisar).toHaveBeenCalledTimes(1)
  })

  it('un 403 no cierra la sesión: es falta de permiso, no de autenticación', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 403, data: {} }))
    setAccessToken(TOKEN)
    const avisar = vi.fn()
    setOnSesionExpirada(avisar)

    await expect(apiClient.get('/api/usuarios')).rejects.toThrow()

    expect(getAccessToken()).toBe(TOKEN)
    expect(avisar).not.toHaveBeenCalled()
  })

  it('un 401 sin sesión previa no dispara el aviso', async () => {
    // Es el caso del login con credenciales incorrectas: el usuario nunca llegó
    // a tener sesión, así que no procede decirle que la suya expiró.
    adaptador = instalarAdaptadorFalso(() => ({ status: 401, data: {} }))
    const avisar = vi.fn()
    setOnSesionExpirada(avisar)

    await expect(apiClient.post('/api/auth/login')).rejects.toThrow()

    expect(avisar).not.toHaveBeenCalled()
  })
})
