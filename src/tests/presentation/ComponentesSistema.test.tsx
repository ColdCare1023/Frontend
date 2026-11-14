import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/infrastructure/i18n'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { CifrasResumen } from '@/presentation/pages/compartido/CifrasResumen'
import { EstadoVacio } from '@/presentation/components/EstadoPagina'
import { PageHeader } from '@/presentation/components/PageHeader'
import { CifraAnimada } from '@/presentation/components/ui/cifra-animada'
import { Cinta24h } from '@/presentation/components/ui/cinta-24h'
import { IndicadorEstado } from '@/presentation/components/ui/estado'
import { formatearCifra, formatearTemperatura, textoConteo } from '@/presentation/components/ui/formato-cifra'
import { InsigniaConteo } from '@/presentation/components/ui/insignia-conteo'
import { Pestanas } from '@/presentation/components/ui/pestanas'
import { Regla } from '@/presentation/components/ui/regla'
import { posicionEnRegla } from '@/presentation/components/ui/regla-eje'
import { Segmentado } from '@/presentation/components/ui/segmentado'
import { segmentarLecturas } from '@/presentation/components/ui/segmentar-lecturas'
import { propsFilaNueva, useIdsNuevos } from '@/presentation/hooks/useIdsNuevos'

beforeEach(async () => {
  await i18n.changeLanguage('es')
})

describe('formato de cifras', () => {
  it('usa un decimal, signo menos tipográfico y espacio fino antes de la unidad', () => {
    expect(formatearCifra(5.24)).toBe('5.2')
    expect(formatearCifra(-0.44)).toBe('\u22120.4')
    expect(formatearCifra(-0.04)).toBe('0.0')
    expect(formatearTemperatura(5.2)).toBe('5.2\u202F°C')
  })

  it('muestra 99+ y n+ cuando el conteo está truncado', () => {
    expect(textoConteo(150)).toBe('99+')
    expect(textoConteo(12, true)).toBe('12+')
    expect(textoConteo(3)).toBe('3')
  })
})

describe('Regla 2–8', () => {
  it('fija al borde un valor fuera del eje 0–10 °C', () => {
    expect(posicionEnRegla(-3)).toBe(0)
    expect(posicionEnRegla(5)).toBe(0.5)
    expect(posicionEnRegla(14)).toBe(1)
  })

  it('dice el valor y el rango, no solo el color', () => {
    render(<Regla valor={8.4} tono="preventivo" tamano="s" />)
    expect(screen.getByRole('img', { name: /8\.4\u202F°C, rango seguro de 2 a 8/ })).toBeInTheDocument()
  })

  it('mueve la marca con transform (variable --pos), nunca con left', () => {
    const { container } = render(<Regla valor={5} tono="normal" tamano="xl" minimo={3.1} maximo={6.2} />)
    const marca = container.querySelector<HTMLElement>('[data-regla-marca]')!
    expect(marca.style.getPropertyValue('--pos')).toBe('0.5')
    expect(marca.style.left).toBe('')
    // XL: marca, mínimo y máximo de 24 h, y las cotas 0·2·8·10.
    expect(container.querySelectorAll('.regla__carro')).toHaveLength(3)
    expect(container.querySelector('.regla__cotas')?.textContent).toBe('02810')
  })

  it('decorativa no expone un img sin nombre', () => {
    render(<Regla valor={5} decorativa />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('Cinta 24 h', () => {
  const ahora = Date.parse('2026-11-14T12:00:00Z')
  const lectura = (minutosAtras: number, temperatura: number, riesgo: LecturaTermica['riesgo_efectivo']) =>
    ({ timestamp: new Date(ahora - minutosAtras * 60_000).toISOString(), temperatura_interna: temperatura, riesgo_efectivo: riesgo, nivel_riesgo: riesgo }) as LecturaTermica

  it('reparte las lecturas en 48 tramos con el peor estado y trama para los vacíos', () => {
    const segmentos = segmentarLecturas([lectura(5, 5.1, 'normal'), lectura(10, 9.2, 'excursion_critica'), lectura(100, 4, 'normal')], { ahora })
    expect(segmentos).toHaveLength(48)
    expect(segmentos[47]).toMatchObject({ tono: 'critico', minimo: 5.1, maximo: 9.2 })
    expect(segmentos[44].tono).toBe('normal')
    expect(segmentos[0].tono).toBe('sin_datos')
  })

  it('resume la cinta en su nombre accesible', () => {
    const segmentos = segmentarLecturas([lectura(10, 9.2, 'excursion_critica')], { ahora })
    render(<Cinta24h segmentos={segmentos} etiqueta="Refrigerador 1" />)
    expect(screen.getByRole('img', { name: 'Refrigerador 1: 1 de 48 tramos fuera de rango y 47 sin datos' })).toBeInTheDocument()
  })
})

describe('InsigniaConteo', () => {
  it('no anima en el primer render y anima solo cuando el conteo sube', () => {
    const { container, rerender } = render(<InsigniaConteo valor={2} />)
    const animado = () => container.querySelector('.animate-\\(--animate-insignia\\)') as HTMLElement | null
    expect(animado()).toBeNull()
    rerender(<InsigniaConteo valor={3} />)
    expect(animado()).not.toBeNull()
    expect(animado()!.style.getPropertyValue('--dir')).toBe('1')
    rerender(<InsigniaConteo valor={1} />)
    expect(animado()!.style.getPropertyValue('--dir')).toBe('-1')
  })

  it('un cero se queda quieto (no se pinta) y lo crítico es sólido', () => {
    const { container, rerender } = render(<InsigniaConteo valor={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<InsigniaConteo valor={4} critico />)
    expect(container.querySelector('[data-critico]')).toHaveClass('bg-critical-solid')
  })
})

describe('CifraAnimada', () => {
  it('deja el valor completo al lector y vuelve a animar solo al cambiar la clave', () => {
    const { container, rerender } = render(<CifraAnimada valor={5.2} clave="FARM-01" />)
    expect(screen.getByText('5.2')).toHaveClass('sr-only')
    expect(container.querySelectorAll('.cifra-digito')).toHaveLength(3)
    const primero = container.querySelector('.cifra-digito')
    rerender(<CifraAnimada valor={5.3} clave="FARM-01" />)
    // Misma clave (lectura SSE): mismo nodo, sin remontar.
    expect(container.querySelector('.cifra-digito')).toBe(primero)
    rerender(<CifraAnimada valor={3.1} clave="FARM-02" />)
    expect(container.querySelector('.cifra-digito')).not.toBe(primero)
  })
})

describe('Segmentado con indicador compartido', () => {
  function Sonda() {
    const [valor, setValor] = useState<'1h' | '24h' | '7d'>('24h')
    return (
      <Segmentado
        etiqueta="Ventana"
        valor={valor}
        onCambiar={setValor}
        opciones={[
          { valor: '1h', etiqueta: '1 h' },
          { valor: '24h', etiqueta: '24 h' },
          { valor: '7d', etiqueta: '7 d' },
        ]}
      />
    )
  }

  it('conserva el grupo con botones aria-pressed y la copia decorativa queda oculta', async () => {
    const usuario = userEvent.setup()
    const { container } = render(<Sonda />)
    const grupo = screen.getByRole('group', { name: 'Ventana' })
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'true')
    await usuario.click(screen.getByRole('button', { name: '7 d' }))
    expect(screen.getByRole('button', { name: '7 d' })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('[data-indicador-segmentado]')).toHaveAttribute('aria-hidden', 'true')
    expect(grupo.querySelectorAll('button[data-activo]')).toHaveLength(1)
  })
})

describe('Pestanas', () => {
  function Sonda() {
    const [valor, setValor] = useState<'resumen' | 'monitoreo' | 'calibracion'>('resumen')
    return (
      <Pestanas
        etiqueta="Detalle del equipo"
        idBase="eq"
        valor={valor}
        onCambiar={setValor}
        pestanas={[
          { valor: 'resumen', etiqueta: 'Resumen' },
          { valor: 'monitoreo', etiqueta: 'Monitoreo', contador: 2 },
          { valor: 'calibracion', etiqueta: 'Calibración' },
        ]}
      />
    )
  }

  it('sigue el patrón WAI-ARIA: una pestaña tabulable y flechas que activan', async () => {
    const usuario = userEvent.setup()
    render(<Sonda />)
    const resumen = screen.getByRole('tab', { name: 'Resumen' })
    expect(resumen).toHaveAttribute('aria-selected', 'true')
    expect(resumen).toHaveAttribute('aria-controls', 'eq-panel-resumen')
    expect(screen.getByRole('tab', { name: /Monitoreo/ })).toHaveAttribute('tabindex', '-1')
    resumen.focus()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Monitoreo/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Monitoreo/ })).toHaveFocus()
    await usuario.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Calibración' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('useIdsNuevos (lista animada)', () => {
  it('siembra la carga inicial sin animar y marca solo lo que llega después', () => {
    const { result, rerender } = renderHook(({ ids, listo, clave }) => useIdsNuevos(ids, listo, clave), {
      initialProps: { ids: ['a', 'b'], listo: true, clave: 'pendientes' },
    })
    expect(result.current.size).toBe(0)
    rerender({ ids: ['c', 'a', 'b'], listo: true, clave: 'pendientes' })
    expect([...result.current]).toEqual(['c'])
    expect(propsFilaNueva('c', result.current, 0)).toMatchObject({ 'data-nueva': '' })
    expect(propsFilaNueva('a', result.current, 1)).toEqual({})
    // Cambiar de filtro vuelve a sembrar: nada anima.
    act(() => rerender({ ids: ['x', 'y'], listo: true, clave: 'todas' }))
    expect(result.current.size).toBe(0)
  })
})

describe('Tira de estado y estados vacíos', () => {
  it('CifrasResumen es una lista de definiciones con la frase guía delante', () => {
    render(
      <CifrasResumen
        etiqueta="Resumen de equipos"
        guia="1 de 2 equipos sin datos desde 09:37"
        cifras={[
          { clave: 'equipos', etiqueta: 'Equipos', valor: 2 },
          { clave: 'sin', etiqueta: 'Sin datos', valor: 1, tono: 'aviso' },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Resumen de equipos' })
    expect(region).toHaveTextContent('1 de 2 equipos sin datos desde 09:37')
    expect(screen.getAllByRole('term').map((d) => d.textContent)).toEqual(['Equipos', 'Sin datos'])
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(['2', '1'])
  })

  it('el estado vacío anuncia título, contexto y acción, con la ilustración decorativa', () => {
    const { container } = render(
      <EstadoVacio ilustracion="al-dia" titulo="Todo en orden" detalle="No hay alertas pendientes." contexto="Última atendida a las 09:12">
        <button type="button">Ver historial</button>
      </EstadoVacio>,
    )
    const estado = screen.getByRole('status')
    expect(estado).toHaveTextContent('Todo en orden')
    expect(estado).toHaveTextContent('Última atendida a las 09:12')
    expect(screen.getByRole('button', { name: 'Ver historial' })).toBeInTheDocument()
    expect(container.querySelector('svg[data-ilustracion="al-dia"]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('el encabezado compacto lleva el H1, el dato inline y las acciones', () => {
    render(
      <PageHeader titulo="Alertas" meta="Actualizado 09:38">
        <button type="button">Exportar</button>
      </PageHeader>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Alertas' })).toBeInTheDocument()
    expect(screen.getByText('Actualizado 09:38')).toBeInTheDocument()
  })

  it('el indicador de estado combina forma y texto', () => {
    render(<IndicadorEstado tono="sin_datos" etiqueta="Sin datos" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
  })
})
