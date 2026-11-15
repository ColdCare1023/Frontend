import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import { calcularSerieDemo } from '@/infrastructure/demo/serieDemo'
import type { HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { CadenaTrazabilidad } from '@/domain/entities/RegistroTrazabilidad'
import type { SerieTermica } from '@/domain/entities/SerieTermica'
import type { RegistroAuditoria } from '@/domain/entities/Usuario'

/**
 * La demo debe soportar cada campo y endpoint nuevo del backend del track
 * «registros» (HU-26/28/36/37/42/49/50), con las mismas reglas.
 */
function config(over: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  return {
    headers: { get: () => null, set: () => {}, has: () => false, delete: () => {}, clear: () => {}, toJSON: () => ({}) } as unknown as InternalAxiosRequestConfig['headers'],
    method: 'get',
    url: '',
    ...over,
  } as InternalAxiosRequestConfig
}

async function fallo(over: Partial<InternalAxiosRequestConfig>): Promise<number | undefined> {
  try {
    await demoAdapter(config(over))
    return 200
  } catch (error) {
    return (error as { response?: { status?: number } }).response?.status
  }
}

describe('demo — HU-36: historial paginado y serie del periodo completo', () => {
  it('GET /api/lecturas pagina con offset y declara X-Total-Count', async () => {
    const params = { device_id: 'FARM-01-CDL', limite: '10', offset: '0' }
    const primera = await demoAdapter(config({ url: '/api/lecturas', params }))
    const segunda = await demoAdapter(config({ url: '/api/lecturas', params: { ...params, offset: '10' } }))
    const total = Number((primera.headers as Record<string, string>)['x-total-count'])
    expect(total).toBeGreaterThan(20)
    expect((primera.data as LecturaTermica[])).toHaveLength(10)
    const ids = new Set((primera.data as LecturaTermica[]).map((l) => l.id))
    expect((segunda.data as LecturaTermica[]).some((l) => ids.has(l.id))).toBe(false)
  })

  it('GET /api/lecturas/serie agrega 24 h por defecto con intervalo automático y resumen exacto', async () => {
    const respuesta = await demoAdapter(config({ url: '/api/lecturas/serie', params: { device_id: 'FARM-01-CDL' } }))
    const serie = respuesta.data as SerieTermica
    expect(Date.parse(serie.hasta) - Date.parse(serie.desde)).toBe(24 * 3_600_000)
    expect(serie.bucket_segundos).toBe(60)
    expect(serie.bucket_automatico).toBe(true)
    expect(serie.buckets.length).toBeGreaterThan(0)
    expect(serie.buckets.length).toBeLessThanOrEqual(1500)
    expect(serie.resumen.lecturas).toBe(serie.total_lecturas)
    expect(serie.buckets.reduce((s, b) => s + b.lecturas, 0)).toBe(serie.total_lecturas)
    for (const b of serie.buckets) expect(Date.parse(b.inicio) % 60_000).toBe(0)
  })

  it('valida como el backend: 404 equipo, 422 rango invertido, > 366 días e intervalo fuera de límites', async () => {
    expect(await fallo({ url: '/api/lecturas/serie', params: { device_id: 'NO-EXISTE' } })).toBe(404)
    expect(await fallo({ url: '/api/lecturas/serie', params: { device_id: 'FARM-01-CDL', desde: '2026-07-02T00:00:00Z', hasta: '2026-07-01T00:00:00Z' } })).toBe(422)
    expect(await fallo({ url: '/api/lecturas/serie', params: { device_id: 'FARM-01-CDL', desde: '2025-01-01T00:00:00Z', hasta: '2026-07-01T00:00:00Z' } })).toBe(422)
    expect(await fallo({ url: '/api/lecturas/serie', params: { device_id: 'FARM-01-CDL', bucket: '5' } })).toBe(422)
  })

  it('serie: 24 h a 10 s y 7 días a 30 s se dibujan completas (sin recorte)', () => {
    const ahora = Date.parse('2026-11-14T12:00:00Z')
    const lecturas = (paso: number, n: number): LecturaTermica[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `l-${i}`, device_id: 'X', timestamp: new Date(ahora - (n - 1 - i) * paso * 1000).toISOString(),
        temperatura_interna: i === Math.floor(n / 2) ? 9.5 : 5, temperatura_ambiental: 20, humedad_ambiental: 60,
        apertura_refrigerador: false, duracion_apertura_segundos: 0, estado_conectividad: 'online', nivel_riesgo: 'normal',
        confianza_ia: null, modelo_version: null, origen_clasificacion: null, estado_inferencia: null, motivo_no_inferencia: null,
        excursion_confirmada: i === Math.floor(n / 2), riesgo_efectivo: 'normal',
      }))
    const equipo = { id: 'X', intervalo_reporte_segundos: 10 }
    const dia = calcularSerieDemo({ device_id: 'X', desde: new Date(ahora - 86_400_000).toISOString(), hasta: new Date(ahora).toISOString() }, equipo, lecturas(10, 8640), ahora)
    expect(dia.ok && dia.serie.total_lecturas).toBe(8640)
    expect(dia.ok && dia.serie.resumen.temperatura_interna.max).toBe(9.5)
    expect(dia.ok && dia.serie.brechas).toEqual([])
    const semana = calcularSerieDemo({ device_id: 'X', desde: new Date(ahora - 7 * 86_400_000).toISOString(), hasta: new Date(ahora).toISOString() }, { id: 'X', intervalo_reporte_segundos: 30 }, lecturas(30, 20160), ahora)
    expect(semana.ok && semana.serie.total_lecturas).toBe(20160)
    expect(semana.ok && semana.serie.bucket_segundos).toBe(600)
    expect(semana.ok && semana.serie.resumen.excursiones).toBe(1)
  })
})

describe('demo — HU-26/HU-37: cadenas y verificación', () => {
  it('lista las cadenas de equipos y la de SISTEMA', async () => {
    const cadenas = (await demoAdapter(config({ url: '/api/trazabilidad/cadenas' }))).data as CadenaTrazabilidad[]
    expect(cadenas.find((c) => c.chain_id === 'SISTEMA')?.es_sistema).toBe(true)
    expect(cadenas.find((c) => c.chain_id === 'FARM-01-CDL')?.total_registros).toBeGreaterThan(0)
  })

  it('verifica solo la cadena pedida y responde 404 a una sin registros', async () => {
    const respuesta = await demoAdapter(config({ url: '/api/trazabilidad/verificar', params: { chain_id: 'SISTEMA' } }))
    expect(respuesta.data).toMatchObject({ chain_id: 'SISTEMA', estado: 'integra' })
    expect(await fallo({ url: '/api/trazabilidad/verificar', params: { chain_id: 'SIN-CADENA' } })).toBe(404)
  })

  it('el segmento informa estado por registro', async () => {
    const respuesta = await demoAdapter(config({
      url: '/api/trazabilidad/verificar-dispositivo',
      params: { device_id: 'FARM-01-CDL', desde: new Date(Date.now() - 7 * 86_400_000).toISOString(), hasta: new Date().toISOString() },
    }))
    const datos = respuesta.data as { estado: string; registros_del_dispositivo: Array<{ estado: string }> }
    expect(datos.estado).toBe('integra')
    expect(datos.registros_del_dispositivo.every((r) => r.estado === 'integro')).toBe(true)
  })
})

describe('demo — HU-42/HU-50: bitácora con resultado real y exportación', () => {
  it('filtra por resultado y registra el bloqueo como UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO', async () => {
    const bloqueados = (await demoAdapter(config({ url: '/api/auditoria', params: { resultado: 'bloqueado' } }))).data as RegistroAuditoria[]
    expect(bloqueados.length).toBeGreaterThan(0)
    expect(bloqueados.every((r) => r.resultado === 'bloqueado')).toBe(true)
    expect(bloqueados.some((r) => r.accion === 'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO')).toBe(true)
    const todos = (await demoAdapter(config({ url: '/api/auditoria', params: { limite: '1000' } }))).data as RegistroAuditoria[]
    expect(todos.some((r) => r.accion === 'BLOQUEO_TEMPORAL')).toBe(false)
  })

  it('exporta CSV con BOM, alcance en la primera línea, Content-Disposition y deja la exportación auditada', async () => {
    const respuesta = await demoAdapter(config({ url: '/api/auditoria/exportar', params: { resultado: 'denegado' } }))
    const cabeceras = respuesta.headers as Record<string, string>
    expect(cabeceras['content-disposition']).toMatch(/^attachment; filename="bitacora_\d{8}T\d{6}Z\.csv"$/)
    const texto = await (respuesta.data as Blob).text()
    const lineas = texto.replace(/^\uFEFF/, '').split('\r\n')
    expect(lineas[0]).toMatch(/^# ColdCare .*No constituye una certificación de seguridad/)
    expect(lineas[1]).toBe('fecha_utc,id,usuario_id,accion,resultado,recurso,ip_origen,detalle')
    expect(lineas.slice(2).filter(Boolean).every((l) => l.split(',')[4] === 'denegado')).toBe(true)
    const exportaciones = (await demoAdapter(config({ url: '/api/auditoria', params: { accion: 'EXPORTAR_BITACORA' } }))).data as RegistroAuditoria[]
    expect(exportaciones.length).toBeGreaterThan(0)
  })
})

describe('demo — HU-49 y HU-28', () => {
  it('el historial de configuración trae categoría, vigencia, origen y actor, y filtra por categoría', async () => {
    const todos = (await demoAdapter(config({ url: '/api/dispositivos/FARM-01-CDL/historial-configuracion' }))).data as HistorialConfiguracion[]
    const ubicaciones = todos.filter((c) => c.campo_base === 'ubicacion')
    expect(ubicaciones).toHaveLength(2)
    // La más reciente sigue vigente; la anterior terminó cuando llegó la nueva.
    expect(ubicaciones[0].vigente_hasta).toBeNull()
    expect(ubicaciones[1].vigente_hasta).toBe(ubicaciones[0].created_at)
    const intervalo = todos.find((c) => c.campo_base === 'intervalo_reporte_segundos')!
    expect(intervalo).toMatchObject({ origen: 'administrador', categoria: 'intervalo', actor_nombre: 'Administrador Demo' })
    const calibracion = (await demoAdapter(config({ url: '/api/dispositivos/FARM-01-CDL/historial-configuracion', params: { categoria: 'calibracion' } }))).data as HistorialConfiguracion[]
    expect(calibracion.length).toBeGreaterThan(0)
    expect(calibracion.every((c) => c.categoria === 'calibracion')).toBe(true)
  })

  it('el alta deja la ubicación y los sensores iniciales en el historial, con origen «alta»', async () => {
    const alta = await demoAdapter(config({
      method: 'post',
      url: '/api/dispositivos',
      data: JSON.stringify({ device_id: 'FARM-ALTA-P2', nombre: 'Equipo nuevo', ubicacion: 'Estante 7', sensores_habilitados: ['DS18B20', 'SHT31'] }),
    }))
    expect(alta.status).toBe(201)
    const filas = (await demoAdapter(config({ url: '/api/dispositivos/FARM-ALTA-P2/historial-configuracion' }))).data as HistorialConfiguracion[]
    expect(filas.map((f) => [f.campo, f.valor_anterior, f.valor_nuevo, f.origen]).sort()).toEqual([
      ['sensores_habilitados (alta)', null, 'DS18B20, SHT31', 'alta'],
      ['ubicacion (alta)', null, 'Estante 7', 'alta'],
    ])
    expect(filas.find((f) => f.campo_base === 'sensores_habilitados')?.categoria).toBe('sensores')
  })

  it('la rectificación hereda lo no enviado y rechaza un cambio vacío', async () => {
    const { estadoDemo } = await import('@/infrastructure/demo/datosDemo')
    const original = estadoDemo.acciones.find((a) => a.decision && a.justificacion && !estadoDemo.acciones.some((b) => b.corrige_accion_id === a.id))!
    const url = `/api/alertas/acciones-correctivas/${original.id}/rectificar`
    expect(await fallo({ method: 'post', url, data: JSON.stringify({ motivo_rectificacion: 'Sin cambios reales.' }) })).toBe(422)
    const respuesta = await demoAdapter(config({ method: 'post', url, data: JSON.stringify({ justificacion: 'Justificación corregida', motivo_rectificacion: 'Se corrige la justificación.' }) }))
    expect(respuesta.data).toMatchObject({ justificacion: 'Justificación corregida', decision: original.decision, descripcion: original.descripcion, corrige_accion_id: original.id })
  })
})
