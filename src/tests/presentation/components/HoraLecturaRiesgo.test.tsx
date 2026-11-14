import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HoraLectura } from '@/presentation/components/HoraLectura'
import { RiskBadge } from '@/presentation/components/RiskBadge'

describe('HoraLectura (HU-07)', () => {
  it('con hora del nodo muestra un <time> con la hora de captura', () => {
    const { container } = render(<HoraLectura lectura={{ timestamp: '2026-11-14T10:00:00Z', origen_hora: 'nodo' }} formato="fechaHora" />)
    expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-11-14T10:00:00Z')
    expect(screen.queryByText('Sin hora')).not.toBeInTheDocument()
  })

  it('sin hora sincronizada rotula «Sin hora» y deja la llegada en el detalle', () => {
    const { container } = render(
      <HoraLectura lectura={{ timestamp: '2026-11-14T10:00:00Z', sin_hora: true, recibida_en: '2026-11-14T10:00:01Z', time_quality: 'unsynced' }} />,
    )
    expect(container.querySelector('time')).toBeNull()
    expect(screen.getByText('Sin hora')).toBeInTheDocument()
    expect(screen.getByText(/no se conoce su hora de captura/)).toBeInTheDocument()
  })

  it('una hora reconstruida va con «≈» y su aclaración', () => {
    const { container } = render(
      <HoraLectura
        lectura={{ timestamp: '2026-11-14T10:05:00Z', timestamp_estimado: '2026-11-14T09:58:00Z', origen_hora: 'reconstruida', time_quality: 'unsynced' }}
        formato="fechaHora"
      />,
    )
    const tiempo = container.querySelector('time')!
    expect(tiempo).toHaveAttribute('dateTime', '2026-11-14T09:58:00Z')
    expect(tiempo).toHaveTextContent('≈')
    expect(tiempo).toHaveTextContent('Hora reconstruida')
  })
})

describe('RiskBadge (HU-34 esc. 4)', () => {
  it('«Sin clasificación IA» y «Falla de sensor» tienen texto propio y no dicen Normal', () => {
    const { rerender } = render(<RiskBadge nivel="sin_clasificacion_ia" />)
    expect(screen.getByText('Sin clasificación IA')).toHaveAttribute('data-estado-riesgo', 'sin_clasificacion_ia')
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()

    rerender(<RiskBadge nivel="falla_sensor" />)
    expect(screen.getByText('Falla de sensor')).toBeInTheDocument()
    expect(screen.getByText(/no se puede calcular el riesgo/)).toBeInTheDocument()
  })

  it('los tres niveles de siempre no cambian', () => {
    const { rerender } = render(<RiskBadge nivel="normal" />)
    expect(screen.getByText('Normal')).toBeInTheDocument()
    rerender(<RiskBadge nivel="excursion_critica" />)
    expect(screen.getByText('Excursión crítica')).toBeInTheDocument()
    rerender(<RiskBadge nivel={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
