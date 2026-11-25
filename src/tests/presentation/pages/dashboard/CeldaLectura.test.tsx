import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { CeldaLectura } from '@/presentation/pages/dashboard/CeldaLectura'

function lectura(over: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: 'l-1',
    device_id: 'FARM-01-CDL',
    timestamp: new Date().toISOString(),
    temperatura_ambiental: 21.4,
    humedad_ambiental: 58.37,
    temperatura_interna: 5.2,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    confianza_ia: 0.98,
    modelo_version: '1.0.0',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    ...over,
  }
}

function montar(props: Partial<Parameters<typeof CeldaLectura>[0]> = {}) {
  return render(
    <CeldaLectura
      ultima={lectura()}
      estadoHistorial="completo"
      reintentar={() => {}}
      deviceId="FARM-01-CDL"
      desactualizado={false}
      sseConectado
      extremos={null}
      ventana="las últimas 24 h"
      {...props}
    />,
  )
}

/** HU-32 esc. 2 y 3: el estado del flujo en vivo junto a la lectura. */
describe('CeldaLectura: estado del flujo SSE (HU-32)', () => {
  it('conserva una lectura antigua con fecha y unidad como histórica, incluso con el flujo conectado', () => {
    const timestamp = '2026-11-18T13:54:00Z'
    montar({ ultima: lectura({ temperatura_interna: 1.2, timestamp }), desactualizado: true })
    expect(screen.queryByTestId('valor-actual')).not.toBeInTheDocument()
    expect(screen.getByTestId('valor-historico')).toHaveTextContent(/1\.2\s*°C/)
    expect(screen.getByTestId('celda-lectura').querySelector('time')).toHaveAttribute('datetime', timestamp)
    expect(screen.getByText('Sin datos recientes')).toBeVisible()
    expect(screen.queryByText('En vivo')).not.toBeInTheDocument()
  })

  it('con el flujo abierto rotula «En vivo»', () => {
    montar()
    expect(screen.getByText('En vivo')).toBeInTheDocument()
    expect(screen.queryByText('Reconectando al flujo de lecturas…')).not.toBeInTheDocument()
  })

  it('esc. 2: con el flujo caído (sseConectado=false) muestra «Reconectando al flujo de lecturas…»', () => {
    montar({ sseConectado: false })
    expect(screen.getByText('Reconectando al flujo de lecturas…')).toBeInTheDocument()
    expect(screen.queryByText('En vivo')).not.toBeInTheDocument()
  })

  it('esc. 3: con el 429 «demasiados_flujos» nombra la causa y qué hacer, sin «Reconectando…»', () => {
    montar({ sseConectado: false, motivoDesconexion: 'demasiados_flujos' })
    const estado = screen.getByText('Demasiadas pestañas en tiempo real').closest('[role="status"]')
    expect(estado).not.toBeNull()
    expect(estado).toHaveTextContent(/cierra otra pestaña o equipo con ColdCare abierto/i)
    expect(screen.queryByText('Reconectando al flujo de lecturas…')).not.toBeInTheDocument()
  })
})
