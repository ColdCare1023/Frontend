import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import { seccionesPermitidas } from '@/presentation/navegacion'

const useHistorialConfiguracion = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useHistorialConfiguracion', () => ({ useHistorialConfiguracion }))

import { ConfiguracionEquiposPage } from '@/presentation/pages/ConfiguracionEquiposPage'

const CAMBIOS: HistorialConfiguracion[] = [
  {
    id: 'c-2', device_id: 'FARM-01-CDL', campo: 'intervalo_reporte_segundos (administrador)', campo_base: 'intervalo_reporte_segundos',
    origen: 'administrador', categoria: 'intervalo', valor_anterior: '60', valor_nuevo: '30', actor_id: 'u-2', actor_nombre: 'Ana Admin',
    created_at: '2026-10-15T12:00:00Z', vigente_desde: '2026-10-15T12:00:00Z', vigente_hasta: null,
  },
  {
    id: 'c-1', device_id: 'FARM-01-CDL', campo: 'ubicacion', campo_base: 'ubicacion', origen: null, categoria: 'instalacion',
    valor_anterior: null, valor_nuevo: 'Almacén', actor_id: null, actor_nombre: null,
    created_at: '2026-08-01T12:00:00Z', vigente_desde: '2026-08-01T12:00:00Z', vigente_hasta: '2026-09-01T12:00:00Z',
  },
]

function montar(over: Record<string, unknown> = {}) {
  const consultar = vi.fn()
  useHistorialConfiguracion.mockReturnValue({ equipos: ['FARM-01-CDL', 'FARM-02-CDL'], cambios: CAMBIOS, cargando: false, error: null, consultar, ...over })
  render(<ConfiguracionEquiposPage />)
  return consultar
}

describe('ConfiguracionEquiposPage — HU-49: historial de configuración para el auditor', () => {
  beforeEach(() => useHistorialConfiguracion.mockReset())

  it('abre el primer equipo y muestra anterior → nuevo, actor y vigencia de cada cambio', () => {
    const consultar = montar()
    expect(consultar).toHaveBeenCalledWith('FARM-01-CDL', {})
    const lista = screen.getByRole('list')
    const [intervalo, ubicacion] = within(lista).getAllByRole('listitem')
    expect(intervalo).toHaveTextContent('Intervalo de reporte')
    expect(intervalo).toHaveTextContent(/60\s*→\s*30/)
    expect(intervalo).toHaveTextContent('Por Ana Admin')
    expect(intervalo).toHaveTextContent('origen: administrador')
    expect(intervalo).toHaveTextContent(/vigente desde el .* \(actual\)/i)
    expect(ubicacion).toHaveTextContent('Por el sistema')
    expect(ubicacion).toHaveTextContent(/vigente del .* al /i)
  })

  it('filtra por categoría en el servidor', async () => {
    const consultar = montar()
    consultar.mockClear()
    await userEvent.selectOptions(screen.getByLabelText(/categoría/i), 'calibracion')
    expect(consultar).toHaveBeenCalledWith('FARM-01-CDL', { categoria: 'calibracion' })
    expect(screen.getByText('Categoría: Calibración')).toBeInTheDocument()
  })

  it('cambiar de equipo consulta su historial', async () => {
    const consultar = montar()
    await userEvent.selectOptions(screen.getByLabelText(/^equipo$/i), 'FARM-02-CDL')
    expect(consultar).toHaveBeenLastCalledWith('FARM-02-CDL', {})
  })

  it('declara que es de solo lectura, que no reescribe la telemetría y que 2–8 °C es fijo (esc. 3 y 4)', () => {
    montar()
    const rail = screen.getByRole('complementary', { name: /alcance del historial/i })
    expect(rail).toHaveTextContent(/no se puede editar ni borrar/i)
    expect(rail).toHaveTextContent(/no recalcula ni reescribe las lecturas/i)
    expect(rail).toHaveTextContent(/no forma parte de la configuración editable/i)
    // Sin controles de edición.
    expect(screen.queryByRole('button', { name: /guardar|editar|registrar/i })).not.toBeInTheDocument()
  })

  it('un equipo inexistente se informa sin mostrar un historial vacío', () => {
    montar({ cambios: [], error: 'no_encontrado' })
    expect(screen.getByRole('alert')).toHaveTextContent(/no encontramos el equipo «FARM-01-CDL»/i)
  })

  it('sin equipos registrados explica cuándo aparecerá el historial', () => {
    montar({ equipos: [], cambios: [] })
    expect(screen.getByText(/aún no hay equipos con historial/i)).toBeInTheDocument()
  })
})

describe('navegación — HU-49', () => {
  const rutas = (rol: Parameters<typeof seccionesPermitidas>[0]) => seccionesPermitidas(rol).flatMap((s) => s.items.map((i) => i.ruta))

  it('el auditor y el administrador ven «Configuración de equipos»; el técnico y el QF no', () => {
    expect(rutas('auditor')).toContain('/configuracion-equipos')
    expect(rutas('administrador')).toContain('/configuracion-equipos')
    expect(rutas('tecnico')).not.toContain('/configuracion-equipos')
    expect(rutas('farmaceutico')).not.toContain('/configuracion-equipos')
  })
})

describe('LineaTiempoCambios — HU-49: campos con origen y responsable_contacto', () => {
  it('filtra por el campo base aunque el backend añada el origen, y rotula los campos nuevos', async () => {
    const { LineaTiempoCambios } = await import('@/presentation/pages/dispositivos/detalle/LineaTiempoCambios')
    const { CAMPOS_INTERVALO, CAMPOS_REEMPLAZO, CAMPOS_RESPONSABLE, campoBase } = await import('@/presentation/pages/dispositivos/estadoEquipo')
    const sinBase = { ...CAMBIOS[0], campo_base: undefined }
    expect(campoBase(sinBase)).toBe('intervalo_reporte_segundos')
    const contacto: HistorialConfiguracion = { ...CAMBIOS[1], id: 'c-3', campo: 'responsable_contacto', campo_base: 'responsable_contacto', valor_nuevo: 'qf@farmacia.pe' }
    const reemplazo: HistorialConfiguracion = { ...CAMBIOS[1], id: 'c-4', campo: 'reemplazado_por', campo_base: 'reemplazado_por', valor_nuevo: 'FARM-03-CDL' }

    const { rerender } = render(<LineaTiempoCambios cambios={[sinBase, contacto, reemplazo]} cargando={false} campos={CAMPOS_INTERVALO} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Intervalo de reporte')).toBeInTheDocument()

    rerender(<LineaTiempoCambios cambios={[sinBase, contacto, reemplazo]} cargando={false} campos={CAMPOS_RESPONSABLE} />)
    expect(screen.getByText('Contacto del responsable')).toBeInTheDocument()

    rerender(<LineaTiempoCambios cambios={[sinBase, contacto, reemplazo]} cargando={false} campos={CAMPOS_REEMPLAZO} />)
    expect(screen.getByText('Reemplazado por')).toBeInTheDocument()
  })
})
