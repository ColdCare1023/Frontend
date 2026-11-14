import { describe, expect, it } from 'vitest'

import { nombreArchivoReporte } from '@/application/hooks/useReportesBPA'

const BASE = {
  device_id: null,
  fecha_desde: '2026-07-01T05:00:00Z',
  fecha_hasta: '2026-07-25T04:59:59Z',
  lecturas: [],
  alertas: [],
  registros_trazabilidad: [],
}

describe('nombreArchivoReporte', () => {
  it('un reporte completo lleva solo el periodo', () => {
    expect(nombreArchivoReporte(BASE, 'csv')).toBe('reporte-bpa-2026-07-01-2026-07-25.csv')
  })

  it('un reporte truncado lo dice en el nombre del archivo', () => {
    expect(nombreArchivoReporte({ ...BASE, truncado: true }, 'json')).toBe(
      'reporte-bpa-2026-07-01-2026-07-25-parcial.json',
    )
  })
})
