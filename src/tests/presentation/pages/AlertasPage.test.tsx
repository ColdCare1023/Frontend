import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { estadoNotificacion, type AlertaTermica } from '@/domain/entities/AlertaTermica'
import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'

const useAlertas = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useAlertas', () => ({ useAlertas }))
// Los nombres de los equipos; por defecto ninguno registrado, y la fila muestra el código.
const equiposConocidos = vi.hoisted(() => ({ lista: [] as unknown[] }))
vi.mock('@/application/hooks/useEstadoOperativo', () => ({
  useEstadoOperativo: () => ({ equipos: equiposConocidos.lista, consultar: async () => {} }),
}))

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

function montar(alertas: AlertaTermica[]) {
  const reconocerAlerta = vi.fn()
  useAlertas.mockReturnValue({
    alertas,
    cargando: false,
    filtro: 'pendiente',
    setFiltro: vi.fn(),
    reconocerAlerta,
    registrarAccionCorrectiva: vi.fn(),
    obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
  })
  render(<MemoryRouter><AlertasPage /></MemoryRouter>)
  return reconocerAlerta
}

/**
 * Las acciones ya no van en un menú por fila: el aviso se elige y su detalle las muestra. Con
 * `matchMedia` falso (jsdom) la disposición es la de móvil, así que el detalle es la hoja inferior.
 */
async function abrirAviso(dispositivo = /FARM-01-CDL/i) {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: dispositivo }))
  return { usuario, detalle: await screen.findByRole('dialog') }
}

describe('AlertasPage (RF-09, RF-10, HU-20/21/23/27/41)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    sesionCon('farmaceutico')
  })

  it('muestra la alerta con su dispositivo y su mensaje', () => {
    montar([alerta()])

    expect(screen.getByText('FARM-01-CDL')).toBeInTheDocument()
    // `getAllByText`: el detalle del semáforo de riesgo («Fuera del rango
    // 2–8 °C…») se expone ahora como texto para lector de pantalla dentro de
    // la píldora, así que la frase aparece también fuera del mensaje.
    expect(screen.getAllByText(/fuera del rango/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /fuera del rango 2-8/i })).toBeInTheDocument()
  })

  it('ofrece los cuatro filtros de la máquina de estados', () => {
    montar([alerta()])

    const nombres = screen.getAllByRole('button').map((b) => b.textContent)
    expect(nombres).toEqual(
      expect.arrayContaining(['Pendientes', 'Revisadas', 'Atendidas', 'Todas']),
    )
  })

  it('permite a un farmacéutico marcar una alerta pendiente como revisada', async () => {
    sesionCon('farmaceutico')
    montar([alerta({ estado: 'pendiente' })])

    const { detalle } = await abrirAviso()
    expect(within(detalle).getByRole('button', { name: /marcar como revisada/i })).toBeInTheDocument()
  })

  it('abre detalle de alerta pendiente para consulta, incluso con rol auditor', async () => {
    sesionCon('auditor')
    montar([alerta({ estado: 'pendiente' })])

    await userEvent.setup().click(screen.getByRole('button', { name: /abrir alerta.*FARM-01-CDL/i }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('FARM-01-CDL')
    expect(within(dialogo).getByRole('heading', { name: /cronología de atención/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('href', '/historial')
  })

  it('informa fallo al cargar cronología sin afirmar que no hay acciones', async () => {
    sesionCon('auditor')
    montar([alerta()])
    useAlertas.mock.results[0].value.obtenerCicloAtencion.mockRejectedValue(new Error('red caída'))

    await userEvent.setup().click(screen.getByRole('button', { name: /abrir alerta.*FARM-01-CDL/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/sin acciones/i)).not.toBeInTheDocument()
  })

  it('no ofrece el botón de reconocer a un técnico (RBAC en la vista)', async () => {
    // El backend ya rechaza la acción por rol (require_roles(FARMACEUTICO));
    // la vista no debe ofrecer un botón que solo puede terminar en un 403.
    sesionCon('tecnico')
    montar([alerta({ estado: 'pendiente' })])

    const { detalle } = await abrirAviso()
    expect(within(detalle).queryByRole('button', { name: /marcar como revisada/i })).not.toBeInTheDocument()
  })

  it('un técnico sí puede registrar la acción correctiva aunque no reconozca', async () => {
    // HU-23: registrar la acción marca ATENDIDA directamente desde
    // PENDIENTE, sin exigir el paso de reconocimiento.
    sesionCon('tecnico')
    montar([alerta({ estado: 'pendiente' })])

    const { detalle } = await abrirAviso()
    expect(within(detalle).getByRole('button', { name: /acción correctiva/i })).toBeInTheDocument()
  })

  it('no ofrece ninguna acción a un auditor (rol de solo lectura)', async () => {
    sesionCon('auditor')
    montar([alerta({ estado: 'pendiente' })])

    const { detalle } = await abrirAviso()
    expect(within(detalle).queryByRole('button', { name: /marcar como revisada/i })).not.toBeInTheDocument()
    expect(within(detalle).queryByRole('button', { name: /acción correctiva/i })).not.toBeInTheDocument()
  })

  it('no ofrece ninguna acción sobre una alerta ya atendida', async () => {
    sesionCon('farmaceutico')
    montar([alerta({ estado: 'atendida' })])

    const { detalle } = await abrirAviso()
    expect(within(detalle).queryByRole('button', { name: /marcar como revisada/i })).not.toBeInTheDocument()
    expect(within(detalle).queryByRole('button', { name: /acción correctiva/i })).not.toBeInTheDocument()
  })

  it('avisa cuando no hay alertas para el filtro activo', () => {
    montar([])
    expect(screen.getByText(/no hay alertas|sin alertas/i)).toBeInTheDocument()
  })

  it('avisa cuando otro usuario ya reconoció la alerta (HU-27 Escenario 2)', async () => {
    const usuario = userEvent.setup()
    const reconocerAlerta = vi.fn().mockResolvedValue('conflicto')
    useAlertas.mockReturnValue({
      alertas: [alerta({ estado: 'pendiente' })],
      cargando: false,
      filtro: 'pendiente',
      setFiltro: vi.fn(),
      reconocerAlerta,
      registrarAccionCorrectiva: vi.fn(),
      obtenerCicloAtencion: vi.fn().mockResolvedValue([]),
    })
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)

    await usuario.click(screen.getByRole('button', { name: /FARM-01-CDL/i }))
    await usuario.click(await screen.findByRole('button', { name: /marcar como revisada/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/actualizada por otra persona/i)
  })
})

describe('Evidencia de la excursión y estado del correo (outcomes 2 y 6)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    sesionCon('farmaceutico')
  })

  it('muestra pico, duración e insignia «Histórica»', async () => {
    montar([alerta({ temperatura_pico: 11.5, duracion_s: 185, historica: true })])
    const { detalle } = await abrirAviso()

    expect(within(detalle).getByText('Histórica')).toBeInTheDocument()
    // Cifra grande con su rótulo: la etiqueta y el valor van en elementos distintos.
    expect(within(detalle).getByText('Pico').closest('div')).toHaveTextContent(/Pico\s*11\.50\s*°C/)
    expect(within(detalle).getByText('Duración').closest('div')).toHaveTextContent(/Duración\s*3:05/)
  })

  it('no inventa evidencia en alertas anteriores a la migración', async () => {
    montar([alerta()])
    const { detalle } = await abrirAviso()

    expect(within(detalle).queryByText('Histórica')).not.toBeInTheDocument()
    expect(within(detalle).queryByText(/Pico/)).not.toBeInTheDocument()
    expect(within(detalle).queryByText(/Duración/)).not.toBeInTheDocument()
  })

  it.each([
    [{ notificada_en: '2026-07-25T12:00:30Z', notificacion_intentos: 1 }, 'notificada', 'Correo enviado'],
    [{ notificada_en: null, notificacion_intentos: 1 }, 'reintentando', 'Reintentando correo'],
    [{ notificada_en: null, notificacion_intentos: 3 }, 'no_entregada', 'Correo no entregado'],
    [{ notificada_en: null, notificacion_intentos: 0 }, 'pendiente', 'Correo pendiente'],
  ])('estado del correo %#', async (campos, estado, texto) => {
    expect(estadoNotificacion(alerta(campos))).toBe(estado)
    montar([alerta(campos)])
    const { detalle } = await abrirAviso()
    expect(within(detalle).getByText(texto)).toBeInTheDocument()
  })

  it('un correo no entregado se ve desde la lista, sin abrir el aviso', () => {
    montar([alerta({ notificada_en: null, notificacion_intentos: 3 })])
    expect(screen.getByRole('img', { name: 'Correo no entregado' })).toBeInTheDocument()
  })

  it('una alerta preventiva no muestra estado de correo', async () => {
    expect(estadoNotificacion(alerta({ nivel_riesgo: 'riesgo_preventivo' }))).toBeNull()
    montar([alerta({ nivel_riesgo: 'riesgo_preventivo' })])
    const { detalle } = await abrirAviso()
    expect(within(detalle).queryByText(/^Correo/)).not.toBeInTheDocument()
  })
})

describe('La bandeja (DESIGN.md)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    sesionCon('farmaceutico')
  })

  const dosPaneles = () =>
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('min-width: 768px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

  it('cada aviso muestra su temperatura grande y su nivel, sin abrirlo', () => {
    montar([alerta({ mensaje: 'Temperatura interna 8.6 °C fuera del rango de conservación 2–8 °C' })])
    const fila = screen.getByRole('button', { name: /FARM-01-CDL/i })
    expect(within(fila).getByText('8.6')).toBeInTheDocument()
    expect(within(fila).getByText('Excursión crítica')).toBeInTheDocument()
  })

  it('con pantalla ancha muestra el primer aviso en el panel, sin hoja ni diálogo', async () => {
    const espia = dosPaneles()
    montar([alerta()])
    const panel = screen.getByRole('complementary', { name: /FARM-01-CDL/i })
    expect(within(panel).getByRole('button', { name: /marcar como revisada/i })).toBeInTheDocument()
    expect(await within(panel).findByText(/sin acciones correctivas/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    espia.mockRestore()
  })

  it('elegir otro aviso cambia el panel sin abrir nada encima', async () => {
    const espia = dosPaneles()
    montar([alerta(), alerta({ id: 'al-2', device_id: 'FARM-02-CDL', nivel_riesgo: 'riesgo_preventivo' })])
    await userEvent.setup().click(screen.getByRole('button', { name: /FARM-02-CDL/i }))
    expect(screen.getByRole('complementary', { name: /FARM-02-CDL/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /FARM-02-CDL/i })).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    espia.mockRestore()
  })

  it('cuando cargar falla ofrece reintentar y no finge una bandeja vacía', async () => {
    const reintentar = vi.fn()
    useAlertas.mockReturnValue({
      alertas: [],
      cargando: false,
      errorCarga: true,
      reintentar,
      filtro: 'pendiente',
      setFiltro: vi.fn(),
      reconocerAlerta: vi.fn(),
      registrarAccionCorrectiva: vi.fn(),
      obtenerCicloAtencion: vi.fn(),
    })
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar las alertas/i)
    expect(screen.queryByText(/no hay alertas/i)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /volver a intentar/i }))
    expect(reintentar).toHaveBeenCalled()
  })

  it('al cancelar la acción correctiva vuelve a la hoja del aviso', async () => {
    montar([alerta()])
    const { usuario, detalle } = await abrirAviso()
    await usuario.click(within(detalle).getByRole('button', { name: /acción correctiva/i }))
    const formulario = await screen.findByRole('dialog', { name: /registrar acción correctiva/i })
    await usuario.click(within(formulario).getByRole('button', { name: /cancelar/i }))
    expect(await screen.findByRole('dialog', { name: /FARM-01-CDL/i })).toBeInTheDocument()
  })
})

describe('Alertas para el farmacéutico (DESIGN.md: «Para quién es»)', () => {
  beforeEach(() => {
    useAlertas.mockReset()
    equiposConocidos.lista = []
    sesionCon('farmaceutico')
  })

  // Por nombre accesible: la cifra que rueda lleva su valor para el lector y sus dígitos ocultos.
  const titulo = () => screen.getByRole('heading', { level: 1 })

  it('arriba dice cuántas faltan, en las palabras de cada rol', () => {
    montar([alerta(), alerta({ id: 'al-2' })])
    expect(titulo()).toHaveAccessibleName('Alertas: Tienes 2 alertas por revisar')
  })

  it('el técnico las atiende', () => {
    sesionCon('tecnico')
    montar([alerta()])
    expect(titulo()).toHaveAccessibleName('Alertas: Tienes 1 alerta por atender')
  })

  it('el auditor lee «Hay 1 alerta pendiente»', () => {
    sesionCon('auditor')
    montar([alerta()])
    expect(titulo()).toHaveAccessibleName('Alertas: Hay 1 alerta pendiente')
  })

  it('sin pendientes dice «Todo revisado» con un estado vacío en calma', () => {
    montar([])
    expect(titulo()).toHaveAccessibleName('Alertas: Todo revisado')
    expect(screen.getByText('No hay alertas pendientes.').closest('[role="status"]')).not.toBeNull()
  })

  it('si la carga falla no dice «Todo revisado»', () => {
    useAlertas.mockReturnValue({
      alertas: [], cargando: false, errorCarga: true, reintentar: vi.fn(), filtro: 'pendiente', setFiltro: vi.fn(),
      reconocerAlerta: vi.fn(), registrarAccionCorrectiva: vi.fn(), obtenerCicloAtencion: vi.fn(),
    })
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    expect(titulo()).not.toHaveTextContent('Todo revisado')
  })

  it('la fila dice qué equipo por su nombre y no repite el mensaje si ya tiene cifra', () => {
    equiposConocidos.lista = [{ id: 'FARM-01-CDL', nombre: 'Refrigerador principal' }]
    montar([alerta({ mensaje: 'Temperatura interna 9.2 °C fuera del rango de conservación 2–8 °C' })])
    const fila = screen.getByRole('button', { name: /abrir alerta/i })
    expect(within(fila).getByText(/Refrigerador principal/)).toBeInTheDocument()
    expect(within(fila).getByText('9.2')).toBeInTheDocument()
    expect(within(fila).queryByText(/fuera del rango de conservación/)).not.toBeInTheDocument()
    expect(fila).toHaveTextContent(/hace/)
  })

  it('al abrirla, primero «Qué hacer» y la acción; la evidencia y la cronología tras «Ver más»', async () => {
    montar([alerta({ temperatura_pico: 9.4 })])
    const { detalle } = await abrirAviso()

    const queHacer = within(detalle).getByRole('heading', { name: 'Qué hacer' })
    const verMas = within(detalle).getByRole('button', { name: 'Ver más' })
    expect(queHacer.compareDocumentPosition(verMas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(verMas).toHaveAttribute('aria-expanded', 'false')
    expect(within(detalle).getByText(/Márcala como revisada y anota lo que hiciste/)).toBeInTheDocument()
    expect(within(detalle).getByRole('button', { name: /marcar como revisada/i })).toBeInTheDocument()
    // La evidencia sigue ahí, plegada: no se borró nada.
    const pliegue = document.getElementById(verMas.getAttribute('aria-controls')!)!
    expect(within(pliegue).getByText('Pico')).toBeInTheDocument()
    expect(within(pliegue).getByRole('heading', { name: /cronología de atención/i })).toBeInTheDocument()
  })

  it('al técnico no le pide marcarla como revisada', async () => {
    sesionCon('tecnico')
    montar([alerta()])
    const { detalle } = await abrirAviso()
    expect(within(detalle).queryByText(/Márcala como revisada/)).not.toBeInTheDocument()
    expect(within(detalle).getByText(/Anota lo que hiciste en la acción correctiva/)).toBeInTheDocument()
  })

  it('el auditor no ve pasos ni acciones: lee lo que pasó, con «Ver más» abierto', async () => {
    sesionCon('auditor')
    montar([alerta()])
    const { detalle } = await abrirAviso()
    expect(within(detalle).getByText(/Solo consulta/)).toBeInTheDocument()
    expect(within(detalle).queryByText(/Mira cómo está ahora/)).not.toBeInTheDocument()
    expect(within(detalle).getByRole('button', { name: 'Ver más' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('un correo no entregado no queda plegado', async () => {
    montar([alerta({ notificada_en: null, notificacion_intentos: 3 })])
    const { detalle } = await abrirAviso()
    const verMas = within(detalle).getByRole('button', { name: 'Ver más' })
    const pliegue = document.getElementById(verMas.getAttribute('aria-controls')!)!
    expect(within(detalle).getByText('Correo no entregado')).toBeInTheDocument()
    expect(within(pliegue).queryByText('Correo no entregado')).not.toBeInTheDocument()
  })

  it('al marcarla como revisada lo anuncia', async () => {
    const reconocerAlerta = montar([alerta()])
    reconocerAlerta.mockResolvedValue('ok')
    const { usuario, detalle } = await abrirAviso()
    await usuario.click(within(detalle).getByRole('button', { name: /marcar como revisada/i }))
    expect(reconocerAlerta).toHaveBeenCalledWith('al-1')
    expect(await screen.findByText('Alerta marcada como revisada.')).toBeInTheDocument()
  })
})
