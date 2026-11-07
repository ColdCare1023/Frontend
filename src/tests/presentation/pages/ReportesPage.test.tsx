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
import { opcionCurvaSobrePapel } from '@/presentation/pages/reportes/curvaSobrePapel'
import { fechaISOlocal } from '@/lib/formato'

function montar(over: Record<string, unknown> = {}) {
  const acciones = {
    generar: vi.fn(),
    descargarJson: vi.fn(),
    descargarCsv: vi.fn(),
    descargarPdf: vi.fn().mockResolvedValue(undefined),
  }
  const estado = { reporte: null, generando: false, error: null, descargandoPdf: false, ...acciones, ...over }
  useReportesBPA.mockReturnValue(estado)
  const { rerender } = render(<ReportesPage />)
  /** Lo que el hook devolvería después: la hoja llena, un error… */
  const luego = (cambios: Record<string, unknown>) => {
    useReportesBPA.mockReturnValue({ ...estado, ...cambios })
    rerender(<ReportesPage />)
  }
  return { ...acciones, luego }
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

  it('abre con la constancia, el periodo más común ya elegido y un solo gesto: descargar', () => {
    montar()

    expect(screen.getByRole('heading', { level: 1, name: 'Reportes: Tu constancia de cadena de frío' })).toBeInTheDocument()
    expect(screen.getByText(/periodo del reporte/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toHaveClass('coldcare-primary-action')
  })

  it('ofrece los tres formatos que exige RF-13 una vez generado', () => {
    // Mantener disponibles los tres formatos de descarga del reporte.
    montar({ reporte: REPORTE })

    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument()
  })

  it('sin hoja, «Descargar PDF» primero la llena y después descarga: un solo gesto que muestra su avance', async () => {
    const { generar, descargarPdf, luego } = montar({ reporte: null })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(generar).toHaveBeenCalledWith(expect.any(String), fechaISOlocal(), undefined)
    // La hoja aún no llegó: nada se descarga todavía y el botón cuenta lo que hace.
    expect(descargarPdf).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Preparando tu constancia…' })).toBeDisabled()

    luego({ reporte: REPORTE })
    expect(descargarPdf).toHaveBeenCalledWith(expect.any(String), fechaISOlocal(), undefined)
    // Terminado, el botón se vuelve su resultado y el foco pasa a él.
    expect(await screen.findByText('Constancia descargada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar otra vez' })).toHaveFocus()
  })

  it('si la hoja no se pudo llenar, no descarga nada y lo dice', async () => {
    const { descargarPdf, luego } = montar({ reporte: null })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Descargar PDF' }))
    luego({ error: 'generico' })

    expect(descargarPdf).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo generar el reporte/i)
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled()
  })

  it('CSV y JSON van en segundo plano, tras «Otros formatos»', async () => {
    montar({ reporte: REPORTE })
    const otros = screen.getByRole('button', { name: 'Otros formatos' })
    expect(otros).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /csv/i }).closest('[inert]')).not.toBeNull()

    await userEvent.setup().click(otros)
    expect(screen.getByRole('button', { name: /csv/i }).closest('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: /json/i }).closest('[inert]')).toBeNull()
  })

  it('muestra el error cuando la generación falla', () => {
    montar({ error: 'No hay datos en el periodo seleccionado' })

    expect(screen.getByText(/no se pudo generar el reporte/i)).toBeInTheDocument()
  })

  it('la hoja en blanco muestra el mismo día que el periodo elegido, sin correrlo por UTC', () => {
    montar()

    const hoy = new Date()
    const local = hoy.toLocaleDateString('es-PE')
    expect(screen.getByRole('article', { name: /reporte de cadena de frío/i })).toHaveTextContent(new RegExp(`al ${local}`))
    expect(screen.getByRole('article')).toHaveTextContent(/se completa al descargar/i)
    expect(screen.getByRole('status')).toHaveTextContent(new RegExp(`Del .+ al ${local} · 31 días`))
  })

  it('descargar envía el periodo por defecto y el equipo elegido en el panel', async () => {
    const usuario = userEvent.setup()
    const acciones = montar()

    await usuario.click(screen.getByRole('button', { name: /periodo y equipo/i }))
    await usuario.type(screen.getByLabelText(/equipo \(opcional\)/i), 'FARM-02')
    await usuario.keyboard('{Escape}')
    await usuario.click(await screen.findByRole('button', { name: 'Descargar PDF' }))

    const hasta = fechaISOlocal()
    expect(acciones.generar).toHaveBeenCalledWith(expect.any(String), hasta, 'FARM-02')
  })

  it('el equipo elegido queda a la vista y se quita sin abrir el panel', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('button', { name: /periodo y equipo/i }))
    await usuario.type(screen.getByLabelText(/equipo \(opcional\)/i), 'FARM-02')
    await usuario.keyboard('{Escape}')
    await usuario.click(await screen.findByRole('button', { name: /quitar filtro: farm-02/i }))

    expect(screen.queryByRole('button', { name: /quitar filtro/i })).not.toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent(/todos los equipos/i)
  })

  it('un periodo invertido se avisa y bloquea generar, sin gastar la cuota', async () => {
    const usuario = userEvent.setup()
    const acciones = montar()

    await usuario.click(screen.getByRole('button', { name: /periodo y equipo/i }))
    const desde = screen.getByLabelText(/^desde$/i)
    await usuario.clear(desde)
    await usuario.type(desde, '01/01/2999')
    await usuario.tab()
    await usuario.keyboard('{Escape}')

    expect(await screen.findByRole('alert')).toHaveTextContent(/posterior a la final/i)
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ver la hoja sin descargar/i })).toBeDisabled()
    expect(acciones.generar).not.toHaveBeenCalled()
  })

  it('con el reporte generado la hoja lo dice, y descargar pasa a ser el gesto principal', () => {
    montar({ reporte: REPORTE })

    expect(screen.getByText(/resumen del periodo/i)).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('FARM-01-CDL')
    expect(screen.getByRole('article')).toHaveTextContent(/no reemplaza registros ni documentos oficiales/i)
    expect(screen.getByText(/sin lecturas en este periodo/i)).toBeInTheDocument()
    expect(screen.getByText(/sin alertas en este periodo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /descargar pdf/i })).toHaveClass('coldcare-primary-action')
    // Ver en pantalla sin descargar sigue disponible, en segundo plano.
    expect(screen.getByRole('button', { name: /actualizar la hoja/i })).not.toHaveClass('coldcare-primary-action')
    // La advertencia honesta va en la hoja, igual que antes de generarla.
    expect(screen.getByRole('article')).toHaveTextContent(/apoyo para revisiones internas/i)
  })

  it('mientras genera el botón queda ocupado y la hoja lo anuncia', () => {
    montar({ generando: true })

    expect(screen.getByRole('button', { name: /preparando tu constancia/i })).toBeDisabled()
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true')
  })
})

describe('Curva sobre papel', () => {
  const ETIQUETAS = {
    interna: 'Interna',
    ambiental: 'Ambiente',
    rangoEsperado: 'Rango',
    ahora: 'Ahora',
    excursion: 'Excursión',
    sinDatos: 'Sin datos',
  }
  const LECTURAS = [
    { device_id: 'FARM-01', timestamp: '2026-07-01T00:00:00Z', temperatura_interna: 4.2 },
    { device_id: 'FARM-01', timestamp: '2026-07-01T00:10:00Z', temperatura_interna: 4.4 },
  ] as never[]

  it('de noche lleva tinta de papel: ni texto claro ni el cian del tema oscuro', () => {
    const opcion = opcionCurvaSobrePapel(LECTURAS, ETIQUETAS, 'dark') as unknown as {
      textStyle: { color: string }
      series: Array<{ markArea: { itemStyle: { color: string }; label: { color: string } } }>
      tooltip: { backgroundColor: string }
    }

    expect(opcion.textStyle.color).toBe('#0F172A')
    expect(opcion.series[0].markArea.itemStyle.color).toBe('#008EAF')
    expect(opcion.series[0].markArea.label.color).toBe('#07546A')
    // Salvo el tooltip, que flota sobre la hoja, no queda ningún color claro del tema oscuro.
    const { tooltip, ...sobreLaHoja } = opcion
    const colores = JSON.stringify(sobreLaHoja).toLowerCase()
    expect(colores).not.toContain('#f1f5fa')
    expect(colores).not.toContain('#5cd6e8')
    expect(colores).not.toContain('#8f9db1')
    expect(tooltip.backgroundColor.toLowerCase()).toBe('#1a2439')
  })

  it('de día es la curva compartida, sin copia', () => {
    const opcion = opcionCurvaSobrePapel(LECTURAS, ETIQUETAS, 'light') as unknown as { textStyle: { color: string } }
    expect(opcion.textStyle.color.toLowerCase()).toBe('#0f172a')
  })

  it('no recorre la serie: conserva sus puntos tal cual', () => {
    const opcion = opcionCurvaSobrePapel(LECTURAS, ETIQUETAS, 'dark') as unknown as { series: Array<{ data: unknown[] }> }
    expect(opcion.series[0].data).toEqual([
      [Date.parse('2026-07-01T00:00:00Z'), 4.2],
      [Date.parse('2026-07-01T00:10:00Z'), 4.4],
    ])
  })
})
