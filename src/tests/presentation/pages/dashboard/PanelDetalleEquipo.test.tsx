import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { PanelDetalleEquipo } from '@/presentation/pages/dashboard/PanelDetalleEquipo'
import { instalarAdaptadorFalso } from '../../../ayudas'
import { errores, esquemaPeticion } from '../../../contrato/validarOpenApi'

function equipo(over: Partial<Dispositivo> = {}): Dispositivo {
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
    fecha_ultima_calibracion: '2025-01-10',
    numero_certificado_calibracion: 'CAL-2025-01',
    fecha_proxima_calibracion: '2026-01-10',
    margen_aviso_calibracion_dias: 45,
    observaciones_calibracion: null,
    fecha_instalacion: null,
    instalado_por: null,
    observaciones_instalacion: null,
    responsable_nombre: null,
    responsable_email: null,
    responsable_telefono: null,
    estado_operativo: 'OPERATIVO',
    ...over,
  }
}

function montar(puedeCalibrar: boolean, onCalibracionRegistrada = vi.fn()) {
  render(
    <MemoryRouter>
      <PanelDetalleEquipo
        equipo={equipo()}
        puedeGestionar={false}
        puedeCalibrar={puedeCalibrar}
        onCalibracionRegistrada={onCalibracionRegistrada}
        onCerrar={vi.fn()}
        onMostrar={vi.fn()}
      />
    </MemoryRouter>,
  )
  return onCalibracionRegistrada
}

let adaptador: ReturnType<typeof instalarAdaptadorFalso> | undefined
afterEach(() => adaptador?.restaurar())

async function llenarYGuardar() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Registrar calibración' }))
  const certificado = screen.getByLabelText('N.° de certificado')
  await user.clear(certificado)
  await user.type(certificado, 'CAL-2026-QF')
  await user.type(screen.getByLabelText('Fecha de calibración'), '2026-11-10')
  await user.type(screen.getByLabelText('Vencimiento del certificado'), '2027-11-10')
  const margen = screen.getByLabelText('Avisar antes (días)')
  await user.clear(margen)
  await user.type(margen, '20')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
}

/** HU-30: el Químico Farmacéutico registra la calibración desde la ficha del equipo. */
describe('PanelDetalleEquipo — HU-30 calibración (QF)', () => {
  it('muestra la calibración vencida y el margen de aviso configurado', () => {
    montar(false)
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveTextContent(/Calibración vencida el/)
    expect(panel).toHaveTextContent('Aviso 45 días antes del vencimiento')
  })

  it('sin permiso de calibración no ofrece registrarla', () => {
    montar(false)
    expect(screen.queryByRole('button', { name: 'Registrar calibración' })).not.toBeInTheDocument()
  })

  it('registra certificado, vencimiento y margen con el contrato del backend', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: equipo() }))
    const registrada = montar(true)
    await llenarYGuardar()

    await waitFor(() => expect(registrada).toHaveBeenCalled())
    const peticion = adaptador.peticiones.find((p) => p.method === 'patch')!
    expect(peticion.url).toBe('/api/dispositivos/FARM-01-CDL/calibracion')
    const cuerpo = JSON.parse(peticion.data as string)
    expect(errores(cuerpo, esquemaPeticion('patch', peticion.url))).toEqual([])
    expect(cuerpo).toEqual({
      fecha_calibracion: '2026-11-10',
      numero_certificado: 'CAL-2026-QF',
      fecha_vencimiento: '2027-11-10',
      margen_aviso_dias: 20,
    })
    const panel = screen.getByRole('dialog')
    expect(within(panel).getByText('Calibración registrada correctamente.').closest('[role="status"]')).not.toBeNull()
    // El formulario se cierra y el foco vuelve al botón.
    expect(within(panel).queryByLabelText('Fecha de calibración')).not.toBeInTheDocument()
  })

  it('un 403 se explica como falta de permiso, sin dar por registrada la calibración', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ status: 403, data: { detail: 'No autorizado' } }))
    const registrada = montar(true)
    await llenarYGuardar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu rol no puede registrar calibraciones.')
    expect(registrada).not.toHaveBeenCalled()
  })
})
