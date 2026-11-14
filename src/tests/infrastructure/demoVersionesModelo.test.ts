import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'

import type { VersionModeloIA } from '@/application/hooks/useVersionesModelo'
import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import { estadoDemo } from '@/infrastructure/demo/datosDemo'
import { reiniciarVersionesDemo } from '@/infrastructure/demo/versionesModeloDemo'
import { errores, esquemaPeticion } from '../contrato/validarOpenApi'

function config(over: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  return {
    headers: { get: () => null, set: () => {}, has: () => false, delete: () => {}, clear: () => {}, toJSON: () => ({}) } as unknown as InternalAxiosRequestConfig['headers'],
    method: 'get',
    url: '',
    ...over,
  } as InternalAxiosRequestConfig
}

async function estadoDeError(promesa: Promise<unknown>): Promise<{ status?: number; detail?: string }> {
  try {
    await promesa
    return {}
  } catch (error) {
    const respuesta = (error as AxiosError<{ detail: string }>).response
    return { status: respuesta?.status, detail: respuesta?.data.detail }
  }
}

const COMPLETA = {
  version: 'demo-4.0.0',
  model_hash: 'c'.repeat(64),
  feature_schema_version: '4',
  dataset_version: 'corridas-demo',
  scikit_learn_version: '1.9.0',
  python_version: '3.12',
  trained_at: '2026-11-01T09:30:00Z',
  horizonte_min: 30,
  metricas: {
    incidentes_evaluables: 12,
    sensibilidad_incidente: 0.9,
    ic95_inferior_sensibilidad: 0.6,
    falsas_alarmas_por_dia_sensor: 1,
    mediana_anticipacion_min: 8,
    ap_random_forest: 0.7,
    ap_mejor_baseline: 0.5,
  },
  particiones: { entrenamiento: ['c1'], prueba: ['c2'], separacion_min: 60 },
}

/** HU-46 en la demostración: mismo contrato y mismas reglas que el backend. */
describe('demo: versionado del modelo (HU-46)', () => {
  beforeEach(() => reiniciarVersionesDemo())

  it('lista la versión experimental sembrada como no activable, con sus motivos', async () => {
    const { data } = await demoAdapter(config({ url: '/api/ia/modelo/versiones' }))
    const [semilla] = data as VersionModeloIA[]
    expect(semilla).toMatchObject({ version: 'demo-3.0.0', activa: false, activable: false })
    expect(semilla.motivos_bloqueo).toEqual(expect.arrayContaining(['falta el horizonte H de la etiqueta']))
  })

  it('activar una versión no registrada responde 404 y queda en la bitácora', async () => {
    const error = await estadoDeError(demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/no-existe/activar' })))
    expect(error).toMatchObject({ status: 404, detail: expect.stringContaining('no está registrada') })
    expect(estadoDemo.auditoria[0]).toMatchObject({ accion: 'ACTIVAR_VERSION_MODELO_IA_RECHAZADO', resultado: 'fallido' })
  })

  it('activar sin H, particiones ni métricas responde 409 con el motivo', async () => {
    const error = await estadoDeError(demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-3.0.0/activar' })))
    expect(error.status).toBe(409)
    expect(error.detail).toMatch(/no puede activarse: falta el horizonte H/)
  })

  it('registra (201), rechaza el duplicado (409) y activa una versión completa', async () => {
    expect(errores(COMPLETA, esquemaPeticion('post', '/api/ia/modelo/versiones'))).toEqual([])
    const alta = await demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones', data: JSON.stringify(COMPLETA) }))
    expect(alta.status).toBe(201)
    expect(alta.data).toMatchObject({ version: 'demo-4.0.0', activa: false, activable: true, motivos_bloqueo: [] })

    const duplicada = await estadoDeError(demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones', data: JSON.stringify(COMPLETA) })))
    expect(duplicada).toMatchObject({ status: 409, detail: 'La versión demo-4.0.0 ya está registrada' })

    const activada = await demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-4.0.0/activar' }))
    expect(activada.data).toMatchObject({ version: 'demo-4.0.0', activa: true })
    expect(estadoDemo.auditoria[0]).toMatchObject({ accion: 'ACTIVAR_VERSION_MODELO_IA', resultado: 'exitoso' })
  })

  it('rechaza campos que el backend no admite (422)', async () => {
    const error = await estadoDeError(
      demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones', data: JSON.stringify({ ...COMPLETA, version: 'x', extra: 1 }) })),
    )
    expect(error.status).toBe(422)
  })

  it('HU-47: la inferencia demo cruza la versión con el versionado (no aprobada)', async () => {
    const lectura = estadoDemo.lecturas.find((l) => l.estado_inferencia === 'completada' && l.modelo_version)!
    const { data } = await demoAdapter(config({ url: `/api/ia/inferencia/${lectura.id}` }))
    expect(data).toMatchObject({ version_era_activa_y_aprobada_en_ese_momento: false, version_activa_en_ese_momento: null, ia_experimental: true })
  })
})
