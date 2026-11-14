import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'

const useDispositivos = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useDispositivos', () => ({ useDispositivos }))
vi.mock('@/infrastructure/api/apiClient', () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) } }))

import { DetalleDispositivoPage } from '@/presentation/pages/dispositivos/DetalleDispositivoPage'
import { DispositivosLayout } from '@/presentation/pages/dispositivos/DispositivosLayout'
import { ListaDispositivosPage } from '@/presentation/pages/dispositivos/ListaDispositivosPage'
import { estadoVisualEquipo, rangoAtencion, resumenFlota } from '@/presentation/pages/dispositivos/estadoEquipo'

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
    fecha_ultima_calibracion: '2026-05-12',
    numero_certificado_calibracion: 'CAL-1',
    fecha_proxima_calibracion: '2030-05-12',
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

function montar(dispositivos: Dispositivo[], extra: Record<string, unknown> = {}, ruta = '/dispositivos') {
  useDispositivos.mockReturnValue({
    dispositivos,
    cargando: false,
    errorCarga: false,
    consultar: vi.fn(),
    darDeBaja: vi.fn(),
    registrarCalibracion: vi.fn(),
    actualizarInstalacion: vi.fn(),
    actualizarResponsable: vi.fn(),
    obtenerHistorialConfiguracion: vi.fn().mockResolvedValue([]),
    registrarDispositivo: vi.fn(),
    rotarCredencial: vi.fn(),
    revocarCredencial: vi.fn(),
    confirmarBroker: vi.fn(),
    reenviarDesafio: vi.fn(),
    simularEscenario: vi.fn(),
    ...extra,
  })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/dispositivos" element={<DispositivosLayout />}>
          <Route index element={<ListaDispositivosPage />} />
          <Route path=":deviceId" element={<DetalleDispositivoPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('estado de equipo (SPEC P5b §5.4)', () => {
  it('prioriza la telemetría retenida sobre cualquier otro estado', () => {
    expect(estadoVisualEquipo(dispositivo({ rotacion_por_compromiso: true, estado_operativo: 'SIN_DATOS' }))).toBe('retenida')
  })

  it('sin datos no se pinta como excursión (HU-54)', () => {
    const d = dispositivo({ estado_operativo: 'SIN_DATOS' })
    expect(estadoVisualEquipo(d, { temperatura: 12, riesgo: 'excursion_critica', timestamp: '2026-01-01T00:00:00Z' })).toBe('sin_datos')
  })

  it('un equipo dado de baja se ordena al final', () => {
    const baja = dispositivo({ activo: false })
    const normal = dispositivo({ ultimo_reporte_en: '2026-01-01T00:00:00Z' })
    expect(rangoAtencion(baja, estadoVisualEquipo(baja))).toBeGreaterThan(rangoAtencion(normal, estadoVisualEquipo(normal)))
  })

  it('resumenFlota cuenta sin datos solo en equipos activos', () => {
    const r = resumenFlota([dispositivo({ estado_operativo: 'SIN_DATOS' }), dispositivo({ id: 'B', activo: false, estado_operativo: 'SIN_DATOS' })])
    expect(r.sinDatos).toBe(1)
    expect(r.deBaja).toBe(1)
  })
})

describe('Lista de dispositivos (HU-43, RF-18)', () => {
  beforeEach(() => useDispositivos.mockReset())

  it('un fallo de carga se muestra como error, no como «no hay dispositivos»', async () => {
    const consultar = vi.fn()
    montar([], { errorCarga: true, consultar })

    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar/i)
    expect(screen.queryByText(/no hay dispositivos/i)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(consultar).toHaveBeenCalled()
  })

  it('distingue un nodo en línea de uno sin conexión', () => {
    montar([dispositivo({ id: 'FARM-01-CDL', estado_conectividad: 'online' }), dispositivo({ id: 'FARM-02-CDL', estado_conectividad: 'offline' })])
    expect(screen.getAllByText('En línea').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin conexión').length).toBeGreaterThan(0)
  })

  it('marca visiblemente un dispositivo dado de baja', () => {
    montar([dispositivo({ activo: false, motivo_baja: 'falla_hardware', dado_de_baja_en: '2026-10-01T10:00:00Z' })])
    expect(screen.getAllByText(/dado de baja/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Falla de hardware/)).toBeInTheDocument()
  })

  it('avisa cuando no hay dispositivos y ofrece registrar el primero', () => {
    montar([])
    expect(screen.getByText(/no hay dispositivos/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Registrar equipo/ }).length).toBeGreaterThanOrEqual(2)
  })

  it('ordena primero los equipos que requieren atención', () => {
    montar([
      dispositivo({ id: 'FARM-01-CDL', ultimo_reporte_en: '2026-01-01T00:00:00Z' }),
      dispositivo({ id: 'FARM-02-CDL', estado_operativo: 'SIN_DATOS' }),
    ])
    const enlaces = within(screen.getByRole('list', { name: 'Equipos de medición' })).getAllByRole('link')
    expect(enlaces[0]).toHaveTextContent('FARM-02-CDL')
  })

  it('Confirmar en la fila pide nota opcional y confirma (HU-43/44)', async () => {
    const confirmarBroker = vi.fn().mockResolvedValue('ok')
    montar([dispositivo({ broker_pendiente: 'aprovisionar' })], { confirmarBroker })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Confirmar en la consola: FARM-01-CDL' }))
    await user.type(screen.getByLabelText(/nota/i), 'Usuario creado')
    await user.click(screen.getByRole('button', { name: /^Confirmar en la consola$|^Confirmar$/ }))
    expect(confirmarBroker).toHaveBeenCalledWith('FARM-01-CDL', 'Usuario creado')
  })

  it('HU-44: «Reenviar» de la fila no se repite mientras el anterior está en curso', async () => {
    let terminar: (valor: string) => void = () => {}
    const reenviarDesafio = vi.fn(() => new Promise<string>((resolver) => { terminar = resolver }))
    montar([dispositivo({ posesion_pendiente: true, rotacion_por_compromiso: true })], { reenviarDesafio })
    const user = userEvent.setup()
    const boton = screen.getByRole('button', { name: 'Reenviar desafío: FARM-01-CDL' })
    await user.click(boton)
    expect(boton).toBeDisabled()
    await user.click(boton)
    expect(reenviarDesafio).toHaveBeenCalledTimes(1)
    terminar('ok')
  })

  it('el menú Opciones solo lleva accesos a las pestañas', async () => {
    montar([dispositivo()])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: FARM-01-CDL/ }))
    expect(await screen.findByRole('menuitem', { name: 'Calibración' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Seguridad y credencial' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Dar de baja|Revocar/ })).toBeNull()
  })

  it('filtro Con atención y búsqueda por código o ubicación', async () => {
    montar([
      dispositivo({ id: 'FARM-01-CDL', ubicacion: 'Almacén', ultimo_reporte_en: '2026-01-01T00:00:00Z' }),
      dispositivo({ id: 'FARM-02-CDL', ubicacion: 'Cámara', estado_operativo: 'SIN_DATOS' }),
    ])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Con atención/ }))
    const lista = screen.getByRole('list', { name: 'Equipos de medición' })
    expect(within(lista).queryByText('FARM-01-CDL')).toBeNull()
    await user.click(screen.getByRole('button', { name: /^Todos/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar equipos' }), 'almacen')
    expect(within(lista).getByText('FARM-01-CDL')).toBeInTheDocument()
    expect(within(lista).queryByText('FARM-02-CDL')).toBeNull()
  })
})

describe('Detalle de dispositivo (pestañas)', () => {
  beforeEach(() => useDispositivos.mockReset())

  it('abre la pestaña de ?tab y la cambia con flechas', async () => {
    montar([dispositivo()], {}, '/dispositivos/FARM-01-CDL?tab=calibracion')
    const tab = screen.getByRole('tab', { name: /Calibración/ })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    tab.focus()
    await userEvent.setup().keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Ubicación y responsable/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('equipo inexistente muestra no encontrado con regreso', () => {
    montar([dispositivo()], {}, '/dispositivos/NO-EXISTE')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('No encontramos el equipo NO-EXISTE')
    expect(screen.getByRole('link', { name: 'Volver a equipos' })).toHaveAttribute('href', '/dispositivos')
  })

  it('muestra el device_id y su versión de firmware en Configuración', () => {
    montar([dispositivo()], {}, '/dispositivos/FARM-01-CDL?tab=configuracion')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FARM-01-CDL')
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('HU-30: la fecha de calibración usa el selector, es obligatoria y viaja como yyyy-MM-dd', async () => {
    const registrarCalibracion = vi.fn().mockResolvedValue('ok')
    montar([dispositivo()], { registrarCalibracion }, '/dispositivos/FARM-01-CDL?tab=calibracion&accion=registrar')
    const user = userEvent.setup()
    const certificado = screen.getByLabelText('N.° de certificado')
    await user.clear(certificado)
    await user.type(certificado, 'CAL-QA-1')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const fecha = screen.getByLabelText('Fecha de calibración')
    expect(registrarCalibracion).not.toHaveBeenCalled()
    expect(fecha).toHaveAttribute('aria-invalid', 'true')
    expect(fecha).toHaveFocus()

    await user.type(fecha, '2026-10-27')
    await user.type(screen.getByLabelText('Vencimiento del certificado'), '2027-04-30')
    const margen = screen.getByLabelText('Avisar antes (días)')
    await user.clear(margen)
    await user.type(margen, '45')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(registrarCalibracion).toHaveBeenCalledWith('FARM-01-CDL', '2026-10-27', 'CAL-QA-1', '', '2027-04-30', 45)
  })

  it('HU-51: editar ubicación guarda y anuncia el resultado', async () => {
    const actualizarInstalacion = vi.fn().mockResolvedValue('ok')
    montar([dispositivo()], { actualizarInstalacion }, '/dispositivos/FARM-01-CDL?tab=ubicacion')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Editar ubicación de FARM-01-CDL' }))
    const ubicacion = screen.getByLabelText('Ubicación')
    await user.clear(ubicacion)
    await user.type(ubicacion, 'Almacén QA')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(actualizarInstalacion).toHaveBeenCalledWith('FARM-01-CDL', 'Almacén QA', '', '')
    expect(await screen.findByRole('status')).toHaveTextContent('Instalación actualizada correctamente.')
  })

  it('pide motivo para rotar y muestra el token una sola vez', async () => {
    const rotarCredencial = vi.fn().mockResolvedValue({
      device_id: 'FARM-01-CDL', token: 'token-visible-una-vez', generado_en: '2026-10-21T10:00:00Z', sesion_broker_cerrada: true,
    })
    montar([dispositivo({ mqtt_token_activo: true })], { rotarCredencial }, '/dispositivos/FARM-01-CDL?tab=seguridad')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Rotar credencial' }))
    const enviar = screen.getAllByRole('button', { name: 'Rotar credencial' }).at(-1)!
    expect(enviar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo'), 'Rotación periódica')
    await user.selectOptions(screen.getByLabelText('Causa'), 'compromiso')
    expect(screen.getByText(/retiene la telemetría del equipo/)).toBeInTheDocument()
    await user.click(enviar)
    expect(rotarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Rotación periódica', 'compromiso')
    expect(await screen.findByTestId('token-rotado')).toHaveTextContent('token-visible-una-vez')
    await user.click(screen.getByRole('button', { name: 'Listo, ya lo guardé' }))
    expect(screen.queryByText('token-visible-una-vez')).toBeNull()
  })

  it('rotar está deshabilitado en un equipo dado de baja', () => {
    montar([dispositivo({ activo: false })], {}, '/dispositivos/FARM-01-CDL?tab=seguridad')
    expect(screen.getByRole('button', { name: 'Rotar credencial' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Dar de baja…' })).toBeNull()
  })

  it('revoca con motivo obligatorio desde la zona de riesgo', async () => {
    const revocarCredencial = vi.fn().mockResolvedValue('revocada')
    montar([dispositivo({ mqtt_token_activo: true })], { revocarCredencial }, '/dispositivos/FARM-01-CDL?tab=seguridad')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Revocar credencial…' }))
    const dialogo = screen.getByRole('alertdialog')
    const confirmar = within(dialogo).getByRole('button', { name: 'Revocar credencial' })
    expect(confirmar).toBeDisabled()
    await user.type(within(dialogo).getByLabelText('Motivo'), 'Equipo extraviado')
    await user.click(confirmar)
    expect(revocarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Equipo extraviado')
    expect(await screen.findByText(/Credencial revocada: el sistema ya no acepta/)).toBeInTheDocument()
  })

  it('una credencial revocada en el backend no ofrece revocar de nuevo', () => {
    montar(
      [dispositivo({ mqtt_token_activo: false, mqtt_credencial_actualizada_en: '2026-10-20T10:00:00Z' })],
      {},
      '/dispositivos/FARM-01-CDL?tab=seguridad',
    )
    expect(screen.queryByRole('button', { name: 'Revocar credencial…' })).toBeNull()
  })

  it('HU-43: dar de baja pide motivo y anuncia que el histórico se conserva', async () => {
    const darDeBaja = vi.fn().mockResolvedValue('ok')
    montar([dispositivo()], { darDeBaja }, '/dispositivos/FARM-01-CDL?tab=seguridad')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Dar de baja…' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/histórico de lecturas y trazabilidad permanece intacto/)
    await user.selectOptions(within(dialogo).getByLabelText('Motivo de baja'), 'reemplazo')
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(darDeBaja).toHaveBeenCalledWith('FARM-01-CDL', 'reemplazo', '', '')
    expect(await within(dialogo).findByRole('status')).toHaveTextContent('Dispositivo dado de baja correctamente.')
  })

  it('HU-44: con la consola confirmada la retención sigue hasta la prueba de posesión', async () => {
    const reenviarDesafio = vi.fn().mockResolvedValue('ok')
    montar(
      [dispositivo({ mqtt_token_activo: true, broker_pendiente: null, rotacion_por_compromiso: true, posesion_pendiente: true })],
      { reenviarDesafio },
      '/dispositivos/FARM-01-CDL?tab=seguridad',
    )
    expect(screen.getAllByText('Telemetría retenida').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Esperando prueba de posesión').length).toBeGreaterThan(0)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reenviar desafío' }))
    expect(reenviarDesafio).toHaveBeenCalledWith('FARM-01-CDL')
  })
})
