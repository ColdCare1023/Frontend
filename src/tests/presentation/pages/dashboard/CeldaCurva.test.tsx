import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { temaGrafica } from '@/infrastructure/charts/temaColdCare'
import { CeldaCurva } from '@/presentation/pages/dashboard/CeldaCurva'

function montar(serie: LecturaTermica[], estadoHistorial: 'cargando' | 'completo' | 'error' = 'completo', ultimaPresente = false) {
  return render(
    <CeldaCurva
      serie={serie}
      ultimaPresente={ultimaPresente}
      estadoHistorial={estadoHistorial}
      reintentar={() => {}}
      horasVentana={24}
      onCambiarVentana={() => {}}
      ventana="las últimas 24 h"
    />,
  )
}

/** HU-31 esc. 2: un equipo recién registrado no muestra un lienzo en blanco. */
describe('CeldaCurva: estado vacío (HU-31 esc. 2)', () => {
  it('con la serie vacía y el historial cargado muestra un mensaje role=status', () => {
    montar([])

    const vacio = screen.getByRole('status')
    expect(vacio).toHaveTextContent('Sin lecturas en las últimas 24 h.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('mientras carga no muestra el estado vacío', () => {
    montar([], 'cargando')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

/** HU-31 esc. 1: «zonas de colores (rojo/verde)» para el rango 2–8 °C. */
describe('Franja 2–8 °C de la curva (HU-31 esc. 1)', () => {
  const tono = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === min) return 0
    const d = max - min
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
  }

  it.each(['light', 'dark'] as const)('en el tema %s la franja, sus cotas y su rótulo son verdes', (tema) => {
    const colores = temaGrafica(tema)
    for (const color of [colores.banda, colores.safe, colores.safeText]) {
      // Verde: matiz entre 90° y 160° (el teal anterior rondaba 190°).
      expect(tono(color)).toBeGreaterThanOrEqual(90)
      expect(tono(color)).toBeLessThanOrEqual(160)
    }
  })
})
