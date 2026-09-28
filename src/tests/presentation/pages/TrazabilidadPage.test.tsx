import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RegistroTrazabilidad } from '@/domain/entities/RegistroTrazabilidad'
import { useAuthStore } from '@/application/stores/authStore'

const useTrazabilidad = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useTrazabilidad', () => ({ useTrazabilidad }))

import { TrazabilidadPage } from '@/presentation/pages/TrazabilidadPage'

function registro(over: Partial<RegistroTrazabilidad> = {}): RegistroTrazabilidad {
  return {
    id: 'r-1',
    tipo_evento: 'LECTURA_REGISTRADA',
    device_id: 'FARM-01-CDL',
    usuario_id: null,
    payload: {},
    timestamp: '2026-07-25T12:00:00Z',
    previous_hash: 'a'.repeat(64),
    hash_actual: 'b'.repeat(64),
    ...over,
  }
}

function montar(over: Record<string, unknown> = {}) {
  useTrazabilidad.mockReturnValue({
    registros: [registro()],
    cargando: false,
    consultar: vi.fn(),
    verificacion: null,
    verificando: false,
    verificarIntegridad: vi.fn(),
    estadoCadena: { cadena_comprometida: false },
    aislarCorrupcion: vi.fn(),
    verificacionSegmento: null,
    verificandoSegmento: false,
    errorSegmento: null,
    verificarPorDispositivo: vi.fn(),
    ...over,
  })
  render(<TrazabilidadPage />)
}

describe('TrazabilidadPage (RF-14, RF-15, HU-26, HU-47)', () => {
  beforeEach(() => {
    useTrazabilidad.mockReset()
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'admin@upc.pe', rol: 'administrador', expiraEn: Date.now() + 3600_000 },
      autenticado: true,
      requierePrivacidad: false,
    })
  })

  it('ofrece verificar la integridad de la cadena', () => {
    montar()
    expect(screen.getByRole('button', { name: /verificar registros/i })).toBeInTheDocument()
  })

  it('oculta sellos en vista básica y permite expandir detalles técnicos', async () => {
    montar()
    const boton = screen.getByRole('button', { name: /mostrar detalles técnicos/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('columnheader', { name: 'Sello anterior' })).not.toBeInTheDocument()

    await userEvent.setup().click(boton)

    expect(screen.getByRole('columnheader', { name: 'Sello anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ocultar detalles técnicos/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('confirma que los registros están intactos cuando la cadena es íntegra', () => {
    montar({
      verificacion: {
        integra: true,
        total_registros: 42,
        primer_registro_inconsistente: null,
        detalle_inconsistencia: null,
        registros_posteriores_afectados: 0,
      },
    })

    expect(screen.getByText(/registros intactos/i)).toBeInTheDocument()
  })

  it('denuncia la alteración señalando el registro roto', () => {
    // RF-15: detectar la alteración no basta, hay que decir CUÁL se alteró;
    // es lo que convierte la cadena en evidencia utilizable.
    montar({
      verificacion: {
        integra: false,
        total_registros: 42,
        primer_registro_inconsistente: 17,
        detalle_inconsistencia: {
          id: 'r-17',
          tipo_evento: 'LECTURA_REGISTRADA',
          timestamp: '2026-07-25T11:00:00Z',
          hash_esperado: 'c'.repeat(64),
          hash_almacenado: 'd'.repeat(64),
          mensaje: 'Hash no coincide',
        },
        registros_posteriores_afectados: 25,
      },
    })

    expect(screen.getByText(/alteración detectada/i)).toBeInTheDocument()
    // `getAllByText`: la posición aparece en el resumen y el identificador
    // `r-17` en el nuevo bloque de detalle del registro afectado.
    expect(screen.getAllByText(/17/).length).toBeGreaterThan(0)
  })

  it('avisa cuando la cadena quedó comprometida (HU-47)', () => {
    montar({ estadoCadena: { cadena_comprometida: true } })

    expect(screen.getByText(/alteración crítica detectada en la cadena/i)).toBeInTheDocument()
  })
})
