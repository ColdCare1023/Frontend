import { render, screen, within } from '@testing-library/react'
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
  const { rerender } = render(<TrazabilidadPage />)
  vuelta = () => rerender(<TrazabilidadPage />)
}

/** Vuelve a pintar la página con lo que devuelva ahora el hook simulado. */
let vuelta = () => {}

describe('TrazabilidadPage (RF-14, RF-15, HU-26, HU-47)', () => {
  beforeEach(() => {
    useTrazabilidad.mockReset()
    useAuthStore.setState({
      usuario: { id: 'u-1', email: 'admin@upc.pe', rol: 'administrador', expiraEn: Date.now() + 3600_000 },
      autenticado: true,

    })
  })

  it('un solo botón grande pregunta y comprueba', () => {
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Comprobar registros' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '¿Alguien cambió una lectura?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comprobar ahora' })).toBeInTheDocument()
  })

  it('oculta sellos en vista básica y permite expandir detalles técnicos', async () => {
    montar()
    const usuario = userEvent.setup()
    const tecnicos = screen.getByRole('button', { name: 'Ver detalles técnicos' })
    expect(tecnicos).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(tecnicos)

    const boton = screen.getByRole('button', { name: /mostrar sellos/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('columnheader', { name: /sellos/i })).not.toBeInTheDocument()

    await usuario.click(boton)

    expect(screen.getByRole('columnheader', { name: /sellos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ocultar sellos/i })).toHaveAttribute('aria-expanded', 'true')
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

    const respuesta = screen.getByRole('status')
    expect(respuesta).toHaveTextContent('Nadie cambió tus registros')
    expect(within(respuesta).getByText('42', { selector: '.sr-only' })).toBeInTheDocument()
    expect(respuesta).toHaveTextContent(/ninguno cambió desde que se guardó/)
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

    expect(screen.getByRole('heading', { name: 'Un registro no coincide: revísalo' })).toBeInTheDocument()
    // En palabras, cuál es: su tipo y su fecha. La posición #17 sigue en los detalles técnicos y el
    // identificador `r-17` en el bloque de detalle del registro afectado.
    expect(screen.getByRole('status')).toHaveTextContent(/«Lectura registrada»/)
    expect(screen.getByText(/registro #17/)).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Un registro alterado quedó apartado' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Un administrador apartó 1 registro alterado\. Desde el .+ todo coincide\./)
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

  it('la advertencia honesta está a la vista en palabras simples, con o sin revisión', () => {
    montar()
    const simple = screen.getByText(
      'Detecta cambios posteriores, pero no prueba que la lectura original fuera correcta, y quien tenga la clave podría recalcular los registros.',
    )
    expect(simple).toBeVisible()
    expect(simple.closest('[inert]')).toBeNull()
    // La versión técnica, palabra por palabra, sigue en los detalles.
    expect(screen.getByText(/el sello es evidencia, no inmutabilidad absoluta/i).closest('[inert]')).not.toBeNull()
  })

  it('la vista inicial no habla de sellos, hash, HMAC ni cadena', () => {
    montar({ estadoCadena: { cadena_comprometida: false } })
    const vista = document.body.cloneNode(true) as HTMLElement
    vista.querySelectorAll('[inert]').forEach((plegado) => plegado.remove())
    const etiquetas = [...vista.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ')
    expect(`${vista.textContent} ${etiquetas}`).not.toMatch(/sello|hash|hmac|cadena/i)
  })

  it('al comprobar, el botón se vuelve el resultado y el foco pasa a «Comprobar otra vez»', async () => {
    const verificarIntegridad = vi.fn().mockResolvedValue(undefined)
    montar({ verificarIntegridad })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Comprobar ahora' }))
    expect(verificarIntegridad).toHaveBeenCalledTimes(1)

    useTrazabilidad.mockReturnValue({
      ...useTrazabilidad.mock.results[0].value,
      verificarIntegridad,
      verificacion: { integra: true, total_registros: 3, primer_registro_inconsistente: null, detalle_inconsistencia: null, registros_posteriores_afectados: 0 },
    })
    vuelta()
    expect(await screen.findByText(/^Comprobado a las \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comprobar ahora' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comprobar otra vez' })).toHaveFocus()
  })

  it('el formulario por equipo y periodo no va antes del contenido: está en los detalles técnicos', () => {
    montar()
    expect(screen.queryByLabelText('Equipo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /por equipo y periodo/i }).closest('[inert]')).not.toBeNull()
  })

  it('el veredicto se timbra en la cadena y señala el sello roto', () => {
    const detalle = {
      id: 'r-1', tipo_evento: 'LECTURA_REGISTRADA', timestamp: '2026-07-25T12:00:00Z',
      hash_esperado: 'c'.repeat(64), hash_almacenado: 'd'.repeat(64), mensaje: 'x',
    }
    montar({
      registros: [registro({ id: 'r-2', timestamp: '2026-07-25T13:00:00Z' }), registro()],
      verificacion: {
        integra: false, total_registros: 2, primer_registro_inconsistente: 1,
        detalle_inconsistencia: detalle, registros_posteriores_afectados: 1,
      },
    })
    const cadena = screen.getByRole('list', { name: /últimos registros/i })
    expect(within(cadena).getByText('No coincide')).toBeInTheDocument()
    expect(within(cadena).getByText('Afectado')).toBeInTheDocument()
  })

  it('verifica un segmento y bloquea el rango invertido antes de enviar (HU-37)', async () => {
    const verificarPorDispositivo = vi.fn()
    montar({ verificarPorDispositivo })
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: 'Ver detalles técnicos' }))
    await usuario.click(screen.getByRole('button', { name: /por equipo y periodo/i }))
    const panel = await screen.findByRole('dialog', { name: /por equipo y periodo/i })
    await usuario.type(within(panel).getByLabelText('Equipo'), 'FARM-01-CDL')
    await usuario.type(within(panel).getByLabelText('Desde'), '2026-07-25')
    await usuario.type(within(panel).getByLabelText('Hasta'), '2026-07-20')
    expect(within(panel).getByRole('alert')).toHaveTextContent(/no puede ser posterior/i)
    expect(within(panel).getByRole('button', { name: 'Verificar' })).toBeDisabled()

    await usuario.clear(within(panel).getByLabelText('Hasta'))
    await usuario.click(within(panel).getByRole('button', { name: 'Verificar' }))
    expect(verificarPorDispositivo).toHaveBeenCalledWith('FARM-01-CDL', expect.any(String), expect.any(String))
  })

  it('si la revisión falla lo dice en el campo, sin dejar un veredicto falso', async () => {
    montar({ verificarIntegridad: vi.fn().mockRejectedValue(new Error('red caída')) })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Comprobar ahora' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ocurrió un error/i)
    expect(screen.queryByText(/nadie cambió/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comprobar ahora' })).toBeInTheDocument()
  })
})
