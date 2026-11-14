import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { fechaRelativa } from '@/presentation/pages/reportes/formatoReporte'

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

  it('avisa cuando el backend truncó el reporte: no se presenta como completo', () => {
    montar({
      reporte: { ...REPORTE, truncado: true, lecturas_truncadas: true, limite_por_coleccion: 10000 },
    })

    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveTextContent(/reporte incompleto/i)
    expect(aviso).toHaveTextContent(/10[.,\s]?000/)
    expect(aviso).toHaveTextContent(/lecturas/i)
  })

  it('un reporte completo no muestra aviso de truncamiento', () => {
    montar({ reporte: { ...REPORTE, truncado: false } })

    expect(screen.queryByText(/reporte incompleto/i)).not.toBeInTheDocument()
  })

  it('ofrece los tres formatos que exige RF-13 una vez generado', () => {
    // Mantener disponibles los tres formatos de descarga del reporte.
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

  it('genera la vista previa al entrar con los últimos 7 días', () => {
    const { generar } = montar()
    expect(generar).toHaveBeenCalledTimes(1)
    expect(generar).toHaveBeenCalledWith(fechaRelativa(-6), fechaRelativa(0), undefined, { origen: 'auto' })
  })

  it('los atajos ajustan las fechas sin generar', async () => {
    const { generar } = montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '30 días' }))
    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/periodo seleccionado: 30 días/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Este mes' }))
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true')
    expect(generar).toHaveBeenCalledTimes(1)
  })

  it('el PDF descarga el periodo del reporte mostrado y avisa si se editó', async () => {
    const { descargarPdf } = montar({
      reporte: REPORTE,
      origen: 'auto',
      periodo: { desde: fechaRelativa(-6), hasta: fechaRelativa(0) },
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '30 días' }))
    expect(screen.getByText(/la vista previa muestra/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /descargar pdf/i }))
    expect(descargarPdf).toHaveBeenCalledWith()
  })

  it('el tiempo en rango se describe con texto, no solo con color', () => {
    const lecturas = Array.from({ length: 12 }, (_, i) => ({
      id: null,
      device_id: 'FARM-01-CDL',
      timestamp: new Date(Date.parse('2026-07-01T00:00:00Z') + i * 600_000).toISOString(),
      temperatura_interna: i < 9 ? 5 : 9.1,
    }))
    montar({ reporte: { ...REPORTE, lecturas } })
    expect(screen.getByRole('img', { name: /tiempo en 2–8 °C/i })).toBeInTheDocument()
    expect(screen.getByText(/fuera de rango/i, { selector: 'li' })).toBeInTheDocument()
  })

  it('un periodo sin lecturas ofrece usar 30 días', () => {
    montar({ reporte: REPORTE })
    expect(screen.getByText(/no hay lecturas en este periodo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /usar 30 días/i })).toBeInTheDocument()
  })

  it('en la vista previa automática el truncado se anuncia como estado, no como alerta', () => {
    montar({ reporte: { ...REPORTE, truncado: true, lecturas_truncadas: true, limite_por_coleccion: 10000 }, origen: 'auto' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('status').some((n) => /reporte incompleto/i.test(n.textContent ?? ''))).toBe(true)
  })
})
