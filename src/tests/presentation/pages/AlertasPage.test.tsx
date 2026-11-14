import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { estadoNotificacion, type AlertaTermica } from '@/domain/entities/AlertaTermica'
import { useAuthStore } from '@/application/stores/authStore'
import { resumirAlertas, useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
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
    for (const nombre of ['Pendientes', 'Revisadas', 'Atendidas', 'Todas']) {
      expect(within(grupo).getByRole('button', { name: nombre, exact: true } as never)).toBeInTheDocument()
    }
    expect(within(grupo).getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('muestra el conteo de Pendientes y Revisadas sin cambiar su nombre accesible', () => {
    useEstadoVivoStore.setState({
      carga: 'listo',
      alertas: resumirAlertas([[alerta(), alerta({ id: 'al-2' })], [alerta({ id: 'al-3', estado: 'reconocida' })]]),
    })
    montar([alerta()])

    const pendientes = screen.getByRole('button', { name: 'Pendientes' })
    expect(pendientes).toHaveAccessibleDescription('2 alertas')
    expect(screen.getByRole('button', { name: 'Revisadas' })).toHaveAccessibleDescription('1 alerta')
  })

  it('farmacéutico ve Revisar, Registrar acción y Cronología en una pendiente', () => {
    montar([alerta()])

    expect(within(fila()).getByRole('button', { name: /revisar alerta de FARM-01-CDL/i })).toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención: FARM-01-CDL/i })).toBeInTheDocument()
    // El menú «Opciones» desaparece: las acciones están a la vista (H4).
    expect(screen.queryByRole('button', { name: /^opciones/i })).not.toBeInTheDocument()
  })

  it('administrador ve las mismas acciones que el farmacéutico (RBAC jerárquico)', () => {
    sesionCon('administrador')
    montar([alerta()])

    expect(within(fila()).getByRole('button', { name: /revisar alerta/i })).toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
  })

  it('técnico ve Registrar acción pero no Revisar (HU-23/41)', () => {
    sesionCon('tecnico')
    montar([alerta()])

    expect(within(fila()).queryByRole('button', { name: /revisar alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
  })

  it('auditor solo ve Cronología (HU-41)', () => {
    sesionCon('auditor')
    montar([alerta()])

    expect(within(fila()).queryByRole('button', { name: /revisar alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).queryByRole('button', { name: /registrar acción/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención/i })).toBeInTheDocument()
  })

  it('alerta revisada ofrece Registrar acción y no Revisar', () => {
    montar([alerta({ estado: 'reconocida' })], { filtro: 'reconocida' })

    expect(within(fila()).queryByRole('button', { name: /revisar alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /registrar acción correctiva/i })).toBeInTheDocument()
  })

  it('alerta atendida solo ofrece la cronología', () => {
    montar([alerta({ estado: 'atendida' })], { filtro: 'atendida' })

    expect(within(fila()).queryByRole('button', { name: /revisar alerta/i })).not.toBeInTheDocument()
    expect(within(fila()).queryByRole('button', { name: /registrar acción/i })).not.toBeInTheDocument()
    expect(within(fila()).getByRole('button', { name: /cronología de atención/i })).toBeInTheDocument()
  })

  it('Revisar llama a reconocerAlerta y anuncia el resultado', async () => {
    const { reconocerAlerta } = montar([alerta()])

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /revisar alerta/i }))

    expect(reconocerAlerta).toHaveBeenCalledWith('al-1')
    expect(await screen.findByText('Alerta de FARM-01-CDL marcada como revisada.')).toBeInTheDocument()
  })

  it('avisa cuando otro usuario ya reconoció la alerta (HU-27 Escenario 2)', async () => {
    montar([alerta()], { reconocerAlerta: vi.fn().mockResolvedValue('conflicto') })

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /revisar alerta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/actualizada por otra persona/i)
  })

  it('informa error de red al revisar', async () => {
    montar([alerta()], { reconocerAlerta: vi.fn().mockResolvedValue('error') })

    await userEvent.setup().click(within(fila()).getByRole('button', { name: /revisar alerta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo marcar la alerta de FARM-01-CDL/i)
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
    ['reconocida', /no hay alertas marcadas como revisadas/i, 'Ver pendientes'],
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
