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

    })
  })

  it('un fallo de carga se muestra como error, no como cadena sin registros', async () => {
    const consultar = vi.fn()
    montar({ registros: [], errorCarga: true, consultar })

    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar/i)
    expect(screen.queryByText(/no hay registros de trazabilidad/i)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(consultar).toHaveBeenCalled()
  })

  it('ofrece verificar la integridad de la cadena', () => {
    montar()
    expect(screen.getByRole('button', { name: /revisar integridad/i })).toBeInTheDocument()
  })

  it('oculta sellos en vista básica y permite expandir detalles técnicos', async () => {
    montar()
    const boton = screen.getByRole('button', { name: /mostrar detalles técnicos/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('columnheader', { name: /sellos/i })).not.toBeInTheDocument()

    await userEvent.setup().click(boton)

    expect(screen.getByRole('columnheader', { name: /sellos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ocultar detalles técnicos/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('informa que no se detectaron cambios cuando la revisión es íntegra', () => {
    montar({
      verificacion: {
        integra: true,
        total_registros: 42,
        primer_registro_inconsistente: null,
        detalle_inconsistencia: null,
        registros_posteriores_afectados: 0,
      },
    })

    expect(screen.getByText(/no se detectaron cambios/i)).toBeInTheDocument()
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

    expect(screen.getByText(/se detectó una inconsistencia en el historial/i)).toBeInTheDocument()
  })

  // HU-26 escenarios 2-4.
  it('muestra la ruptura aislada como cadena verificable de nuevo, con su fecha', () => {
    montar({
      verificacion: {
        integra: false,
        estado: 'ruptura_aislada',
        total_registros: 50,
        primer_registro_inconsistente: 3,
        detalle_inconsistencia: null,
        registros_posteriores_afectados: 46,
        total_rupturas: 1,
        integra_desde: '2026-10-24T13:00:00Z',
      },
    })
    expect(screen.getByText(/ruptura aislada/i)).toBeInTheDocument()
    expect(screen.getByText(/1 alteración\(es\) histórica\(s\) aislada\(s\)/i)).toBeInTheDocument()
    expect(screen.queryByTestId('detalle-inconsistencia')).not.toBeInTheDocument()
  })

  it('informa el tipo de discrepancia y cuánto sigue enlazado después de la ruptura', () => {
    montar({
      verificacion: {
        integra: false,
        estado: 'ruptura_detectada',
        total_registros: 10,
        primer_registro_inconsistente: 2,
        detalle_inconsistencia: {
          id: 'r-2', tipo_evento: 'LECTURA_REGISTRADA', timestamp: '2026-10-24T12:00:00Z',
          hash_esperado: 'a'.repeat(64), hash_almacenado: 'b'.repeat(64), mensaje: 'x',
          tipo_discrepancia: 'payload_alterado',
        },
        registros_posteriores_afectados: 7,
        registros_posteriores_consistentes: 7,
        total_rupturas: 1,
      },
    })
    const detalle = screen.getByTestId('detalle-inconsistencia')
    expect(detalle).toHaveTextContent(/contenido modificado después de registrarse/i)
    expect(detalle).toHaveTextContent('7 de 7')
  })

  it('declara que la verificación no es una certificación DIGEMID', () => {
    montar({
      verificacion: {
        integra: true, total_registros: 1, primer_registro_inconsistente: null,
        detalle_inconsistencia: null, registros_posteriores_afectados: 0,
      },
    })
    expect(screen.getByTestId('alcance-verificacion')).toHaveTextContent(/DIGEMID/)
  })
})

describe('TrazabilidadPage — rediseño P6 (veredicto y registros)', () => {
  const corrupcion = {
    integra: false,
    estado: 'ruptura_detectada',
    total_registros: 10,
    primer_registro_inconsistente: 1,
    detalle_inconsistencia: {
      id: 'r-1', tipo_evento: 'LECTURA_REGISTRADA', timestamp: '2026-07-25T12:00:00Z',
      hash_esperado: 'abc1' + 'a'.repeat(60), hash_almacenado: 'abc2' + 'a'.repeat(60), mensaje: 'x',
    },
    registros_posteriores_afectados: 0,
  }
  const comoRol = (rol: string) =>
    useAuthStore.setState({ usuario: { id: 'u-9', email: 'x@upc.pe', rol, expiraEn: Date.now() + 3600_000 } as never, autenticado: true })

  beforeEach(() => useTrazabilidad.mockReset())

  it('al entrar muestra el veredicto sin verificar con una sola acción de verificación (H8)', () => {
    comoRol('administrador')
    montar()
    expect(screen.getByRole('heading', { name: /sin alertas de integridad/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /revisar integridad/i })).toHaveLength(1)
  })

  it('muestra Verificando… mientras verifica', () => {
    comoRol('administrador')
    montar({ verificando: true })
    expect(screen.getByRole('heading', { name: /verificando la cadena/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verificando/i })).toBeDisabled()
  })

  it.each(['tecnico', 'farmaceutico', 'auditor'])('el rol %s no ve Aislar registro corrupto (HU-26)', (rol) => {
    comoRol(rol)
    montar({ verificacion: corrupcion })
    expect(screen.queryByRole('button', { name: /aislar registro corrupto/i })).not.toBeInTheDocument()
  })

  it('el administrador ve Aislar registro corrupto', () => {
    comoRol('administrador')
    montar({ verificacion: corrupcion })
    expect(screen.getByRole('button', { name: /aislar registro corrupto/i })).toBeInTheDocument()
  })

  it('Ver registro en la tabla expande la fila corrupta', async () => {
    comoRol('auditor')
    montar({ verificacion: corrupcion })
    await userEvent.click(screen.getByRole('button', { name: /ver registro en la tabla/i }))
    const fila = screen.getByTestId('fila-corrupta')
    expect(fila.querySelector('button[aria-expanded="true"]')).not.toBeNull()
  })

  it('resalta desde qué carácter difieren los sellos', () => {
    comoRol('auditor')
    montar({ verificacion: corrupcion })
    expect(screen.getByTestId('detalle-inconsistencia')).toHaveTextContent(/difieren desde el carácter 4/i)
  })

  it('cada evento muestra su icono y su nombre; el detalle muestra los sellos completos', async () => {
    comoRol('auditor')
    montar({ registros: [registro({ payload: { temperatura_interna: 5.2, riesgo_efectivo: 'normal' } })] })
    expect(screen.getAllByText(/5\.2 °C · normal/i).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: /ver detalle de/i }))
    const detalle = document.getElementById('detalle-r-1') as HTMLElement
    expect(detalle).toHaveTextContent('a'.repeat(64))
    expect(detalle).toHaveTextContent('b'.repeat(64))
    expect(detalle).toHaveTextContent(/contenido del registro/i)
  })
})
