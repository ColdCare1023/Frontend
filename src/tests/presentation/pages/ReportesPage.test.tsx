import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useReportesBPA = vi.hoisted(() => vi.fn())
// `importOriginal`: solo se sustituye el hook. `diasDeRango`,
// `validarRango` y `MAX_DIAS_RANGO_REPORTE` son funciones puras que replican
// las validaciones del backend; simularlas ocultaría justo lo que interesa
// comprobar.
vi.mock('@/application/hooks/useReportesBPA', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/application/hooks/useReportesBPA')>()),
  useReportesBPA,
}))

import { ReportesPage } from '@/presentation/pages/ReportesPage'

function montar(over: Record<string, unknown> = {}) {
  const acciones = {
    generar: vi.fn(),
    descargarJson: vi.fn(),
    descargarCsv: vi.fn(),
    descargarPdf: vi.fn(),
  }
  useReportesBPA.mockReturnValue({
    reporte: null,
    generando: false,
    error: null,
    descargandoPdf: false,
    ...acciones,
    ...over,
  })
  render(<ReportesPage />)
  return acciones
}

const REPORTE = {
  device_id: 'FARM-01-CDL',
  fecha_desde: '2026-07-01T00:00:00Z',
  fecha_hasta: '2026-07-25T00:00:00Z',
  lecturas: [],
  alertas: [],
  registros_trazabilidad: [],
}

describe('ReportesPage (RF-13, HU-38)', () => {
  beforeEach(() => useReportesBPA.mockReset())

  it('pide el periodo antes de generar el reporte', () => {
    montar()

    expect(screen.getByText(/periodo del reporte/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generar reporte/i })).toBeInTheDocument()
  })

  it('ofrece los tres formatos que exige RF-13 una vez generado', () => {
    // CSV y JSON para reproceso, PDF para el expediente que se entrega en una
    // fiscalización. Los tres, o el requisito no está cubierto.
    montar({ reporte: REPORTE })

    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument()
  })

  it('no ofrece descargas mientras no haya reporte generado', () => {
    montar({ reporte: null })

    expect(screen.queryByRole('button', { name: /pdf/i })).not.toBeInTheDocument()
  })

  it('muestra el error cuando la generación falla', () => {
    montar({ error: 'No hay datos en el periodo seleccionado' })

    expect(screen.getByText(/no se pudo generar el reporte/i)).toBeInTheDocument()
  })
})
