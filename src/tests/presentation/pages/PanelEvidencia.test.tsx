import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { aEvidencia, type EvidenciaInferencia, type InferenciaLecturaApi } from '@/application/hooks/useEvidenciaInferencia'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { PanelEvidencia } from '@/presentation/pages/historial/PanelEvidencia'

const LECTURA = {
  id: 'l-1',
  device_id: 'FARM-01-CDL',
  timestamp: '2026-10-26T12:00:00Z',
  temperatura_interna: 5.1,
  nivel_riesgo: 'normal',
  riesgo_efectivo: 'normal',
  estado_inferencia: 'completada',
  excursion_confirmada: false,
} as LecturaTermica

function api(over: Partial<InferenciaLecturaApi> = {}): InferenciaLecturaApi {
  return {
    lectura_id: 'l-1',
    device_id: 'FARM-01-CDL',
    timestamp_inferencia: '2026-10-26T12:00:01Z',
    modelo_version: '4.0.0-binario',
    vector_features: { temperatura_interna: 5.1 },
    probabilidades_por_clase: { normal: 0.91, riesgo_preventivo: 0.09 },
    clasificacion_final: 'normal',
    confianza: 0.91,
    origen_clasificacion: 'random_forest',
    version_era_activa_y_aprobada_en_ese_momento: false,
    version_activa_en_ese_momento: null,
    estado_inferencia: 'completada',
    excursion_confirmada: false,
    riesgo_efectivo: 'normal',
    ia_experimental: true,
    ...over,
  }
}

function montar(evidencia: EvidenciaInferencia, lectura: LecturaTermica = LECTURA) {
  render(<PanelEvidencia lectura={lectura} evidencia={evidencia} cargando={false} error={false} onCerrar={vi.fn()} />)
}

/** Insignia del «Riesgo efectivo» (la primera del panel). */
function estadoRotulado(): string | null {
  return document.querySelector('[data-estado-riesgo]')?.getAttribute('data-estado-riesgo') ?? null
}

/** HU-47: la evidencia real no lleva rótulos de demostración. */
describe('PanelEvidencia (HU-47)', () => {
  it('con datos reales de un modelo experimental lo rotula como no aprobado, sin «Ejemplo simulado»', () => {
    montar(aEvidencia(api()))
    expect(screen.getByText('Modelo experimental (no aprobado).')).toBeInTheDocument()
    expect(screen.queryByText(/Ejemplo simulado/)).not.toBeInTheDocument()
    expect(screen.queryByText('Probabilidades ilustrativas')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Probabilidades del modelo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Datos de entrada del modelo' })).toBeInTheDocument()
  })

  it('muestra si la versión era la activa y aprobada al clasificar (esc. 2)', () => {
    montar(aEvidencia(api({ version_activa_en_ese_momento: '3.9.0' })))
    expect(screen.getByText('Versión activa y aprobada al clasificar')).toBeInTheDocument()
    expect(screen.getByTestId('version-aprobada-al-clasificar')).toHaveTextContent('No')
    expect(screen.getByText('La versión activa en ese momento era 3.9.0.')).toBeInTheDocument()
  })

  it('con una versión aprobada responde «Sí» y no rotula experimental', () => {
    montar(aEvidencia(api({ ia_experimental: false, version_era_activa_y_aprobada_en_ese_momento: true, version_activa_en_ese_momento: '4.0.0-binario' })))
    expect(screen.getByTestId('version-aprobada-al-clasificar')).toHaveTextContent('Sí')
    expect(screen.queryByText('Modelo experimental (no aprobado).')).not.toBeInTheDocument()
  })

  it('sin inferencia del modelo no afirma ni niega la aprobación', () => {
    montar(aEvidencia(api({ version_era_activa_y_aprobada_en_ese_momento: null, estado_inferencia: 'omitida', clasificacion_final: null })))
    expect(screen.getByTestId('version-aprobada-al-clasificar')).toHaveTextContent('Sin dato: el modelo no clasificó esta lectura')
  })

  it('el rótulo «Ejemplo simulado» queda solo para la demostración', () => {
    montar({ ...aEvidencia(api()), datos_simulados: true })
    expect(screen.getByText(/Ejemplo simulado/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Probabilidades ilustrativas' })).toBeInTheDocument()
    expect(screen.queryByText('Modelo experimental (no aprobado).')).not.toBeInTheDocument()
  })
})

/** HU-34 esc. 4 (P2 de la re-auditoría): la insignia del panel usa `estado_riesgo`. */
describe('PanelEvidencia: estado de riesgo rotulado (HU-34)', () => {
  it('una lectura sin clasificación IA no se rotula «Normal» aunque el riesgo efectivo lo sea', () => {
    montar(aEvidencia(api({ estado_inferencia: 'omitida', clasificacion_final: null, estado_riesgo: 'sin_clasificacion_ia' })))
    expect(estadoRotulado()).toBe('sin_clasificacion_ia')
    expect(screen.getAllByText('Sin clasificación IA').length).toBeGreaterThan(0)
  })

  it('una falla de sensor se rotula como tal', () => {
    montar(aEvidencia(api({ estado_riesgo: 'falla_sensor', riesgo_efectivo: null })))
    expect(estadoRotulado()).toBe('falla_sensor')
  })

  it('sin `estado_riesgo` (backend anterior) usa el mismo estado que la fila del Historial', () => {
    const sinInferencia = { ...LECTURA, estado_inferencia: 'omitida', nivel_riesgo: null } as LecturaTermica
    montar(aEvidencia(api({ estado_inferencia: 'omitida', clasificacion_final: null })), sinInferencia)
    expect(estadoRotulado()).toBe('sin_clasificacion_ia')
  })

  it('un valor desconocido de `estado_riesgo` no se rotula: cae al estado de la lectura', () => {
    const evidencia = aEvidencia(api({ estado_riesgo: 'otro' }))
    expect(evidencia.estado_riesgo).toBeNull()
    montar(evidencia)
    expect(estadoRotulado()).toBe('normal')
  })
})
