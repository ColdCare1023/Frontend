import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'

const useDispositivos = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useDispositivos', () => ({ useDispositivos }))

import { DispositivosPage } from '@/presentation/pages/DispositivosPage'
import { vigenciaConsumida } from '@/presentation/pages/equipos/estadoEquipo'

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

function montar(dispositivos: Dispositivo[], extra: Record<string, unknown> = {}) {
  useDispositivos.mockReturnValue({
    dispositivos,
    cargando: false,
    consultar: vi.fn(),
    darDeBaja: vi.fn(),
    registrarCalibracion: vi.fn(),
    actualizarInstalacion: vi.fn(),
    actualizarResponsable: vi.fn(),
    obtenerHistorialConfiguracion: vi.fn().mockResolvedValue([]),
    ...extra,
  })
  return render(<DispositivosPage />)
}

describe('DispositivosPage (HU-43, RF-18)', () => {
  beforeEach(() => useDispositivos.mockReset())

  it('muestra el device_id y su versión de firmware', async () => {
    montar([dispositivo()])

    // El nombre manda; el código sigue a la vista, en segundo plano.
    expect(screen.getByText('Refrigerador principal')).toBeInTheDocument()
    expect(screen.getByText('Sala 1 · FARM-01-CDL')).toBeInTheDocument()
    // La ficha técnica se abre desde «Opciones» y el firmware queda plegado
    // en «Ver detalles»: sigue a un clic, no desaparece.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: Refrigerador principal/ }))
    await user.click(await screen.findByRole('menuitem', { name: /sensores/i }))
    const detalles = await screen.findByRole('button', { name: 'Ver detalles' })
    expect(detalles).toHaveAttribute('aria-expanded', 'false')
    await user.click(detalles)
    expect(detalles).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('1.0.0').length).toBeGreaterThan(0)
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

    expect(within(screen.getByRole('row', { name: /FARM-01-CDL/ })).getByText(/dado de baja/i)).toBeInTheDocument()
    // La frase de arriba también lo cuenta.
    expect(screen.getByRole('region', { name: 'Resumen de tus equipos' })).toHaveTextContent(/1 dado de baja\.$/)
  })

  it('avisa cuando no hay equipos registrados', () => {
    montar([])
    expect(screen.getByText(/no hay equipos registrados/i)).toBeInTheDocument()
  })

  it('HU-30: la fecha de calibración usa el selector, es obligatoria y viaja como yyyy-MM-dd', async () => {
    const registrarCalibracion = vi.fn().mockResolvedValue('ok')
    montar([dispositivo()], { registrarCalibracion })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: Refrigerador principal/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Registrar calibración/ }))

    // Sin fecha no se guarda: el campo se marca y recibe el foco, como el `required` nativo.
    await user.type(screen.getByLabelText('N.° de certificado'), 'CAL-QA-1')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const fecha = screen.getByLabelText('Fecha de calibración')
    expect(registrarCalibracion).not.toHaveBeenCalled()
    expect(fecha).toHaveAttribute('aria-invalid', 'true')
    expect(fecha).toHaveFocus()

    await user.type(fecha, '2026-10-27')
    expect(fecha).not.toHaveAttribute('aria-invalid')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(registrarCalibracion).toHaveBeenCalledWith('FARM-01-CDL', '2026-10-27', 'CAL-QA-1', '', 12)
  })
})

describe('DispositivosPage — credenciales MQTT (FE-003)', () => {
  beforeEach(() => useDispositivos.mockReset())

  async function abrirAccion(nombre: RegExp) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: Refrigerador principal/ }))
    await user.click(await screen.findByRole('menuitem', { name: nombre }))
    return user
  }

  it('pide motivo para rotar y muestra el token una sola vez', async () => {
    const rotarCredencial = vi.fn().mockResolvedValue({
      device_id: 'FARM-01-CDL',
      token: 'token-visible-una-vez',
      generado_en: '2026-10-21T10:00:00Z',
      sesion_broker_cerrada: true,
    })
    montar([dispositivo({ mqtt_token_activo: true })], { rotarCredencial, revocarCredencial: vi.fn() })

    const user = await abrirAccion(/Rotar credencial/)
    const enviar = screen.getByRole('button', { name: 'Rotar credencial' })
    expect(enviar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo'), 'Rotación periódica')
    await user.click(enviar)

    expect(rotarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Rotación periódica', 'preventiva')
    expect(await screen.findByTestId('token-rotado')).toHaveTextContent('token-visible-una-vez')
    expect(screen.getByText(/cerró la sesión anterior/)).toBeInTheDocument()

    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' })
    await user.click(cerrar[cerrar.length - 1])
    expect(screen.queryByText('token-visible-una-vez')).toBeNull()
  })

  it('HU-44: la rotación por compromiso se elige en el diálogo y se muestra la retención', async () => {
    const rotarCredencial = vi.fn().mockResolvedValue({
      device_id: 'FARM-01-CDL', token: 'token-nuevo', generado_en: '2026-10-27T10:00:00Z',
      sesion_broker_cerrada: true, telemetria_retenida: true,
    })
    montar(
      [dispositivo({ mqtt_token_activo: true, broker_pendiente: 'aprovisionar', rotacion_por_compromiso: true })],
      { rotarCredencial, revocarCredencial: vi.fn() },
    )
    // En la pieza se dice en palabras; el término técnico está en la ficha.
    expect(screen.getByText('No está registrando lecturas. Abre la ficha.')).toBeInTheDocument()

    const user = await abrirAccion(/Rotar credencial/)
    await user.type(screen.getByLabelText('Motivo'), 'Token visto en un log')
    await user.selectOptions(screen.getByLabelText('Causa'), 'compromiso')
    expect(screen.getByText(/retiene la telemetría del equipo/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rotar credencial' }))

    expect(rotarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Token visto en un log', 'compromiso')
  })

  it('HU-44: con la consola confirmada la retención sigue hasta la prueba de posesión', async () => {
    const reenviarDesafio = vi.fn().mockResolvedValue('ok')
    montar(
      [dispositivo({ mqtt_token_activo: true, broker_pendiente: null, rotacion_por_compromiso: true, posesion_pendiente: true })],
      { rotarCredencial: vi.fn(), revocarCredencial: vi.fn(), reenviarDesafio },
    )
    expect(screen.getByText('No está registrando lecturas. Abre la ficha.')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ver ficha de Refrigerador principal' }))
    const ficha = await screen.findByRole('dialog', { name: 'Refrigerador principal' })
    expect(within(ficha).getByText('Telemetría retenida')).toBeInTheDocument()
    expect(within(ficha).getByText('Esperando prueba de posesión')).toBeInTheDocument()

    await user.click(within(ficha).getByRole('button', { name: 'Reenviar desafío' }))

    expect(reenviarDesafio).toHaveBeenCalledWith('FARM-01-CDL')
  })

  it('HU-44: «Reenviar desafío» no se repite mientras el anterior está en curso', async () => {
    let terminar: (valor: string) => void = () => {}
    const reenviarDesafio = vi.fn(() => new Promise<string>((resolver) => { terminar = resolver }))
    montar(
      [dispositivo({ mqtt_token_activo: true, broker_pendiente: null, rotacion_por_compromiso: true, posesion_pendiente: true })],
      { rotarCredencial: vi.fn(), revocarCredencial: vi.fn(), reenviarDesafio },
    )
    const user = await abrirAccion(/Reenviar desafío/)
    // El menú de Radix bloquea el puntero hasta terminar de cerrarse.
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'))
    await user.click(screen.getByRole('button', { name: /Opciones: Refrigerador principal/ }))
    const segundo = await screen.findByRole('menuitem', { name: /Reenviar desafío/ })

    expect(segundo).toHaveAttribute('data-disabled')
    expect(reenviarDesafio).toHaveBeenCalledTimes(1)
    terminar('ok')
  })

  it('revoca con motivo obligatorio', async () => {
    const revocarCredencial = vi.fn().mockResolvedValue('revocada')
    montar([dispositivo({ mqtt_token_activo: true })], { rotarCredencial: vi.fn(), revocarCredencial })

    const user = await abrirAccion(/Revocar credencial/)
    await user.type(screen.getByLabelText('Motivo'), 'Equipo extraviado')
    await user.click(screen.getByRole('button', { name: 'Revocar credencial' }))

    expect(revocarCredencial).toHaveBeenCalledWith('FARM-01-CDL', 'Equipo extraviado')
  })

  it('una credencial revocada en el backend no ofrece revocar de nuevo', async () => {
    montar([dispositivo({ mqtt_token_activo: false, mqtt_credencial_actualizada_en: '2026-10-20T10:00:00Z' })], {
      rotarCredencial: vi.fn(),
      revocarCredencial: vi.fn(),
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Opciones: Refrigerador principal/ }))
    await screen.findByRole('menuitem', { name: /Rotar credencial/ })
    expect(screen.queryByRole('menuitem', { name: /Revocar credencial/ })).toBeNull()
  })
})

describe('DispositivosPage — rediseño: cada equipo es una pieza', () => {
  beforeEach(() => useDispositivos.mockReset())

  function pieza(id: string) {
    return screen.getByRole('row', { name: new RegExp(id) })
  }

  it.each<[string, Partial<Dispositivo>, string]>([
    ['en línea', { estado_conectividad: 'online', estado_operativo: 'OPERATIVO' }, 'enLinea'],
    ['sin conexión', { estado_conectividad: 'offline', estado_operativo: 'OPERATIVO' }, 'sinConexion'],
    ['sin datos', { estado_conectividad: 'offline', estado_operativo: 'SIN_DATOS' }, 'sinDatos'],
    ['falla de sensor', { estado_operativo: 'FALLA_SENSOR' }, 'critico'],
    ['monitoreo suspendido', { estado_operativo: 'MONITOREO_SUSPENDIDO' }, 'critico'],
    ['telemetría retenida', { rotacion_por_compromiso: true }, 'critico'],
    ['dado de baja', { activo: false, estado_operativo: 'SIN_DATOS' }, 'baja'],
  ])('%s tiene su propio color', (_nombre, datos, tono) => {
    montar([dispositivo(datos)])
    expect(pieza('FARM-01-CDL')).toHaveAttribute('data-tono', tono)
  })

  it('dice el estado con palabras, no solo con el color', () => {
    montar([dispositivo({ id: 'FARM-02-CDL', estado_conectividad: 'offline', estado_operativo: 'SIN_DATOS' })])
    const fila = pieza('FARM-02-CDL')
    expect(within(fila).getByText('Sin datos')).toBeInTheDocument()
    expect(within(fila).getByText('Sin conexión')).toBeInTheDocument()
  })

  it('la calibración se dice en palabras; los sensores quedan en la ficha', async () => {
    montar([
      dispositivo({
        fecha_ultima_calibracion: '2020-01-01',
        fecha_proxima_calibracion: '2021-01-01',
        sensores: [
          { modelo: 'DS18B20', estado: 'ok', campo_telemetria: 'temperatura_interna' },
          { modelo: 'SHT31', estado: 'error', campo_telemetria: 'temperatura_ambiental' },
          { modelo: 'MC-38', estado: 'no_instalado', campo_telemetria: 'apertura_refrigerador' },
        ],
      }),
    ])
    const fila = pieza('FARM-01-CDL')
    expect(within(fila).getByText('Calibración vencida desde enero de 2021')).toBeInTheDocument()
    expect(within(fila).queryByText('1 de 2')).toBeNull()
    expect(within(fila).queryByText('DS18B20')).toBeNull()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver ficha de Refrigerador principal' }))
    const ficha = await screen.findByRole('dialog', { name: 'Refrigerador principal' })
    expect(within(ficha).getByText('1 de 2')).toBeInTheDocument()
  })

  it('una calibración vigente dice hasta qué mes, sin correrse al mes anterior', () => {
    montar([dispositivo({ fecha_ultima_calibracion: '2026-11-01', fecha_proxima_calibracion: '2027-11-01' })])
    expect(within(pieza('FARM-01-CDL')).getByText('Calibrado hasta noviembre de 2027')).toBeInTheDocument()
  })

  it('una frase resume los equipos, sin cuatro cifras ni una ficha por equipo', () => {
    montar([dispositivo({ estado_operativo: 'SIN_DATOS', buffer_littlefs: { pendientes: 6, limite: 100, desde: null, hasta: null, perdidas: 0 } })])

    const resumen = screen.getByRole('region', { name: 'Resumen de tus equipos' })
    expect(resumen).toHaveTextContent(/equipo en servicio: 1 necesita revisión\.$/)
    // La cifra rueda: el lector de pantalla la lee una vez, entera.
    expect(within(resumen).getByText('1', { selector: '.sr-only' })).toBeInTheDocument()
    expect(screen.queryByRole('term')).toBeNull()
    expect(screen.queryByText('Ficha de cada equipo')).toBeNull()
  })

  it('tocar la pieza abre la ficha completa, y lo que se edita desde ella vuelve a ella', async () => {
    const registrarCalibracion = vi.fn().mockResolvedValue('ok')
    montar(
      [
        dispositivo({
          responsable_nombre: 'Rosa Paz',
          instalado_por: 'Técnico X',
          numero_certificado_calibracion: 'CAL-1',
          firmware_version: '2.3.4',
          sensores: [{ modelo: 'DS18B20', estado: 'ok', campo_telemetria: 'temperatura_interna' }],
        }),
      ],
      { registrarCalibracion, rotarCredencial: vi.fn(), revocarCredencial: vi.fn() },
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ver ficha de Refrigerador principal' }))

    const ficha = await screen.findByRole('dialog', { name: 'Refrigerador principal' })
    for (const dato of ['Rosa Paz', 'Técnico X', 'CAL-1', '2.3.4']) {
      expect(within(ficha).getByText(dato)).toBeInTheDocument()
    }
    // El nombre manda también en la ficha; el código sigue ahí, en segundo plano.
    expect(within(ficha).getAllByText('Sala 1 · FARM-01-CDL').length).toBeGreaterThan(0)
    expect(within(ficha).getByRole('list', { name: 'Sensores instalados' })).toHaveTextContent('DS18B20')
    for (const accion of ['Registrar calibración', 'Ubicación e instalación', 'Responsable de notificaciones', 'Rotar credencial', 'Revocar credencial', 'Historial de configuración', 'Dar de baja']) {
      expect(within(ficha).getByRole('button', { name: accion })).toBeInTheDocument()
    }

    await user.click(within(ficha).getByRole('button', { name: 'Registrar calibración' }))
    const formulario = await screen.findByRole('dialog', { name: 'Registrar calibración' })
    await user.click(within(formulario).getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('dialog', { name: 'Refrigerador principal' })).toBeInTheDocument()

    // El aspa de la ficha ya no vuelve a ningún sitio: cierra del todo.
    await user.click(within(screen.getByRole('dialog', { name: 'Refrigerador principal' })).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('la ficha explica por escrito lo que en la pieza es un aviso corto', async () => {
    montar([dispositivo({ rotacion_por_compromiso: true, posesion_pendiente: true, broker_pendiente: null })], { reenviarDesafio: vi.fn() })
    expect(within(pieza('FARM-01-CDL')).getByText('No está registrando lecturas. Abre la ficha.')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ver ficha de Refrigerador principal' }))
    const ficha = await screen.findByRole('dialog', { name: 'Refrigerador principal' })
    expect(within(ficha).getByText(/el sistema no registra lecturas del equipo/)).toBeInTheDocument()
    expect(within(ficha).getByText(/firma el desafío con la credencial nueva/)).toBeInTheDocument()
    expect(within(ficha).getByRole('button', { name: 'Reenviar desafío' })).toBeInTheDocument()
  })

  it('«Registrar equipo» abre el registro y la credencial se muestra una sola vez', async () => {
    const registrarDispositivo = vi.fn().mockResolvedValue({
      resultado: 'ok',
      credencial: { device_id: 'FARM-03-CDL', token: 'token-de-alta', generado_en: '2026-11-07T10:00:00Z', sesion_broker_cerrada: null },
    })
    montar([dispositivo()], { registrarDispositivo })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Registrar equipo' }))
    await user.type(screen.getByLabelText('Código del equipo'), 'farm-03-cdl')
    await user.type(screen.getByLabelText('Nombre del equipo'), 'Cámara')
    await user.type(screen.getByLabelText('Ubicación'), 'Almacén')
    await user.click(screen.getByRole('checkbox', { name: /MC-38/ }))
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(registrarDispositivo).toHaveBeenCalledWith({
      device_id: 'FARM-03-CDL',
      nombre: 'Cámara',
      ubicacion: 'Almacén',
      sensores: ['DS18B20', 'SHT31', 'MC-38'],
    })
    expect(await screen.findByTestId('token-rotado')).toHaveTextContent('token-de-alta')
    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' })
    await user.click(cerrar[cerrar.length - 1])
    await waitFor(() => expect(screen.queryByText('token-de-alta')).toBeNull())
  })

  it('el patrón del código es el del alta y el navegador puede compilarlo', async () => {
    montar([dispositivo()], { registrarDispositivo: vi.fn() })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Registrar equipo' }))

    const patron = screen.getByLabelText('Código del equipo').getAttribute('pattern') ?? ''
    // Los navegadores compilan `pattern` con el indicador `v`: un guion suelto lo invalida en silencio.
    const compilado = new RegExp(`^(?:${patron})$`, 'v')
    expect(compilado.test('FARM-03-CDL')).toBe(true)
    expect(compilado.test('FARM_03')).toBe(true)
    expect(compilado.test('FARM 03')).toBe(false)
    expect(compilado.test('A'.repeat(51))).toBe(false)
  })

  it('carga, vacío y error se distinguen', async () => {
    useDispositivos.mockReturnValue({ dispositivos: [], cargando: true })
    const { unmount } = render(<DispositivosPage />)
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
    expect(screen.queryByText(/no hay equipos/i)).toBeNull()
    unmount()

    montar([], { registrarDispositivo: vi.fn() })
    expect(screen.getByText(/no hay equipos/i)).toBeInTheDocument()
    // Sin equipos, un solo gesto: el bloque grande, no dos botones iguales.
    expect(screen.getAllByRole('button', { name: /registrar equipo/i })).toHaveLength(1)
    cleanup()

    montar([], { errorCarga: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los equipos.')
    expect(screen.queryByText(/no hay equipos/i)).toBeNull()
  })
})

describe('vigenciaConsumida', () => {
  const con = (over: Partial<Dispositivo>) => over as Dispositivo

  it('sin las dos fechas no hay barra que dibujar', () => {
    expect(vigenciaConsumida(con({ fecha_ultima_calibracion: null, fecha_proxima_calibracion: '2027-01-01' }))).toBeNull()
    expect(vigenciaConsumida(con({ fecha_ultima_calibracion: '2026-01-01', fecha_proxima_calibracion: null }))).toBeNull()
    expect(vigenciaConsumida(con({ fecha_ultima_calibracion: '2027-01-01', fecha_proxima_calibracion: '2026-01-01' }))).toBeNull()
  })

  it('mide de 0 a 1 y no se sale de la barra', () => {
    const d = con({ fecha_ultima_calibracion: '2026-01-01', fecha_proxima_calibracion: '2027-01-01' })
    expect(vigenciaConsumida(d, new Date('2025-06-01T00:00:00Z'))).toBe(0)
    expect(vigenciaConsumida(d, new Date('2028-06-01T00:00:00Z'))).toBe(1)
    expect(vigenciaConsumida(d, new Date('2026-07-02T12:00:00Z'))).toBeCloseTo(0.5, 2)
  })
})
