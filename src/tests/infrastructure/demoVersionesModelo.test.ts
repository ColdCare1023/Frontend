import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'

import { aClasificacionPreventiva, type EstadoPreventivoApi } from '@/application/hooks/useClasificacionPreventiva'
import { interpretarModeloNoDisponible } from '@/application/hooks/useModeloIA'
import type { VersionModeloIA } from '@/application/hooks/useVersionesModelo'
import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import { estadoDemo } from '@/infrastructure/demo/datosDemo'
import { reiniciarVersionesDemo, simularModeloIADemo } from '@/infrastructure/demo/versionesModeloDemo'
import { errores, esquemaPeticion } from '../contrato/validarOpenApi'

function config(over: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  return {
    headers: { get: () => null, set: () => {}, has: () => false, delete: () => {}, clear: () => {}, toJSON: () => ({}) } as unknown as InternalAxiosRequestConfig['headers'],
    method: 'get',
    url: '',
    ...over,
  } as InternalAxiosRequestConfig
}

async function estadoDeError(promesa: Promise<unknown>): Promise<{ status?: number; detail?: string; data?: unknown }> {
  try {
    await promesa
    return {}
  } catch (error) {
    const respuesta = (error as AxiosError<{ detail: string }>).response
    return { status: respuesta?.status, detail: respuesta?.data.detail, data: respuesta?.data }
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

  it('P-12: desactivar la versión activa (200) vuelve a dejar la preventiva sin versión activa', async () => {
    await demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones', data: JSON.stringify(COMPLETA) }))
    await demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-4.0.0/activar' }))
    const cuerpo = { motivo: 'Vuelta atrás por falsas alarmas' }
    expect(errores(cuerpo, esquemaPeticion('post', '/api/ia/modelo/versiones/demo-4.0.0/desactivar'))).toEqual([])
    const respuesta = await demoAdapter(
      config({ method: 'post', url: '/api/ia/modelo/versiones/demo-4.0.0/desactivar', data: JSON.stringify(cuerpo) }),
    )
    expect(respuesta.status).toBe(200)
    expect(respuesta.data).toMatchObject({ version: 'demo-4.0.0', activa: false, desactivada_en: expect.any(String) })
    expect(estadoDemo.auditoria[0]).toMatchObject({
      accion: 'DESACTIVAR_VERSION_MODELO_IA',
      resultado: 'exitoso',
      detalle: { version: 'demo-4.0.0', motivo: cuerpo.motivo },
    })
    const { data: lista } = await demoAdapter(config({ url: '/api/ia/modelo/versiones' }))
    expect((lista as VersionModeloIA[]).some((v) => v.activa)).toBe(false)
    const { data: preventivo } = await demoAdapter(config({ url: '/api/ia/preventivo' }))
    expect(preventivo).toMatchObject({ disponible: false, motivo_codigo: 'sin_version_activa_registrada', version_activa_registrada: null })

    // Una segunda llamada (o la concurrente) ya no encuentra la versión activa: 409.
    const otra = await estadoDeError(
      demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-4.0.0/desactivar', data: JSON.stringify(cuerpo) })),
    )
    expect(otra).toMatchObject({ status: 409, detail: 'version_no_activa' })
  })

  it('P-12: desactivar responde 404 si no existe, 409 si no es la activa y 422 con un motivo no válido', async () => {
    const motivo = JSON.stringify({ motivo: 'Motivo suficientemente largo' })
    const auditadas = estadoDemo.auditoria.length
    expect(await estadoDeError(demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/no-existe/desactivar', data: motivo }))))
      .toMatchObject({ status: 404 })
    expect(await estadoDeError(demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-3.0.0/desactivar', data: motivo }))))
      .toMatchObject({ status: 409, detail: 'version_no_activa' })
    for (const cuerpo of [{ motivo: 'corto' }, { motivo: 'x'.repeat(501) }, {}, { motivo: 'Motivo suficientemente largo', extra: 1 }]) {
      const error = await estadoDeError(
        demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-3.0.0/desactivar', data: JSON.stringify(cuerpo) })),
      )
      expect(error.status).toBe(422)
    }
    // Los rechazos no desactivan nada ni dejan una desactivación en la bitácora.
    expect(estadoDemo.auditoria.slice(0, estadoDemo.auditoria.length - auditadas).some((a) => a.accion === 'DESACTIVAR_VERSION_MODELO_IA')).toBe(false)
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

/** HU-16 / HU-20 / HU-47 en la demostración: los estados nuevos del backend. */
describe('demo: estado del modelo y de la clasificación preventiva', () => {
  beforeEach(() => reiniciarVersionesDemo())

  it('GET /api/ia/preventivo: sin versión activa en el registro, fuera de operación (como el backend en modo activo)', async () => {
    const { data } = await demoAdapter(config({ url: '/api/ia/preventivo' }))
    expect(data).toMatchObject({
      modo: 'activo', disponible: false, motivo_codigo: 'sin_version_activa_registrada',
      version_activa_registrada: null, es_version_activa_registrada: false, datos_simulados: true,
    })
    expect(aClasificacionPreventiva(data as EstadoPreventivoApi)).toMatchObject({ operativa: false, artefactoGobernado: 'preventivo' })
  })

  it('activar una versión completa pone en operación la clasificación preventiva', async () => {
    await demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones', data: JSON.stringify(COMPLETA) }))
    await demoAdapter(config({ method: 'post', url: '/api/ia/modelo/versiones/demo-4.0.0/activar' }))
    const { data } = await demoAdapter(config({ url: '/api/ia/preventivo' }))
    expect(data).toMatchObject({ disponible: true, version: 'demo-4.0.0', version_activa_registrada: 'demo-4.0.0', es_version_activa_registrada: true })
    expect(aClasificacionPreventiva(data as EstadoPreventivoApi).operativa).toBe(true)
  })

  it('GET /api/ia/modelo reproduce el 503 rechazado por verificación con su motivo', async () => {
    simularModeloIADemo({ estado: 'rechazado', motivo: 'checksum_invalido' })
    const error = await estadoDeError(demoAdapter(config({ url: '/api/ia/modelo' })))
    expect(error.status).toBe(503)
    expect(error.data).toMatchObject({ motivo: 'checksum_invalido', rechazado_por_verificacion: true })
    expect(interpretarModeloNoDisponible(error.data)).toEqual({ estado: 'rechazado', motivo: 'checksum_invalido' })
  })

  it('GET /api/ia/modelo reproduce el 503 de modelo no entrenado', async () => {
    simularModeloIADemo({ estado: 'no_entrenado', motivo: 'sin_metricas' })
    const error = await estadoDeError(demoAdapter(config({ url: '/api/ia/modelo' })))
    expect(error).toMatchObject({ status: 503, data: { motivo: 'sin_metricas', rechazado_por_verificacion: false } })
    expect(interpretarModeloNoDisponible(error.data)).toEqual({ estado: 'no_entrenado', motivo: 'sin_metricas' })
  })

  it('por defecto el modelo de la demo está disponible', async () => {
    const respuesta = await demoAdapter(config({ url: '/api/ia/modelo' }))
    expect(respuesta.status).toBe(200)
  })

  it('HU-47: la evidencia demo declara la política operativa, como el backend', async () => {
    const clasificada = estadoDemo.lecturas.find((l) => l.estado_inferencia === 'completada' && l.modelo_version)!
    const { data } = await demoAdapter(config({ url: `/api/ia/inferencia/${clasificada.id}` }))
    expect(data).toMatchObject({ politica_operativa: 'experimental', horizonte_min: null, feature_schema_version: null })
    // Lectura que el modelo no clasificó (p. ej. sin hora sincronizada): no hay política que declarar.
    const sinInferencia = { ...clasificada, id: 'demo-sin-inferencia', estado_inferencia: 'omitida' as const, modelo_version: null }
    estadoDemo.lecturas.push(sinInferencia)
    try {
      const { data: otra } = await demoAdapter(config({ url: '/api/ia/inferencia/demo-sin-inferencia' }))
      expect(otra).toMatchObject({ politica_operativa: null, version_era_activa_y_aprobada_en_ese_momento: null })
    } finally {
      estadoDemo.lecturas.splice(estadoDemo.lecturas.indexOf(sinInferencia), 1)
    }
  })
})
