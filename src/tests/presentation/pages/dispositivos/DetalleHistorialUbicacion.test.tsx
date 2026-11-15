/**
 * P2 de la re-auditoría en el detalle del equipo:
 * - HU-34/HU-07: la pestaña Historial rotula el riesgo con `estado_riesgo` (una
 *   lectura sin clasificación IA no sale como «Normal») y la hora de captura
 *   con `HoraLectura` («Sin hora» si no la hay, «≈» si se reconstruyó).
 * - HU-51: la pestaña Ubicación muestra quién registró la instalación.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dispositivo, HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/infrastructure/api/apiClient', () => ({
  apiClient: { get },
  API_BASE_URL: '',
  getAccessToken: () => null,
}))
const flota = vi.hoisted(() => ({
  obtenerHistorialConfiguracion: vi.fn(),
  actualizarInstalacion: vi.fn(),
  actualizarResponsable: vi.fn(),
}))
vi.mock('@/presentation/pages/dispositivos/contextoFlota', () => ({ useFlota: () => flota }))

import { TabHistorial } from '@/presentation/pages/dispositivos/detalle/TabHistorial'
import { TabUbicacion } from '@/presentation/pages/dispositivos/detalle/TabUbicacion'
import { nombreInstalador } from '@/presentation/pages/dispositivos/estadoEquipo'

const ADMIN = '7f1c2d3e-0000-4000-8000-000000000001'

function dispositivo(over: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id: 'FARM-01-CDL',
    nombre: 'Refrigerador principal',
    ubicacion: 'Estante 2',
    estado_conectividad: 'online',
    activo: true,
    firmware_version: '1.0.0',
    motivo_baja: null,
    descripcion_baja: null,
    dado_de_baja_en: null,
    reemplaza_a_device_id: null,
    fecha_ultima_calibracion: null,
    numero_certificado_calibracion: null,
    fecha_proxima_calibracion: null,
    observaciones_calibracion: null,
    fecha_instalacion: '2026-11-01',
    instalado_por: ADMIN,
    observaciones_instalacion: null,
    responsable_nombre: null,
    responsable_email: null,
    responsable_telefono: null,
    ...over,
  }
}

function lectura(over: Partial<LecturaTermica>): LecturaTermica {
  return {
    id: 'l-1',
    device_id: 'FARM-01-CDL',
    timestamp: '2026-10-26T12:00:00Z',
    temperatura_interna: 5,
    temperatura_ambiental: 21,
    humedad_ambiental: 50,
    apertura_refrigerador: false,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    riesgo_efectivo: 'normal',
    estado_inferencia: 'completada',
    excursion_confirmada: false,
    ...over,
  } as LecturaTermica
}

function cambio(over: Partial<HistorialConfiguracion>): HistorialConfiguracion {
  return {
    id: 'c-1',
    device_id: 'FARM-01-CDL',
    campo: 'ubicacion',
    valor_anterior: 'Estante 1',
    valor_nuevo: 'Estante 2',
    actor_id: ADMIN,
    actor_nombre: 'Ana Admin',
    created_at: '2026-11-01T10:00:00Z',
    ...over,
  }
}

function filas(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('TabHistorial del equipo (HU-34 esc. 4 y HU-07)', () => {
  beforeEach(() => get.mockReset())

  it('rotula «Sin clasificación IA» y «Falla de sensor» en vez de «Normal»', async () => {
    get.mockResolvedValue({
      data: [
        lectura({ id: 'a', estado_riesgo: 'sin_clasificacion_ia', estado_inferencia: 'omitida', nivel_riesgo: null }),
        lectura({ id: 'b', estado_riesgo: 'falla_sensor', temperatura_interna: null }),
        // Backend anterior (sin `estado_riesgo`): misma regla que el tablero.
        lectura({ id: 'c', estado_inferencia: 'fallida', nivel_riesgo: null }),
        lectura({ id: 'd' }),
      ],
    })
    render(<MemoryRouter><TabHistorial dispositivo={dispositivo()} /></MemoryRouter>)

    await screen.findByRole('table')
    const estados = filas().map((f) => f.querySelector('[data-estado-riesgo]')?.getAttribute('data-estado-riesgo'))
    expect(estados).toEqual(['sin_clasificacion_ia', 'falla_sensor', 'sin_clasificacion_ia', 'normal'])
  })

  it('una lectura sin hora de captura se rotula «Sin hora» y una reconstruida lleva «≈»', async () => {
    get.mockResolvedValue({
      data: [
        lectura({ id: 'a', time_quality: 'unsynced', sin_hora: true, recibida_en: '2026-10-26T12:00:05Z' }),
        lectura({ id: 'b', time_quality: 'unsynced', timestamp_estimado: '2026-10-26T11:58:00Z', origen_hora: 'reconstruida' }),
        lectura({ id: 'c', time_quality: 'synced' }),
      ],
    })
    render(<MemoryRouter><TabHistorial dispositivo={dispositivo()} /></MemoryRouter>)

    await screen.findByRole('table')
    const [sinHora, reconstruida, normal] = filas().map((f) => f.querySelector('td') as HTMLElement)
    expect(sinHora).toHaveTextContent('Sin hora')
    expect(sinHora.querySelector('[data-sin-hora]')).not.toBeNull()
    expect(reconstruida).toHaveTextContent('≈')
    expect(reconstruida.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-26T11:58:00Z')
    expect(normal.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-26T12:00:00Z')
    expect(normal).not.toHaveTextContent('≈')
  })
})

describe('TabUbicacion: instalador (HU-51 esc. 2)', () => {
  beforeEach(() => flota.obtenerHistorialConfiguracion.mockReset())

  it('muestra el nombre de quien registró la instalación', async () => {
    flota.obtenerHistorialConfiguracion.mockResolvedValue([cambio({})])
    render(<TabUbicacion dispositivo={dispositivo()} />)

    const dato = (await screen.findByText('Instalado por')).parentElement as HTMLElement
    expect(await within(dato).findByText('Ana Admin')).toBeInTheDocument()
  })

  it('sin instalador registrado muestra «—»', async () => {
    flota.obtenerHistorialConfiguracion.mockResolvedValue([])
    render(<TabUbicacion dispositivo={dispositivo({ instalado_por: null })} />)

    const dato = (await screen.findByText('Instalado por')).parentElement as HTMLElement
    expect(dato).toHaveTextContent('—')
  })

  it('si el historial no trae su nombre, identifica al usuario sin inventar uno', async () => {
    flota.obtenerHistorialConfiguracion.mockResolvedValue([cambio({ actor_id: 'otro', actor_nombre: 'Otra persona' })])
    render(<TabUbicacion dispositivo={dispositivo()} />)

    const dato = (await screen.findByText('Instalado por')).parentElement as HTMLElement
    expect(await within(dato).findByText('Usuario 7f1c2d3e…')).toHaveAttribute('title', ADMIN)
    expect(dato).not.toHaveTextContent('Otra persona')
  })
})

describe('nombreInstalador', () => {
  it('toma el nombre de una fila firmada por el instalador', () => {
    expect(nombreInstalador(ADMIN, [cambio({ actor_nombre: null }), cambio({ actor_nombre: 'Ana Admin' })])).toBe('Ana Admin')
    expect(nombreInstalador(null, [cambio({})])).toBeNull()
    expect(nombreInstalador(ADMIN, [])).toBeNull()
  })
})
