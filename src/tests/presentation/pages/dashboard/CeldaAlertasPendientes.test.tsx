import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { CeldaAlertasPendientes } from '@/presentation/pages/dashboard/CeldaAlertasPendientes'

const HACE_HORAS = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

function alerta(overrides: Partial<AlertaTermica> = {}): AlertaTermica {
  return {
    id: 'al-1',
    reading_id: 'l-1',
    device_id: 'FARM-01-CDL',
    nivel_riesgo: 'excursion_critica',
    mensaje: '',
    revisada: false,
    revisada_por: null,
    created_at: HACE_HORAS(20),
    estado: 'pendiente',
    reconocida_en: null,
    atendida_en: null,
    ...overrides,
  }
}

function renderizar(alertas: AlertaTermica[], ultimaAtendida: AlertaTermica | null = null) {
  return render(
    <MemoryRouter>
      <CeldaAlertasPendientes
        total={alertas.length}
        criticas={alertas.filter((a) => a.nivel_riesgo === 'excursion_critica').length}
        alertas={alertas}
        estado="listo"
        reintentar={() => {}}
        nombres={new Map([['FARM-01-CDL', 'Refrigerador principal']])}
        ultimaAtendida={ultimaAtendida}
      />
    </MemoryRouter>,
  )
}

describe('Dashboard — Alertas pendientes', () => {
  it('cada fila dice el nivel y el pico del episodio, con el equipo y la duración debajo', () => {
    renderizar([alerta({ temperatura_pico: 9.6, duracion_s: 2400, iniciada_en: HACE_HORAS(20) })])
    const fila = screen.getAllByRole('listitem')[0]
    expect(fila).toHaveTextContent(/Excursión crítica · 9\.6\s°C/)
    expect(fila).toHaveTextContent(/Refrigerador principal · .* · 40\smin/)
  })

  it('sin pico registrado (alertas anteriores a la evidencia) muestra solo el nivel', () => {
    renderizar([alerta({ nivel_riesgo: 'riesgo_preventivo' })])
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/^Riesgo preventivo/)
  })

  it('con menos de 3 pendientes completa la lista con la última atendida', () => {
    const atendida = alerta({ id: 'al-0', estado: 'atendida', atendida_en: HACE_HORAS(40), temperatura_pico: 8.4 })
    renderizar([alerta()], atendida)
    const filas = screen.getAllByRole('listitem')
    expect(filas).toHaveLength(2)
    expect(filas[1]).toHaveTextContent(/Última atendida: .* · Refrigerador principal/)
  })

  it('la cinta de pendientes dice cuándo empezaron, para lector de pantalla', () => {
    renderizar([alerta({ iniciada_en: HACE_HORAS(20), duracion_s: 2400 })])
    const cinta = screen.getByRole('img', { name: /Alertas pendientes en las últimas 24 h: Excursión crítica, Refrigerador principal/ })
    expect(within(cinta).getAllByTitle(/^Excursión crítica · /)).toHaveLength(1)
  })

  it('con 3 o más pendientes no añade la atendida ni la cinta', () => {
    renderizar([alerta({ id: 'a' }), alerta({ id: 'b' }), alerta({ id: 'c' })], alerta({ id: 'z', estado: 'atendida' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('img', { name: /Alertas pendientes en las últimas/ })).toBeNull()
  })
})
