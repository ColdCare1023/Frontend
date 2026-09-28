import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { vi } from 'vitest'

import { apiClient } from '@/infrastructure/api/apiClient'
import type { Rol } from '@/domain/value-objects/Rol'

/**
 * JWT sin firma válida. El frontend solo decodifica el payload (la firma la
 * verifica el backend), así que para las pruebas basta un token bien formado.
 */
export function jwtFalso(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma-de-prueba`
}

/** Segundos de vida del token de pruebas, como el `exp` real del backend. */
export const VIGENCIA_TOKEN_S = 3600

export function tokenDe(rol: Rol, email = `${rol}@upc.pe`): string {
  return jwtFalso({
    sub: '11111111-1111-1111-1111-111111111111',
    email,
    rol,
    exp: Math.floor(Date.now() / 1000) + VIGENCIA_TOKEN_S,
  })
}

export interface PeticionCapturada {
  url: string
  method: string
  headers: Record<string, unknown>
  data: unknown
  /** Parámetros de consulta. Sin ellos no se puede afirmar sobre los filtros
   *  que el frontend envía de verdad al backend (fechas del reporte BPA,
   *  `device_id`, `limite`…), que es donde vive el contrato entre ambos. */
  params: Record<string, unknown>
}

type Respondedor = (config: AxiosRequestConfig) => { status?: number; data?: unknown }

/**
 * Sustituye el adaptador del `apiClient` real en vez de simular el módulo
 * entero. Así la petición atraviesa los interceptores de verdad — que es donde
 * vivía el defecto de la cabecera ausente en el cierre de sesión — y podemos
 * afirmar sobre lo que *realmente* saldría por la red.
 */
export function instalarAdaptadorFalso(responder: Respondedor = () => ({})) {
  const peticiones: PeticionCapturada[] = []
  const adaptadorPrevio = apiClient.defaults.adapter

  apiClient.defaults.adapter = vi.fn(async (config: AxiosRequestConfig) => {
    peticiones.push({
      url: config.url ?? '',
      method: (config.method ?? 'get').toLowerCase(),
      headers: { ...(config.headers as Record<string, unknown>) },
      data: config.data,
      params: { ...((config.params ?? {}) as Record<string, unknown>) },
    })
    const { status = 200, data = {} } = responder(config)
    const respuesta = {
      data,
      status,
      statusText: '',
      headers: {},
      config,
    } as AxiosResponse
    if (status >= 400) {
      const error = Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        response: respuesta,
        config,
        toJSON: () => ({}),
      })
      throw error
    }
    return respuesta
  })

  return {
    peticiones,
    ultima: () => peticiones[peticiones.length - 1],
    restaurar: () => {
      apiClient.defaults.adapter = adaptadorPrevio
    },
  }
}

/** Espera a que se vacíe la cola de microtasks (promesas ya resueltas). */
export const esperarMicrotasks = () => new Promise((resolver) => setTimeout(resolver, 0))
