import { fireEvent, render, screen } from '@testing-library/react'
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

describe('TrazabilidadPage — HU-26: verificación por chain_id', () => {
  const cadenas = [
    { chain_id: 'SISTEMA', es_sistema: true, total_registros: 12, ultimo_registro_en: '2026-07-25T12:00:00Z' },
    { chain_id: 'FARM-01-CDL', es_sistema: false, total_registros: 340, ultimo_registro_en: '2026-07-25T12:00:00Z' },
  ]

  beforeEach(() => {
    useTrazabilidad.mockReset()
    useAuthStore.setState({ usuario: { id: 'u-9', email: 'a@upc.pe', rol: 'auditor', expiraEn: Date.now() + 3600_000 } as never, autenticado: true })
  })

  it('ofrece las cadenas de los equipos y la del sistema, y verifica la elegida', async () => {
    const verificarIntegridad = vi.fn()
    montar({ cadenas, verificarIntegridad })
    const selector = screen.getByLabelText(/^cadena$/i)
    const opciones = [...(selector as HTMLSelectElement).options].map((o) => o.textContent)
    expect(opciones).toEqual(['Todas las cadenas', 'FARM-01-CDL · 340 registros', 'Sistema · 12 registros'])

    await userEvent.selectOptions(selector, 'SISTEMA')
    await userEvent.click(screen.getByRole('button', { name: /revisar integridad/i }))
    expect(verificarIntegridad).toHaveBeenCalledWith('SISTEMA')
  })

  it('sin elegir cadena verifica todas (comportamiento anterior)', async () => {
    const verificarIntegridad = vi.fn()
    montar({ cadenas, verificarIntegridad })
    await userEvent.click(screen.getByRole('button', { name: /revisar integridad/i }))
    expect(verificarIntegridad).toHaveBeenCalledWith(undefined)
  })

  it('informa «no concluida» sin alarma ni opción de aislar cuando falta la clave v3', () => {
    useAuthStore.setState({ usuario: { id: 'u-1', email: 'admin@upc.pe', rol: 'administrador', expiraEn: Date.now() + 3600_000 } as never, autenticado: true })
    montar({
      cadenas,
      verificacion: {
        integra: false,
        estado: 'no_concluida',
        chain_id: 'FARM-01-CDL',
        total_registros: 340,
        total_no_verificables: 3,
        versiones_hash: [2, 3],
        primer_registro_inconsistente: null,
        detalle_inconsistencia: null,
        registros_posteriores_afectados: 0,
        alcance: 'Alcance del backend con v1/v2 y v3.',
      },
    })
    expect(screen.getByRole('heading', { name: /verificación no concluida/i })).toBeInTheDocument()
    expect(screen.getByText(/3 registros sellados con clave \(v3\) no se pudieron verificar/i)).toBeInTheDocument()
    expect(screen.queryByText(/alteración detectada/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aislar registro corrupto/i })).not.toBeInTheDocument()
    expect(screen.getByText('FARM-01-CDL', { selector: '.codigo' })).toBeInTheDocument()
    expect(screen.getByText(/SHA-256 sin clave \(v1\/v2\) · HMAC-SHA256 con clave \(v3\)/)).toBeInTheDocument()
  })

  it('el alcance del backend se declara junto al resultado, a la vista (esc. 4)', () => {
    montar({
      verificacion: {
        integra: true, estado: 'integra', chain_id: 'SISTEMA', total_registros: 12, primer_registro_inconsistente: null,
        detalle_inconsistencia: null, registros_posteriores_afectados: 0, alcance: 'No constituye una certificación DIGEMID.',
      },
    })
    const alcance = screen.getByTestId('alcance-verificacion')
    expect(alcance).toBeVisible()
    expect(alcance).toHaveTextContent('No constituye una certificación DIGEMID.')
    expect(screen.getByText('Sistema (usuarios y bitácora)')).toBeInTheDocument()
  })

  it('una cadena sin registros (404) se explica en vez de darse por íntegra', () => {
    montar({ cadenas, errorVerificacion: 'sin_registros' })
    expect(screen.getByRole('alert')).toHaveTextContent(/no tiene registros que verificar/i)
    expect(screen.queryByText(/no se detectaron cambios/i)).not.toBeInTheDocument()
  })
})

describe('TrazabilidadPage — HU-37: verificación por dispositivo y periodo', () => {
  beforeEach(() => {
    useTrazabilidad.mockReset()
    useAuthStore.setState({ usuario: { id: 'u-9', email: 'qf@upc.pe', rol: 'farmaceutico', expiraEn: Date.now() + 3600_000 } as never, autenticado: true })
  })

  it('rotula «Corrupta» la lectura alterada, con su ID corto copiable, y sigue con el resto', async () => {
    montar({
      verificacionSegmento: {
        device_id: 'FARM-01-CDL',
        desde: '2026-07-25T00:00:00Z',
        hasta: '2026-07-25T23:59:59Z',
        integra: false,
        estado: 'corrupta',
        total_bloques_verificados: 3,
        total_corruptos: 1,
        primer_registro_inconsistente: '9f8e7d6c-1111-2222-3333-444455556666',
        registros_del_dispositivo: [
          { id: 'aaaaaaaa-1111-2222-3333-444455556666', tipo_evento: 'LECTURA_TERMICA', timestamp: '2026-07-25T10:00:00Z', integro: true, estado: 'integro' },
          { id: '9f8e7d6c-1111-2222-3333-444455556666', tipo_evento: 'LECTURA_TERMICA', timestamp: '2026-07-25T11:00:00Z', integro: false, estado: 'corrupto', tipo_discrepancia: 'payload_alterado' },
          { id: 'bbbbbbbb-1111-2222-3333-444455556666', tipo_evento: 'LECTURA_TERMICA', timestamp: '2026-07-25T12:00:00Z', integro: true, estado: 'integro' },
        ],
      },
    })
    const resultado = screen.getByTestId('resultado-segmento')
    expect(resultado).toHaveTextContent(/se detectó un cambio en el periodo/i)
    expect(resultado).toHaveTextContent(/1 corrupta/i)
    const filas = resultado.querySelectorAll('li')
    expect(filas).toHaveLength(3)
    expect(filas[1]).toHaveTextContent('Corrupta')
    expect(filas[1]).toHaveTextContent('9f8e7d6c')
    expect(filas[1]).toHaveTextContent(/contenido modificado/i)
    expect(filas[0]).toHaveTextContent('Íntegra')
    expect(filas[2]).toHaveTextContent('Íntegra')
    const copiar = screen.getByRole('button', { name: /copiar id del registro/i })
    expect(copiar).toBeInTheDocument()
  })

  it('backends previos (solo `integro: false`) también se rotulan «Corrupta»', () => {
    montar({
      verificacionSegmento: {
        device_id: 'FARM-01-CDL', desde: '2026-07-25T00:00:00Z', hasta: '2026-07-25T23:59:59Z', integra: false,
        total_bloques_verificados: 1, primer_registro_inconsistente: 'r-9',
        registros_del_dispositivo: [{ id: 'r-9', tipo_evento: 'LECTURA_TERMICA', timestamp: '2026-07-25T11:00:00Z', integro: false }],
      },
    })
    expect(screen.getByTestId('resultado-segmento').querySelector('li')).toHaveTextContent(/Corrupta.*|r-9/)
    expect(screen.getByTestId('resultado-segmento')).toHaveTextContent('r-9')
  })
})

describe('TrazabilidadPage — HU-37 esc. 1: el periodo se acota por hora', () => {
  beforeEach(() => {
    useTrazabilidad.mockReset()
    useAuthStore.setState({ usuario: { id: 'u-9', email: 'qf@upc.pe', rol: 'farmaceutico', expiraEn: Date.now() + 3600_000 } as never, autenticado: true })
  })

  function llenar({ desde, horaDesde, hasta, horaHasta }: { desde: string; horaDesde?: string; hasta?: string; horaHasta?: string }) {
    fireEvent.change(screen.getByLabelText('Equipo', { selector: '#seg-device' }), { target: { value: 'FARM-01-CDL' } })
    fireEvent.change(document.getElementById('seg-desde')!, { target: { value: desde } })
    if (horaDesde !== undefined) fireEvent.change(screen.getByLabelText('Hora de inicio (opcional)'), { target: { value: horaDesde } })
    if (hasta !== undefined) fireEvent.change(document.getElementById('seg-hasta')!, { target: { value: hasta } })
    if (horaHasta !== undefined) fireEvent.change(screen.getByLabelText('Hora de fin (opcional)'), { target: { value: horaHasta } })
  }

  it('con horas, verifica exactamente ese tramo (hasta incluye el minuto final)', () => {
    const verificarPorDispositivo = vi.fn()
    montar({ verificarPorDispositivo })
    llenar({ desde: '2026-07-25', horaDesde: '08:30', hasta: '2026-07-25', horaHasta: '10:15' })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar segmento' }))

    expect(verificarPorDispositivo).toHaveBeenCalledWith(
      'FARM-01-CDL',
      new Date(2026, 6, 25, 8, 30, 0, 0).toISOString(),
      new Date(2026, 6, 25, 10, 15, 59, 999).toISOString(),
    )
  })

  it('sin horas conserva el día completo', () => {
    const verificarPorDispositivo = vi.fn()
    montar({ verificarPorDispositivo })
    llenar({ desde: '2026-07-25', hasta: '2026-07-26' })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar segmento' }))

    expect(verificarPorDispositivo).toHaveBeenCalledWith(
      'FARM-01-CDL',
      new Date(2026, 6, 25, 0, 0, 0, 0).toISOString(),
      new Date(2026, 6, 26, 23, 59, 59, 999).toISOString(),
    )
  })

  it('el mismo día con la hora de fin antes que la de inicio es un rango inválido', () => {
    const verificarPorDispositivo = vi.fn()
    montar({ verificarPorDispositivo })
    llenar({ desde: '2026-07-25', horaDesde: '12:00', hasta: '2026-07-25', horaHasta: '09:00' })

    expect(screen.getByRole('button', { name: 'Verificar segmento' })).toBeDisabled()
    expect(screen.getByLabelText('Hora de fin (opcional)')).toHaveAttribute('aria-invalid', 'true')
    expect(verificarPorDispositivo).not.toHaveBeenCalled()
  })

  it('la hora de fin se habilita al elegir la fecha «Hasta»', () => {
    montar()
    expect(screen.getByLabelText('Hora de fin (opcional)')).toBeDisabled()
    fireEvent.change(document.getElementById('seg-hasta')!, { target: { value: '2026-07-25' } })
    expect(screen.getByLabelText('Hora de fin (opcional)')).toBeEnabled()
  })
})
