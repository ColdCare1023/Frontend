import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { VialEquipo } from '@/presentation/efectos/tresd/VialEquipo'

afterEach(() => {
  vi.unstubAllGlobals()
})

function sinCargarNunca() {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
}

describe('EChartWrapper', () => {
  it('conserva su nombre accesible y reserva el alto mientras carga', () => {
    sinCargarNunca()
    render(<EChartWrapper option={{}} height="240px" ariaLabel="Curva de temperatura" ariaDescribedBy="tabla" />)
    const grafica = screen.getByRole('img', { name: 'Curva de temperatura' })
    expect(grafica).toHaveStyle({ height: '240px', width: '100%' })
    expect(grafica).toHaveAttribute('aria-describedby', 'tabla')
    expect(grafica.querySelector('.esqueleto')).toBeInTheDocument()
  })

  it('pide números tabulares: el lienzo los hereda de su contenedor', () => {
    sinCargarNunca()
    render(<EChartWrapper option={{}} ariaLabel="Curva" />)
    expect(screen.getByRole('img', { name: 'Curva' })).toHaveStyle({ fontVariantNumeric: 'tabular-nums' })
  })
})

describe('VialEquipo', () => {
  it('sin aceleración gráfica no intenta nada: el lienzo sigue invisible y la pantalla funciona igual', () => {
    const { container } = render(<VialEquipo variante="insulina" temperatura={4.5} className="vial" />)
    const lienzo = container.querySelector('canvas')
    expect(lienzo).toHaveClass('vial')
    expect(lienzo).toHaveStyle({ opacity: '0' })
    expect(lienzo).toHaveAttribute('aria-hidden', 'true')
  })
})
