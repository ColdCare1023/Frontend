import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { estadoNotificacion, type AlertaTermica } from '@/domain/entities/AlertaTermica'
import { useAuthStore } from '@/application/stores/authStore'
import { resumirAlertas, useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import type { Rol } from '@/domain/value-objects/Rol'

const useAlertas = vi.hoisted(() => vi.fn())
const useIncidentesOperativos = vi.hoisted(() => vi.fn())
const useAtendidasRecientes = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))
vi.mock('@/application/hooks/useIncidentesOperativos', () => ({ useIncidentesOperativos }))
vi.mock('@/application/hooks/useAtendidasRecientes', () => ({ useAtendidasRecientes }))

import { AlertasPage } from '@/presentation/pages/AlertasPage'

function alerta(over: Partial<AlertaTermica> = {}): AlertaTermica {
  return {
    id: 'al-1',
    reading_id: 'l-1',
    device_id: 'FARM-01-CDL',
    nivel_riesgo: 'excursion_critica',
    mensaje: 'Temperatura fuera del rango 2-8 °C',
    revisada: false,
    revisada_por: null,
    created_at: '2026-07-25T12:00:00Z',
    estado: 'pendiente',
    reconocida_en: null,
    atendida_en: null,
    ...over,
  }
}

function sesionCon(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
  })
}

function montar(alertas: AlertaTermica[], over: Record<string, unknown> = {}) {
  const valor = {
    alertas,
    cargando: false,
    errorCarga: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reintentar: vi.fn(),
    reconocerAlerta: vi.fn().mockResolvedValue('ok'),
    registrarAccionCorrectiva: vi.fn().mockResolvedValue('ok'),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
    rectificarAccion: vi.fn().mockResolvedValue('ok'),
    ...over,
  }
  useAlertas.mockReturnValue(valor)
  render(
    <MemoryRouter>
      <AlertasPage />
    </MemoryRouter>,
  )
  return valor
}

const fila = () => screen.getAllByRole('row')[1]

describe('AlertasPage (RF-09, RF-10, HU-20/21/23/27/41)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    useIncidentesOperativos.mockReturnValue({ incidentes: [], cargando: false, errorCarga: false, consultar: vi.fn() })
    useAtendidasRecientes.mockReturnValue({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() })
    useEstadoVivoStore.getState().reiniciar()
    sesionCon('farmaceutico')
  })

  it('muestra la alerta con su dispositivo y su mensaje', () => {
    montar([alerta()])

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    expect(screen.getAllByText(/fuera del rango/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('cell', { name: /fuera del rango 2-8/i })).toBeInTheDocument()
  })

  it('ofrece los cuatro filtros de la máquina de estados con aria-pressed', () => {
    montar([alerta()])

    const grupo = screen.getByRole('group', { name: 'Filtrar alertas por estado de seguimiento' })
    for (const nombre of ['Pendientes', 'Reconocidas', 'Atendidas', 'Todas']) {
      expect(within(grupo).getByRole('button', { name: nombre, exact: true } as never)).toBeInTheDocument()
    }
    expect(within(grupo).getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('muestra el conteo de Pendientes y Reconocidas sin cambiar su nombre accesible', () => {
    useEstadoVivoStore.setState({
      carga: 'listo',
      alertas: resumirAlertas([[alerta(), alerta({ id: 'al-2' })], [alerta({ id: 'al-3', estado: 'reconocida' })]]),
    })
    montar([alerta()])

    const pendientes = screen.getByRole('button', { name: 'Pendientes' })
    expect(pendientes).toHaveAccessibleDescription('2 alertas')
    expect(screen.getByRole('button', { name: 'Reconocidas' })).toHaveAccessibleDescription('1 alerta')
  })

  it('farmacéutico ve Reconocer, Registrar acción y Cronología en una pendiente', () => {
    montar([alerta()])

    // HU-23 (P2): el backlog dice «reconocer», no «revisar».
    expect(within(fila()).getByRole('button', { name: /reconocer alerta de FARM-01-CDL/i })).toHaveTextContent('Reconocer')
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención: FARM-01-CDL/i })).toBeInTheDocument()
    // El menú «Opciones» desaparece: las acciones están a la vista (H4).
    expect(screen.queryByRole('button', { name: /^opciones/i })).not.toBeInTheDocument()
  })

  it('administrador ve las mismas acciones que el farmacéutico (RBAC jerárquico)', () => {
    sesionCon('administrador')
    montar([alerta()])

    expect(within(fila()).getByRole('button', { name: /reconocer alerta/i })).toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
  })

  it('técnico no ve Reconocer ni Registrar acción, solo Cronología (H16: el backend le responde 403)', () => {
    sesionCon('tecnico')
    montar([alerta()])

    expect(within(fila()).queryByRole('button', { name: /reconocer alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).queryByRole('button', { name: /registrar acción/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención/i })).toBeInTheDocument()
  })

  it('auditor solo ve Cronología (HU-41)', () => {
    sesionCon('auditor')
    montar([alerta()])

    expect(within(fila()).queryByRole('button', { name: /reconocer alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).queryByRole('button', { name: /registrar acción/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención/i })).toBeInTheDocument()
  })

  it('alerta reconocida ofrece Registrar acción y no Reconocer', () => {
    montar([alerta({ estado: 'reconocida' })], { filtro: 'reconocida' })

    expect(within(fila()).queryByRole('button', { name: /reconocer alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
  })

  it('alerta atendida solo ofrece la cronología', () => {
    montar([alerta({ estado: 'atendida' })], { filtro: 'atendida' })

    expect(within(fila()).queryByRole('button', { name: /reconocer alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).queryByRole('button', { name: /registrar acción/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención/i })).toBeInTheDocument()
  })

  it('Reconocer llama a reconocerAlerta y anuncia el resultado', async () => {
    const { reconocerAlerta } = montar([alerta()])

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /reconocer alerta/i }))

    expect(reconocerAlerta).toHaveBeenCalledWith('al-1')
    expect(await screen.findByText('Alerta de FARM-01-CDL marcada como reconocida.')).toBeInTheDocument()
  })

  it('avisa cuando otro usuario ya reconoció la alerta (HU-27 Escenario 2)', async () => {
    montar([alerta()], { reconocerAlerta: vi.fn().mockResolvedValue('conflicto') })

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /reconocer alerta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/actualizada por otra persona/i)
  })

  it('informa error de red al reconocer', async () => {
    montar([alerta()], { reconocerAlerta: vi.fn().mockResolvedValue('error') })

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /reconocer alerta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo marcar la alerta de FARM-01-CDL como reconocida/i)
  })

  it('informa el 403 al reconocer en vez de un error genérico', async () => {
    montar([alerta()], { reconocerAlerta: vi.fn().mockResolvedValue('prohibido') })

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /reconocer alerta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el personal farmacéutico puede reconocer una alerta.')
  })

  it('ordena pendientes por gravedad y antigüedad', () => {
    montar([
      alerta({ id: 'p-nueva', nivel_riesgo: 'riesgo_preventivo', mensaje: 'Preventiva', created_at: '2026-07-25T08:00:00Z' }),
      alerta({ id: 'c-nueva', mensaje: 'Crítica nueva', created_at: '2026-07-25T12:00:00Z' }),
      alerta({ id: 'c-vieja', mensaje: 'Crítica vieja', created_at: '2026-07-24T12:00:00Z' }),
    ])

    const filas = screen.getAllByRole('row').slice(1).map((f) => within(f).getAllByRole('cell')[0].textContent)
    expect(filas[0]).toContain('Crítica vieja')
    expect(filas[1]).toContain('Crítica nueva')
    expect(filas[2]).toContain('Preventiva')
  })

  it('Todo en orden: vacío de pendientes con la última atendida y una acción', () => {
    useAtendidasRecientes.mockReturnValue({
      alertas: [alerta({ id: 'at-1', estado: 'atendida', atendida_en: '2026-07-25T13:00:00Z', device_id: 'FARM-02-CDL' })],
      estado: 'listo',
      limite: 50,
      recargar: vi.fn(),
    })
    montar([])

    expect(screen.getByText('Todo en orden')).toBeInTheDocument()
    expect(screen.getByText(/Última atendida: FARM-02-CDL/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver atendidas' })).toBeInTheDocument()
  })

  it.each([
    ['reconocida', /no hay alertas marcadas como reconocidas/i, 'Ver pendientes'],
    ['atendida', /no hay alertas con acción registrada/i, 'Ver todas'],
    ['todas', /todavía no hay alertas registradas/i, 'Ir a Monitoreo'],
  ])('vacío por filtro %s: texto y acción', (filtro, texto, accion) => {
    montar([], { filtro })

    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(screen.getByRole(filtro === 'todas' ? 'link' : 'button', { name: accion })).toBeInTheDocument()
  })

  it('no muestra esqueleto durante un refresco en segundo plano', () => {
    montar([alerta()], { cargando: false, refrescando: true })

    expect(screen.getByText('Temperatura fuera del rango 2-8 °C')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Alertas' })).not.toHaveAttribute('aria-busy')
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('muestra aviso de límite con 200 resultados', () => {
    montar([alerta()], { limiteAlcanzado: true })

    expect(screen.getByText(/se muestran las 200 alertas más recientes/i)).toBeInTheDocument()
  })

  it('error de carga ofrece volver a intentar', async () => {
    const { reintentar } = montar([], { errorCarga: true })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Volver a intentar' }))
    expect(reintentar).toHaveBeenCalled()
  })

  it('abre la cronología, incluso con rol auditor, con enlace a Historial', async () => {
    sesionCon('auditor')
    montar([alerta()])

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /cronología de atención.*FARM-01-CDL/i }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('FARM-01-CDL')
    expect(within(dialogo).queryByRole('tab', { name: /acción correctiva/i })).not.toBeInTheDocument()
    expect(within(dialogo).getByRole('link', { name: /historial/i })).toHaveAttribute('href', '/historial')
  })

  it('informa fallo al cargar cronología sin afirmar que no hay acciones', async () => {
    sesionCon('auditor')
    montar([alerta()], { obtenerCicloAtencion: vi.fn().mockRejectedValue(new Error('red caída')) })

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /cronología de atención.*FARM-01-CDL/i }))

    const dialogo = await screen.findByRole('dialog')
    expect(await within(dialogo).findByRole('alert')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Volver a intentar' })).toBeInTheDocument()
    expect(screen.queryByText(/sin acciones/i)).not.toBeInTheDocument()
  })
})

describe('Evidencia de la excursión y estado del correo (outcomes 2 y 6)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    useIncidentesOperativos.mockReturnValue({ incidentes: [], cargando: false, errorCarga: false, consultar: vi.fn() })
    useAtendidasRecientes.mockReturnValue({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() })
    sesionCon('farmaceutico')
  })

  it('muestra pico (1 decimal), duración legible e Histórica', () => {
    montar([alerta({ temperatura_pico: 11.54, duracion_s: 185, historica: true })])

    expect(screen.getAllByText('Histórica').length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/11\.5\u202F°C/)
    expect(document.body.textContent).toMatch(/3\u00a0min 5\u00a0s/)
    expect(document.body.textContent).not.toMatch(/3:05/)
  })

  it('no inventa evidencia en alertas anteriores a la migración', () => {
    montar([alerta()])

    expect(screen.queryByText('Histórica')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Pico/)).not.toBeInTheDocument()
    expect(screen.getByText('Sin pico registrado')).toBeInTheDocument()
  })

  it.each([
    [{ notificada_en: '2026-07-25T12:00:30Z', notificacion_intentos: 1 }, 'notificada', 'Correo enviado'],
    [{ notificada_en: null, notificacion_intentos: 1 }, 'reintentando', 'Reintentando correo'],
    [{ notificada_en: null, notificacion_intentos: 3 }, 'no_entregada', 'Correo no entregado'],
    [{ notificada_en: null, notificacion_intentos: 0 }, 'pendiente', 'Correo pendiente'],
  ])('estado del correo %#', (campos, estado, texto) => {
    expect(estadoNotificacion(alerta(campos))).toBe(estado)
    montar([alerta(campos)])
    // Icono + texto para lector en la fila; texto con su ayuda visible en móvil.
    expect(screen.getAllByText(texto).length).toBeGreaterThan(0)
  })

  it('una alerta preventiva no muestra estado de correo', () => {
    expect(estadoNotificacion(alerta({ nivel_riesgo: 'riesgo_preventivo' }))).toBeNull()
    montar([alerta({ nivel_riesgo: 'riesgo_preventivo' })])
    expect(screen.queryByText(/correo/i)).not.toBeInTheDocument()
  })
})

describe('AlertasPage: foco y contexto con pocas filas (DIRECTION §6 y §13)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    useIncidentesOperativos.mockReturnValue({ incidentes: [], cargando: false, errorCarga: false, consultar: vi.fn() })
    useAtendidasRecientes.mockReturnValue({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() })
    useEstadoVivoStore.getState().reiniciar()
    sesionCon('farmaceutico')
  })

  it('solo la crítica más antigua lleva «Registrar acción» primario', () => {
    montar([
      alerta({ id: 'al-1', created_at: '2026-07-25T10:00:00Z' }),
      alerta({ id: 'al-2', created_at: '2026-07-25T11:00:00Z' }),
      alerta({ id: 'al-3', nivel_riesgo: 'riesgo_preventivo', created_at: '2026-07-25T09:00:00Z' }),
    ])
    const registrar = screen.getAllByRole('button', { name: /registrar acción correctiva/i })
    expect(registrar).toHaveLength(3)
    expect(registrar.filter((b) => b.className.includes('coldcare-primary-action'))).toHaveLength(1)
    expect(registrar[0]).toHaveClass('coldcare-primary-action')
  })

  it('con pocas filas muestra la lectura actual de cada equipo y la guía si no hay atendidas', () => {
    useEstadoVivoStore.setState({
      carga: 'listo',
      equipos: [{ id: 'FARM-01-CDL', nombre: 'Refrigerador principal', conectividad: 'online', ultimoReporteEn: null }],
      ultimas: { 'FARM-01-CDL': { temperatura: 5.2, riesgo: 'normal', timestamp: new Date().toISOString() } },
    })
    montar([alerta()])

    const ahora = screen.getByRole('region', { name: 'Equipos ahora' })
    expect(within(ahora).getByText('FARM-01-CDL')).toBeInTheDocument()
    expect(within(ahora).getByText(/^5\.2\s°C$/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cómo se atiende una alerta' })).toBeInTheDocument()
  })

  it('con atendidas recientes no repite la guía', () => {
    useAtendidasRecientes.mockReturnValue({
      alertas: [alerta({ id: 'at-1', estado: 'atendida', atendida_en: '2026-07-25T12:30:00Z' })],
      estado: 'listo',
      limite: 50,
      recargar: vi.fn(),
    })
    montar([alerta()])

    expect(screen.getByRole('region', { name: 'Atendidas recientemente' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Cómo se atiende una alerta' })).not.toBeInTheDocument()
  })
})

/** Muestra la URL actual para afirmar sobre `?id` (HU-52). */
function Ubicacion() {
  const { pathname, search } = useLocation()
  return <output data-testid="ubicacion">{`${pathname}${search}`}</output>
}

function montarEn(ruta: string, alertas: AlertaTermica[], over: Record<string, unknown> = {}) {
  const valor = {
    alertas,
    cargando: false,
    errorCarga: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reintentar: vi.fn(),
    reconocerAlerta: vi.fn().mockResolvedValue('ok'),
    registrarAccionCorrectiva: vi.fn().mockResolvedValue('ok'),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
    rectificarAccion: vi.fn().mockResolvedValue('ok'),
    ...over,
  }
  useAlertas.mockReturnValue(valor)
  const vista = render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route
          path="/alertas"
          element={
            <>
              <AlertasPage />
              <Ubicacion />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
  return { valor, vista }
}

describe('HU-52: el enlace del correo abre la alerta (?id)', () => {
  const desplazar = vi.fn()

  beforeEach(() => {
    useAlertas.mockReset()
    useIncidentesOperativos.mockReturnValue({ incidentes: [], cargando: false, errorCarga: false, consultar: vi.fn() })
    useAtendidasRecientes.mockReturnValue({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() })
    useEstadoVivoStore.getState().reiniciar()
    sesionCon('farmaceutico')
    desplazar.mockReset()
    Element.prototype.scrollIntoView = desplazar
  })

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  it('abre el panel de la alerta del enlace, la selecciona y la desplaza a la vista', async () => {
    montarEn('/alertas?id=al-2', [
      alerta({ id: 'al-1', device_id: 'FARM-01-CDL', created_at: '2026-07-25T10:00:00Z' }),
      alerta({ id: 'al-2', device_id: 'FARM-02-CDL', created_at: '2026-07-25T11:00:00Z' }),
    ])

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('FARM-02-CDL')
    const fila = document.querySelector('[data-alerta-id="al-2"]')!
    expect(fila).toHaveAttribute('data-seleccionada')
    expect(desplazar).toHaveBeenCalled()
    expect(desplazar.mock.contexts[0]).toBe(fila)
  })

  it('va a la página de la alerta cuando no está en la primera', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      alerta({ id: `al-${i}`, device_id: `FARM-${String(i).padStart(2, '0')}-CDL`, created_at: new Date(Date.UTC(2026, 6, 25, 0, i)).toISOString() }),
    )
    montarEn('/alertas?id=al-29', muchas)

    expect(await screen.findByRole('dialog')).toHaveTextContent('FARM-29-CDL')
    expect(document.querySelector('[data-alerta-id="al-29"]')).toHaveAttribute('data-seleccionada')
  })

  it('si no está entre las pendientes la busca en «Todas» (ya reconocida o atendida)', () => {
    const { valor } = montarEn('/alertas?id=al-9', [alerta({ id: 'al-1' })])

    expect(valor.setFiltro).toHaveBeenCalledWith('todas')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una atendida del enlace se abre desde «Todas» con su cronología', async () => {
    montarEn('/alertas?id=al-9', [alerta({ id: 'al-9', estado: 'atendida', atendida_en: '2026-07-25T12:30:00Z' })], { filtro: 'todas' })

    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('heading', { name: 'Cronología de atención' })).toBeInTheDocument()
  })

  it('si tampoco está en «Todas» lo dice, sin abrir nada', async () => {
    const { valor } = montarEn('/alertas?id=no-existe', [alerta({ id: 'al-1' })], { filtro: 'todas' })

    expect(await screen.findByText(/no encontramos la alerta del enlace/i)).toBeInTheDocument()
    expect(valor.setFiltro).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('espera a que termine la carga antes de buscar', () => {
    const { valor } = montarEn('/alertas?id=al-1', [], { cargando: true })

    expect(valor.setFiltro).not.toHaveBeenCalled()
    expect(screen.queryByText(/no encontramos la alerta del enlace/i)).not.toBeInTheDocument()
  })

  it('al cerrar el panel el id sale de la URL y el foco vuelve a la fila', async () => {
    const usuario = userEvent.setup()
    montarEn('/alertas?id=al-1', [alerta({ id: 'al-1' })])

    const dialogo = await screen.findByRole('dialog')
    await usuario.click(within(dialogo).getAllByRole('button', { name: 'Cerrar' })[0])

    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\/alertas$/))
    await waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector('[data-alerta-id="al-1"] [data-accion-cronologia]')),
    )
  })
})

describe('HU-54: el enlace del correo SIN_DATOS lleva al rail de incidentes', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    useAtendidasRecientes.mockReturnValue({ alertas: [], estado: 'listo', limite: 50, recargar: vi.fn() })
    useEstadoVivoStore.getState().reiniciar()
  })

  const sinDatos: IncidenteOperativo = {
    id: 'i-1',
    device_id: 'FARM-02-CDL',
    tipo: 'sin_datos',
    estado: 'activo',
    detectado_en: '2026-07-25T11:00:00Z',
    ultimo_reporte_en: '2026-07-25T10:58:30Z',
    umbral_silencio_segundos: 90,
    recuperado_en: null,
  }

  it.each<Rol>(['farmaceutico', 'tecnico', 'auditor', 'administrador'])('/alertas muestra el incidente activo a %s', (rol) => {
    sesionCon(rol)
    useIncidentesOperativos.mockReturnValue({ incidentes: [sinDatos], cargando: false, errorCarga: false, consultar: vi.fn() })
    montarEn('/alertas', [])

    const rail = screen.getByRole('complementary', { name: 'Contexto operativo' })
    const tarjeta = within(rail).getByRole('region', { name: 'Incidentes operativos' })
    const [item] = within(tarjeta).getAllByRole('listitem')
    expect(item).toHaveTextContent('FARM-02-CDL')
    expect(item).toHaveTextContent('Sin datos')
    expect(within(tarjeta).getByText('1 activo')).toBeInTheDocument()
  })
})
