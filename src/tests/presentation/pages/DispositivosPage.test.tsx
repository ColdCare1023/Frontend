import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'

const useDispositivos = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useDispositivos', () => ({ useDispositivos }))

import { DispositivosPage } from '@/presentation/pages/DispositivosPage'

function dispositivo(over: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id: 'FARM-01-CDL',
    nombre: 'Refrigerador principal',
    ubicacion: 'Sala 1',
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
    fecha_instalacion: null,
    instalado_por: null,
    observaciones_instalacion: null,
    responsable_nombre: null,
    responsable_email: null,
    responsable_telefono: null,
    ...over,
  }
}

function montar(dispositivos: Dispositivo[]) {
  useDispositivos.mockReturnValue({
    dispositivos,
    cargando: false,
    consultar: vi.fn(),
    darDeBaja: vi.fn(),
    registrarCalibracion: vi.fn(),
    actualizarInstalacion: vi.fn(),
    actualizarResponsable: vi.fn(),
    obtenerHistorialConfiguracion: vi.fn().mockResolvedValue([]),
  })
  return render(<DispositivosPage />)
}

describe('DispositivosPage (HU-43, RF-18)', () => {
  beforeEach(() => useDispositivos.mockReset())

  it('muestra el device_id y su versión de firmware', () => {
    montar([dispositivo()])

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('distingue un nodo en línea de uno sin conexión', () => {
    // El estado se muestra traducido, no como el literal del backend: la
    // interfaz es bilingüe y «online»/«offline» eran las dos únicas cadenas
    // que se colaban sin pasar por i18n.
    montar([dispositivo({ id: 'FARM-01-CDL', estado_conectividad: 'online' })])
    expect(screen.getByText('En línea')).toBeInTheDocument()

    montar([dispositivo({ id: 'FARM-02-CDL', estado_conectividad: 'offline' })])
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })

  it('marca visiblemente un dispositivo dado de baja', () => {
    // HU-43: la baja no borra el histórico, así que el equipo tiene que poder
    // distinguir de un vistazo qué nodos ya no están en servicio.
    montar([dispositivo({ activo: false, motivo_baja: 'falla_hardware' })])

    expect(screen.getByText(/dado de baja/i)).toBeInTheDocument()
  })

  it('avisa cuando no hay dispositivos registrados', () => {
    montar([])
    expect(screen.getByText(/no hay dispositivos|sin dispositivos/i)).toBeInTheDocument()
  })
})
