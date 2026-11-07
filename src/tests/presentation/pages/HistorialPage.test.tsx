import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const useHistorial = vi.hoisted(() => vi.fn())
const obtenerEvidenciaInferencia = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useHistorial', () => ({ useHistorial }))
vi.mock('@/application/hooks/useEvidenciaInferencia', () => ({ obtenerEvidenciaInferencia }))
// ECharts dibuja en canvas, que jsdom no tiene; aquí importa qué recibe la gráfica, no sus píxeles.
vi.mock('@/infrastructure/charts/EChartWrapper', () => ({
  EChartWrapper: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}))

import { fechaISOlocal } from '@/lib/formato'
import { hora24 } from '@/presentation/pages/historial/agrupar'
import { HistorialPage } from '@/presentation/pages/HistorialPage'

const MINUTO = 60_000

/** Una lectura cada 10 min hacia atrás desde ahora: `cuantas` = 145 cubre las 24 horas completas. */
function serie(cuantas: number, cambiar: (indice: number) => Partial<LecturaTermica> = () => ({})): LecturaTermica[] {
  const ahora = Date.now()
  return Array.from({ length: cuantas }, (_, i) =>
    lectura({ id: `s-${i}`, timestamp: new Date(ahora - i * 10 * MINUTO).toISOString(), temperatura_interna: 5, ...cambiar(i) }),
  )
}

const titulo = () => screen.getByRole('heading', { level: 1 })

function lectura(over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: 'l-1',
    device_id: 'FARM-01-CDL',
    timestamp: new Date().toISOString(),
    temperatura_ambiental: 20.3,
    humedad_ambiental: 60,
    temperatura_interna: 4.7,
    apertura_refrigerador: false,
    duracion_apertura_segundos: null,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    confianza_ia: null,
    modelo_version: null,
    origen_clasificacion: null,
    estado_inferencia: null,
    motivo_no_inferencia: null,
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    ...over,
  }
}

function montar(over: Record<string, unknown> = {}) {
  const consultar = vi.fn()
  useHistorial.mockReturnValue({ lecturas: [lectura()], cargando: false, errorCarga: false, consultar, ...over })
  render(<HistorialPage />)
  return consultar
}

async function abrirFiltros() {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: /^filtros/i }))
  return { usuario, panel: await screen.findByRole('dialog', { name: /filtros/i }) }
}

describe('HistorialPage (HU-34, HU-35, HU-36)', () => {
  beforeEach(() => {
    useHistorial.mockReset()
    obtenerEvidenciaInferencia.mockReset()
  })

  it('la curva y las lecturas salen de la misma consulta y los filtros no van antes del contenido', () => {
    montar()
    expect(screen.getByRole('img', { name: /1/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Historial' })).toBeInTheDocument()
    // Sin abrir la barra no hay ningún campo de filtro en pantalla.
    expect(screen.queryByLabelText(/código del refrigerador/i)).not.toBeInTheDocument()
  })

  it('agrupa las lecturas por día, cada día con su resumen', () => {
    const hoy = new Date()
    const anteayer = new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000)
    montar({
      lecturas: [
        lectura({ id: 'a', timestamp: hoy.toISOString(), temperatura_interna: 3.2 }),
        lectura({ id: 'b', timestamp: hoy.toISOString(), temperatura_interna: 7.4 }),
        lectura({ id: 'c', timestamp: anteayer.toISOString(), temperatura_interna: 9.1, excursion_confirmada: true, riesgo_efectivo: 'excursion_critica' }),
      ],
    })
    // «Hoy» encabeza también el resumen día por día: aquí se mira la lista completa.
    const lista = screen.getByRole('region', { name: 'Historial' })
    const dia = within(lista).getByRole('heading', { name: 'Hoy' }).closest('section') as HTMLElement
    expect(dia).toHaveTextContent('3.2–7.4')
    expect(dia).toHaveTextContent('2 lecturas')
    expect(within(dia).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('1 fuera de rango')).toBeInTheDocument()
  })

  it('muestra el riesgo efectivo, no la clase cruda de la IA (HU-34)', () => {
    montar({ lecturas: [lectura({ nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'normal' })] })
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('Normal')).toBeInTheDocument()
    expect(within(tabla).queryByText('Excursión crítica')).not.toBeInTheDocument()
  })

  it('un sensor de puerta ausente no se presenta como puerta cerrada (HU-35)', () => {
    montar({ lecturas: [lectura({ apertura_refrigerador: null })] })
    expect(screen.getByRole('img', { name: 'No disponible' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /cerrada/i })).not.toBeInTheDocument()
  })

  it('elegir un nivel consulta al instante y deja un chip que lo quita', async () => {
    const consultar = montar()
    const { usuario, panel } = await abrirFiltros()
    await usuario.selectOptions(within(panel).getByLabelText(/nivel de riesgo/i), 'excursion_critica')
    expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ riesgo_efectivo: 'excursion_critica' }))

    await usuario.click(within(panel).getByRole('button', { name: 'Listo' }))
    await usuario.click(await screen.findByRole('button', { name: /quitar filtro: excursión crítica/i }))
    expect(consultar).toHaveBeenLastCalledWith(expect.not.objectContaining({ riesgo_efectivo: 'excursion_critica' }))
  })

  it('el código del equipo se aplica con «Aplicar filtros»', async () => {
    const consultar = montar()
    const { usuario, panel } = await abrirFiltros()
    await usuario.type(within(panel).getByLabelText(/código del refrigerador/i), 'FARM-02-CDL')
    expect(consultar).not.toHaveBeenCalled()
    await usuario.click(within(panel).getByRole('button', { name: 'Aplicar filtros' }))
    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ device_id: 'FARM-02-CDL' }))
  })

  it('bloquea un rango invertido antes de consultar y lo explica (HU-36)', async () => {
    const consultar = montar()
    const { usuario, panel } = await abrirFiltros()
    await usuario.type(within(panel).getByLabelText('Desde'), '2026-07-25T10:00')
    expect(consultar).toHaveBeenCalledTimes(1)
    await usuario.type(within(panel).getByLabelText('Hasta'), '2026-07-20T10:00')
    expect(consultar).toHaveBeenCalledTimes(1)
    expect(within(panel).getByRole('alert')).toHaveTextContent(/no puede ser posterior/i)
  })

  it('limpiar quita los filtros y vuelve a consultar sin ellos', async () => {
    const consultar = montar()
    const { usuario, panel } = await abrirFiltros()
    await usuario.selectOptions(within(panel).getByLabelText(/nivel de riesgo/i), 'normal')
    await usuario.click(within(panel).getByRole('button', { name: 'Limpiar' }))
    expect(consultar).toHaveBeenLastCalledWith({})
  })

  it('abre el origen de una lectura y avisa si no hay evidencia', async () => {
    obtenerEvidenciaInferencia.mockRejectedValue(new Error('404'))
    montar()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver origen' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent(/cómo se obtuvo este riesgo/i)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/no hay evidencia/i)
  })

  it('una lectura sin identificador no ofrece ver su origen', () => {
    montar({ lecturas: [lectura({ id: null })] })
    expect(screen.getByRole('button', { name: 'Ver origen' })).toBeDisabled()
  })

  it('pagina las lecturas y conserva el total', () => {
    const lecturas = Array.from({ length: 20 }, (_, i) => lectura({ id: `l-${i}` }))
    montar({ lecturas })
    expect(screen.getByRole('navigation', { name: /paginación/i })).toHaveTextContent('1–15 de 20')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(16)
  })

  it('sin resultados lo dice, sin gráfica vacía, y ofrece limpiar si hay filtros', async () => {
    const consultar = montar({ lecturas: [] })
    expect(screen.getByText(/no hay lecturas para los filtros/i)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(consultar).not.toHaveBeenCalled()
  })

  it('un error de carga ofrece reintentar con los mismos filtros', async () => {
    const consultar = montar({ lecturas: [], errorCarga: true })
    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar las lecturas/i)
    await userEvent.setup().click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(consultar).toHaveBeenCalledWith({})
  })

  it('mientras carga por primera vez anuncia la carga sin dejar un hueco', () => {
    montar({ lecturas: [], cargando: true })
    expect(screen.getByRole('status')).toHaveTextContent(/cargando historial/i)
    expect(screen.getByRole('region', { name: 'Historial' })).toHaveAttribute('aria-busy', 'true')
  })

  // ── La frase: «¿qué pasó anoche?» en palabras, sacada de las lecturas ─────

  it('dice que las últimas 24 horas estuvieron siempre dentro del rango', () => {
    montar({ lecturas: serie(145) })
    expect(titulo()).toHaveAccessibleName('Historial: Últimas 24 horas: siempre dentro del rango')
  })

  it('cuenta las salidas del rango y dice a qué hora empezó la última', () => {
    const fuera = { temperatura_interna: 9.1, excursion_confirmada: true, riesgo_efectivo: 'excursion_critica' as const }
    const lecturas = serie(145, (i) => (i >= 30 && i <= 32) || i === 60 ? fuera : {})
    montar({ lecturas })
    const inicioUltima = lecturas[32].timestamp
    expect(titulo()).toHaveAccessibleName(new RegExp(`^Historial: Salió del rango 2 veces, la última (ayer )?a las ${hora24(inicioUltima)}$`))
    expect(titulo()).not.toHaveTextContent(/siempre dentro/)
  })

  it('una cifra fuera de 2–8 °C cuenta aunque la regla todavía no la confirme', () => {
    montar({ lecturas: serie(145, (i) => (i === 5 ? { temperatura_interna: 8.4 } : {})) })
    expect(titulo()).toHaveAccessibleName(/Salió del rango 1 vez/)
  })

  it('si lo cargado no alcanza el periodo, dice desde cuándo hay lecturas en vez de afirmar 24 horas', () => {
    montar({ lecturas: serie(18) })
    expect(titulo()).toHaveAccessibleName(/^Historial: Desde (ayer )?(a )?las \d{2}:\d{2}: siempre dentro del rango$/)
    expect(screen.getByText('No se cargaron lecturas anteriores.')).toBeInTheDocument()
  })

  it('un hueco largo sin lecturas no se presenta como «siempre dentro del rango»', () => {
    montar({ lecturas: serie(145).filter((_, i) => i < 60 || i > 77) })
    expect(titulo()).toHaveAccessibleName('Historial: Últimas 24 horas: dentro del rango en todo lo registrado')
    expect(screen.getByText('Hubo 3 h 10 min sin lecturas.')).toBeInTheDocument()
  })

  it('con un nivel elegido la frase solo cuenta lo filtrado: no afirma nada sobre el rango', async () => {
    // Una sola lectura: sin filtro diría «Desde las…»; filtrada, lo que llega no dice desde cuándo hay datos.
    montar()
    const { usuario, panel } = await abrirFiltros()
    await usuario.selectOptions(within(panel).getByLabelText(/nivel de riesgo/i), 'normal')
    await usuario.click(within(panel).getByRole('button', { name: 'Listo' }))
    expect(titulo()).toHaveAccessibleName('Historial: Últimas 24 horas: 1 lectura con nivel Normal')
  })

  it('los atajos piden su periodo: «Ayer» va de las 00:00 de ayer a las 00:00 de hoy', async () => {
    const consultar = montar()
    const usuario = userEvent.setup()
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    await usuario.click(screen.getByRole('button', { name: 'Ayer' }))
    expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ desde: `${fechaISOlocal(ayer)}T00:00`, hasta: `${fechaISOlocal()}T00:00` }))
    expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'true')
    // Las fechas del atajo no se duplican como chips: el control ya las muestra.
    expect(screen.queryByRole('button', { name: /quitar filtro/i })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: '24 horas' }))
    expect(consultar).toHaveBeenLastCalledWith({})
  })

  // ── Lo demás, plegado ─────────────────────────────────────────────────────

  it('todas las lecturas van plegadas tras «Ver todas las lecturas»', async () => {
    montar()
    const boton = screen.getByRole('button', { name: /ver todas las lecturas/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('region', { name: 'Historial' }).closest('[inert]')).not.toBeNull()

    await userEvent.setup().click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Historial' }).closest('[inert]')).toBeNull()
  })

  it('solo lo que salió del rango se lista a la vista, y la fila se abre en su detalle', async () => {
    const fuera = { temperatura_interna: 9.4, excursion_confirmada: true, riesgo_efectivo: 'excursion_critica' as const, apertura_refrigerador: true }
    montar({ lecturas: serie(145, (i) => (i >= 3 && i <= 5 ? fuera : {})) })
    const usuario = userEvent.setup()
    const fila = screen.getByRole('button', { name: /salida del rango/i })
    expect(fila).toHaveAccessibleName(/9\.4 °C/)
    expect(fila).toHaveAccessibleName(/puerta abierta/)
    expect(fila).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('table', { name: /lecturas de la salida/i })).not.toBeInTheDocument()

    await usuario.click(fila)
    expect(fila).toHaveAttribute('aria-expanded', 'true')
    const detalle = screen.getByRole('table', { name: /lecturas de la salida/i })
    // Las tres lecturas de la salida, con su cabecera.
    expect(within(detalle).getAllByRole('row')).toHaveLength(4)

    await usuario.click(fila)
    expect(screen.queryByRole('table', { name: /lecturas de la salida/i })).not.toBeInTheDocument()
  })
})
