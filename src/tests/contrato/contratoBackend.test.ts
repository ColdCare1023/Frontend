import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/sse/sseClient', () => ({ suscribirseTiempoReal: () => () => {} }))

import { useDispositivos } from '@/application/hooks/useDispositivos'
import { obtenerEvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import { instalarAdaptadorFalso } from '../ayudas'
import { errores, esquemaPeticion, existeRuta } from './validarOpenApi'

/**
 * B-12/B-13: pruebas de contrato frontend ↔ backend. Cada petición que emiten
 * los formularios de Dispositivos se valida contra el OpenAPI REAL del backend
 * (los esquemas Pydantic rechazan campos extra con 422). El modo demostración
 * aceptaba cualquier cosa, y por eso «sensores», «valid_until» y
 * «margen_aviso_dias» llegaron a producción sin que ninguna prueba fallara.
 */
describe('contrato con el backend — Dispositivos', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  async function montar() {
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.method === 'post' && config.url === '/api/dispositivos') {
        return { status: 201, data: { id: 'FARM-09', credencial: { device_id: 'FARM-09', token: 't', generado_en: '2026-10-26T00:00:00Z', sesion_broker_cerrada: null } } }
      }
      if (config.url?.endsWith('/credenciales/rotar')) return { data: { device_id: 'FARM-09', token: 't', generado_en: '', sesion_broker_cerrada: null } }
      return { data: [] }
    })
    const hook = renderHook(() => useDispositivos())
    await waitFor(() => expect(hook.result.current.cargando).toBe(false))
    return hook
  }

  it('cada formulario envía exactamente lo que acepta el backend', async () => {
    const { result } = await montar()
    await act(async () => {
      await result.current.registrarDispositivo({ device_id: 'FARM-09', nombre: 'Refri 1', ubicacion: 'Botica', sensores: ['DS18B20', 'SHT31'] })
      await result.current.registrarCalibracion('FARM-09', '2026-10-01', 'CERT-001', 'ok', 12)
      await result.current.actualizarInstalacion('FARM-09', 'Estante 2', '2026-10-02', undefined)
      await result.current.actualizarResponsable('FARM-09', 'QF Ana', 'ana@farmacia.pe', '+51999999999')
      await result.current.rotarCredencial('FARM-09', 'Rotación programada')
      await result.current.revocarCredencial('FARM-09', 'Equipo robado')
      await result.current.confirmarBroker('FARM-09', 'Usuario creado en la consola')
      await result.current.darDeBaja('FARM-09', 'reemplazo', 'Falla', undefined)
    })

    const escrituras = adaptador.peticiones.filter((p) => p.method !== 'get')
    expect(escrituras).toHaveLength(8)
    for (const peticion of escrituras) {
      const cuerpo = JSON.parse((peticion.data as string | undefined) ?? '{}')
      expect({ ruta: `${peticion.method} ${peticion.url}`, errores: errores(cuerpo, esquemaPeticion(peticion.method!, peticion.url!)) })
        .toEqual({ ruta: `${peticion.method} ${peticion.url}`, errores: [] })
    }
  })

  it('el validador detecta los campos que antes provocaban 422', () => {
    const alta = esquemaPeticion('post', '/api/dispositivos')
    expect(errores({ device_id: 'FARM-09', sensores: ['DS18B20'] }, alta)).toContain(
      '$.sensores: campo no admitido (el backend responde 422)',
    )
    const calibracion = esquemaPeticion('patch', '/api/dispositivos/FARM-09/calibracion')
    expect(errores({ fecha_calibracion: '2026-10-01', numero_certificado: 'C', valid_until: '2027-10-01' }, calibracion))
      .toContain('$.valid_until: campo no admitido (el backend responde 422)')
  })

  it('la evidencia de inferencia usa la ruta del backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({
      data: {
        lectura_id: 'L1', device_id: 'FARM-09', timestamp_inferencia: '2026-10-26T00:00:00Z', modelo_version: 'v3',
        vector_features: { temperatura_interna: 5 }, probabilidades_por_clase: { normal: 0.9 }, clasificacion_final: 'normal',
        confianza: 0.9, origen_clasificacion: 'random_forest', version_era_activa_y_aprobada_en_ese_momento: null,
        estado_inferencia: 'completada', excursion_confirmada: false, riesgo_efectivo: 'normal', ia_experimental: true,
      },
    }))
    const evidencia = await obtenerEvidenciaInferencia('L1')

    const peticion = adaptador.peticiones[0]
    expect(existeRuta('get', peticion.url!)).toBe(true)
    expect(evidencia).toMatchObject({ reading_id: 'L1', model_class: 'normal', effective_risk: 'normal', datos_simulados: true })
  })
})
