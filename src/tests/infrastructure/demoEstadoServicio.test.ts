import { afterEach, describe, expect, it } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import { normalizarEstadoServicio } from '@/domain/entities/EstadoServicio'
import { crearTokenDemo } from '@/infrastructure/demo/datosDemo'
import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import { reiniciarVersionesDemo, simularModeloIADemo } from '@/infrastructure/demo/versionesModeloDemo'

/** `GET /health/detalle` en la demo: misma regla de acceso que el backend (solo administrador). */
function config(email: string | null): InternalAxiosRequestConfig {
  const token = email ? `Bearer ${crearTokenDemo(email)}` : null
  return {
    headers: {
      get: (nombre: string) => (nombre.toLowerCase() === 'authorization' ? token : null),
      set: () => {},
      has: () => false,
      delete: () => {},
      clear: () => {},
      toJSON: () => ({}),
    } as unknown as InternalAxiosRequestConfig['headers'],
    method: 'get',
    url: '/health/detalle',
  } as InternalAxiosRequestConfig
}

async function pedir(email: string | null): Promise<{ status?: number; data?: Record<string, unknown> }> {
  try {
    const r = (await demoAdapter(config(email))) as AxiosResponse<Record<string, unknown>>
    return { status: r.status, data: r.data }
  } catch (error) {
    return { status: (error as { response?: { status?: number } }).response?.status }
  }
}

describe('demo — Estado del servicio', () => {
  afterEach(() => reiniciarVersionesDemo())

  it('el administrador ve un servicio sano: 1 worker, respaldos al día y sin versión activa de IA', async () => {
    const { status, data } = await pedir('admin@demo.pe')
    expect(status).toBe(200)
    const e = normalizarEstadoServicio(data)!
    expect(e.status).toBe('ok')
    expect(e.alembic_revision).toBe(e.alembic_head)
    expect(e.arranque).toEqual({ lanzador: 'scripts.arrancar_api', workers: 1 })
    expect(e.mqtt).toMatchObject({ habilitado: true, conectado: true, tarea_activa: true })
    expect(e.proxy).toEqual({ forwarded_allow_ips: '*', esquema: 'https', x_forwarded_for_presente: true, ip_cliente_publica: true })
    expect(e.respaldos).toMatchObject({ vigilancia_activa: true, estado: null })
    expect(Date.parse(e.respaldos!.ultimo_completado!)).toBeLessThanOrEqual(Date.now())
    expect(e.modelo_ia).toMatchObject({ version_activa_registrada: null, preventivo: { modo: 'desactivado' }, en_uso: { modelo: 'regla_2_8' } })
  })

  it.each(['farmaceutico@demo.pe', 'tecnico@demo.pe', 'auditor@demo.pe'])('%s recibe 403', async (email) => {
    expect((await pedir(email)).status).toBe(403)
  })

  it('sin sesión, 401', async () => {
    expect((await pedir(null)).status).toBe(401)
  })

  it('un modelo de IA rechazado degrada el estado, como en el backend', async () => {
    simularModeloIADemo({ estado: 'rechazado', motivo: 'checksum_invalido' })
    const e = normalizarEstadoServicio((await pedir('admin@demo.pe')).data)!
    expect(e.status).toBe('degradado')
    expect(e.modelo_ia).toMatchObject({ disponible: false, motivo_codigo: 'checksum_invalido' })
  })
})
