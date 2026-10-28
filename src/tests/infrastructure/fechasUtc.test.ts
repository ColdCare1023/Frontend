import { afterEach, describe, expect, it } from 'vitest'

import { apiClient } from '@/infrastructure/api/apiClient'
import { normalizarFechasUtc } from '@/infrastructure/api/fechasUtc'
import { instalarAdaptadorFalso } from '../ayudas'

/**
 * El backend trabaja en UTC; con SQLite (desarrollo local) omite la zona y el
 * navegador leía esas fechas como hora local: en Lima, cinco horas de desfase
 * en cada lectura del sensor.
 */
describe('normalizarFechasUtc', () => {
  it('declara UTC en fecha-hora ISO sin zona, con o sin fracción de segundo', () => {
    expect(normalizarFechasUtc('2026-10-28T15:09:45')).toBe('2026-10-28T15:09:45Z')
    expect(normalizarFechasUtc('2026-10-28T15:09:48.542278')).toBe('2026-10-28T15:09:48.542278Z')
    expect(normalizarFechasUtc('2026-10-28T15:09')).toBe('2026-10-28T15:09Z')
    expect(new Date(normalizarFechasUtc('2026-10-28T15:09:45')).toISOString()).toBe('2026-10-28T15:09:45.000Z')
  })

  it('respeta las fechas que ya traen zona, los días de calendario y el texto', () => {
    for (const valor of ['2026-10-28T15:09:45Z', '2026-10-28T15:09:45+00:00', '2026-10-28T10:09:45-05:00', '2026-12-01', 'ESP32-001', '']) {
      expect(normalizarFechasUtc(valor)).toBe(valor)
    }
  })

  it('recorre objetos y listas anidados sin tocar números, booleanos ni nulos', () => {
    const datos = normalizarFechasUtc({
      lecturas: [{ timestamp: '2026-10-28T15:10:26', temperatura_interna: 4.72, apertura_refrigerador: false }],
      incidencias: [{ detectado_en: '2026-10-28T15:09:48.542278Z', recuperado_en: null }],
      fecha_proxima_calibracion: '2027-01-15',
    })
    expect(datos).toEqual({
      lecturas: [{ timestamp: '2026-10-28T15:10:26Z', temperatura_interna: 4.72, apertura_refrigerador: false }],
      incidencias: [{ detectado_en: '2026-10-28T15:09:48.542278Z', recuperado_en: null }],
      fecha_proxima_calibracion: '2027-01-15',
    })
  })

  it('no altera contenidos binarios (descargas de reportes)', () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    expect(normalizarFechasUtc(pdf)).toBe(pdf)
  })
})

describe('apiClient con fechas sin zona', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('entrega a las pantallas instantes en UTC', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [{ device_id: 'ESP32-001', timestamp: '2026-10-28T15:09:45' }] }))

    const { data } = await apiClient.get<Array<{ timestamp: string }>>('/api/lecturas')

    expect(data[0].timestamp).toBe('2026-10-28T15:09:45Z')
  })
})
