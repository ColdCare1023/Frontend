import { describe, expect, it } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { SerieTermica } from '@/domain/entities/SerieTermica'
import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import { errores } from '../contrato/validarOpenApi'

/**
 * El modo demostración debe hablar el mismo contrato que el backend del
 * backlog (HU-07/31/34/35/48): cada respuesta nueva se valida contra el
 * OpenAPI real (src/tests/contrato/openapi-backend.json).
 */
function config(url: string, params?: Record<string, unknown>, method = 'get', data?: unknown): InternalAxiosRequestConfig {
  return {
    headers: { get: () => null, set: () => {}, has: () => false, delete: () => {}, clear: () => {}, toJSON: () => ({}) },
    method,
    url,
    params,
    data: data === undefined ? undefined : JSON.stringify(data),
  } as unknown as InternalAxiosRequestConfig
}

const esquema = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` })

async function fallo(promesa: Promise<unknown>): Promise<number | undefined> {
  try {
    await promesa
    return undefined
  } catch (error) {
    return (error as { response?: AxiosResponse }).response?.status
  }
}

describe('demo: GET /api/lecturas/serie (HU-31)', () => {
  it('responde la serie agregada con la forma de SerieTermicaResponse', async () => {
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - 24 * 3_600_000)
    const { data, status } = await demoAdapter(
      config('/api/lecturas/serie', { device_id: 'FARM-01-CDL', desde: desde.toISOString(), hasta: hasta.toISOString(), bucket: 'auto' }),
    )
    expect(status).toBe(200)
    expect(errores(data, esquema('SerieTermicaResponse'))).toEqual([])
    const serie = data as SerieTermica
    expect(serie.bucket_segundos).toBe(60)
    expect(serie.bucket_automatico).toBe(true)
    expect(serie.buckets.length).toBeGreaterThan(100)
    // El total es la suma de los intervalos (lo que compara la interfaz).
    expect(serie.buckets.reduce((total, b) => total + b.lecturas, 0)).toBe(serie.total_lecturas)
    expect(serie.resumen.lecturas).toBe(serie.total_lecturas)
  })

  it('aplica las validaciones del backend: 404 y 422', async () => {
    expect(await fallo(demoAdapter(config('/api/lecturas/serie', { device_id: 'NO-EXISTE' })))).toBe(404)
    expect(await fallo(demoAdapter(config('/api/lecturas/serie', { device_id: 'FARM 01' })))).toBe(422)
    const ahora = Date.now()
    const invertido = { device_id: 'FARM-01-CDL', desde: new Date(ahora).toISOString(), hasta: new Date(ahora - 1000).toISOString() }
    expect(await fallo(demoAdapter(config('/api/lecturas/serie', invertido)))).toBe(422)
    expect(await fallo(demoAdapter(config('/api/lecturas/serie', { device_id: 'FARM-01-CDL', bucket: '5' })))).toBe(422)
    const largo = { device_id: 'FARM-01-CDL', desde: new Date(ahora - 400 * 86_400_000).toISOString(), hasta: new Date(ahora).toISOString() }
    expect(await fallo(demoAdapter(config('/api/lecturas/serie', largo)))).toBe(422)
    // 10 s en 7 días son 60 480 intervalos: más de 5000.
    const fino = { device_id: 'FARM-01-CDL', desde: new Date(ahora - 7 * 86_400_000).toISOString(), bucket: '10' }
    expect(await fallo(demoAdapter(config('/api/lecturas/serie', fino)))).toBe(422)
  })
})

describe('demo: GET /api/lecturas (HU-31/HU-34/HU-07)', () => {
  it('envía X-Total-Count con el total sin paginar', async () => {
    const respuesta = await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 10 }))
    expect(respuesta.data).toHaveLength(10)
    expect(Number(respuesta.headers['x-total-count'])).toBeGreaterThan(10)
    const siguiente = await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 10, offset: 10 }))
    expect((siguiente.data as LecturaTermica[])[0].id).not.toBe((respuesta.data as LecturaTermica[])[0].id)
  })

  it('cada lectura trae estado_riesgo, sin_hora, origen_hora y recibida_en como el backend', async () => {
    const { data } = await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 50 }))
    for (const lectura of data as LecturaTermica[]) {
      expect(errores(lectura, esquema('LecturaResponse'))).toEqual([])
      expect(lectura.estado_riesgo).toBeTruthy()
      expect(lectura.sin_hora).toBe(false)
      expect(lectura.origen_hora).toBe('nodo')
    }
  })
})

describe('demo: estado operativo y escenarios del simulador', () => {
  async function equipo(id = 'FARM-01-CDL'): Promise<Dispositivo> {
    const { data } = await demoAdapter(config('/api/dispositivos/estado-operativo', { todos: true }))
    return (data as Dispositivo[]).find((d) => d.id === id)!
  }

  it('HU-48: el buffer cumple BufferLittleFSResponse y la brecha queda abierta hasta recuperar', async () => {
    await demoAdapter(config('/api/demo/dispositivos/FARM-01-CDL/simulacion', undefined, 'post', { escenario: 'buffer_lleno' }))
    const lleno = await equipo()
    expect(errores(lleno.buffer_littlefs, esquema('BufferLittleFSResponse'))).toEqual([])
    expect(lleno.buffer_littlefs?.reportado_en).toBeTruthy()
    expect(lleno.buffer_littlefs?.brechas?.[0]).toMatchObject({ abierta: true, perdidas: 3, causa: 'buffer_agotado' })

    // La serie sigue cumpliendo el contrato con el episodio abierto.
    const { data } = await demoAdapter(config('/api/lecturas/serie', { device_id: 'FARM-01-CDL' }))
    expect(errores(data, esquema('SerieTermicaResponse'))).toEqual([])

    await demoAdapter(config('/api/demo/dispositivos/FARM-01-CDL/simulacion', undefined, 'post', { escenario: 'recuperar' }))
    const recuperado = await equipo()
    expect(recuperado.buffer_littlefs).toMatchObject({ pendientes: 0, desde: null, hasta: null })
    expect(recuperado.buffer_littlefs?.brechas?.every((b) => !b.abierta)).toBe(true)
  })

  it('HU-07: un arranque sin hora deja lecturas sin hora ni clasificación IA; al sincronizar se reanclan', async () => {
    await demoAdapter(config('/api/demo/dispositivos/FARM-01-CDL/simulacion', undefined, 'post', { escenario: 'sin_hora' }))
    const { data } = await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 1 }))
    const [ultima] = data as LecturaTermica[]
    expect(ultima).toMatchObject({ sin_hora: true, origen_hora: 'recepcion', time_quality: 'unsynced', nivel_riesgo: null })
    expect(ultima.estado_riesgo).toBe('sin_clasificacion_ia')
    expect(errores(ultima, esquema('LecturaResponse'))).toEqual([])

    await demoAdapter(config('/api/demo/dispositivos/FARM-01-CDL/simulacion', undefined, 'post', { escenario: 'recuperar' }))
    const lista = (await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 5 }))).data as LecturaTermica[]
    const reanclada = lista.find((l) => l.id === ultima.id)
    expect(reanclada).toMatchObject({ sin_hora: false, origen_hora: 'reconstruida' })
    expect(reanclada?.timestamp_estimado).toBeTruthy()
  })

  it('HU-35: la puerta simulada abierta sigue abierta y sumando; al cerrarla deja de estarlo', async () => {
    await demoAdapter(config('/api/demo/dispositivos/FARM-01-CDL/simulacion', undefined, 'post', { escenario: 'puerta_abierta' }))
    const abierta = ((await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 1 }))).data as LecturaTermica[])[0]
    expect(abierta.apertura_refrigerador).toBe(true)
    expect(abierta.apertura_continua_segundos).toBeGreaterThanOrEqual(240)

    await demoAdapter(config('/api/demo/dispositivos/FARM-01-CDL/simulacion', undefined, 'post', { escenario: 'puerta_cerrada' }))
    const cerrada = ((await demoAdapter(config('/api/lecturas', { device_id: 'FARM-01-CDL', limite: 1 }))).data as LecturaTermica[])[0]
    expect(cerrada.apertura_refrigerador).toBe(false)
    expect(cerrada.apertura_continua_segundos).toBeNull()
  })
})
