import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import i18n from '@/infrastructure/i18n'
import { IslaDinamica, LecturaActual } from '@/presentation/components/notificaciones/IslaDinamica'
import { limpiarAvisos, notificarNotch } from '@/presentation/components/notificaciones/notificarNotch'
import type { ResumenIsla } from '@/presentation/components/notificaciones/useResumenIsla'
import { AppLayout } from '@/presentation/layouts/AppLayout'
import { NavPrincipal } from '@/presentation/layouts/NavegacionCapsula'
import { navegacionDe } from '@/presentation/layouts/navegacion'

/** Simula el ancho de la ventana: el marco decide con `matchMedia`, y jsdom no calcula CSS. */
function simularAncho(ancho: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (consulta: string) =>
      ({
        matches: Number(/min-width:\s*(\d+)/.exec(consulta)?.[1] ?? 0) <= ancho,
        media: consulta,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

function iniciarSesion(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: 'persona@upc.pe', rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
  })
}

function montar(rol: Rol, ruta = '/dashboard') {
  iniciarSesion(rol)
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppLayout />
    </MemoryRouter>,
  )
}

const navPrincipal = () => screen.getByRole('navigation', { name: 'Navegación principal' })
const palabras = (nav: HTMLElement) => within(nav).getAllByRole('link').map((enlace) => enlace.textContent)
/** El nombre accesible de cada fila de «Más»: solo el nombre; la línea de ayuda es su descripción. */
const nombresMas = (panel: HTMLElement) =>
  within(within(panel).getByRole('navigation', { name: 'Más pantallas' }))
    .getAllByRole('link')
    .map((enlace) => document.getElementById(enlace.getAttribute('aria-labelledby') ?? '')?.textContent)

beforeEach(async () => {
  await i18n.changeLanguage('es')
})

afterEach(() => {
  act(() => limpiarAvisos())
})

describe('Qué ve cada rol', () => {
  it.each<[Rol, string[], string[]]>([
    ['farmaceutico', ['/dashboard', '/alertas', '/historial', '/reportes'], ['/trazabilidad', '/metricas-ia', '/guia']],
    ['tecnico', ['/dashboard', '/alertas', '/historial'], ['/trazabilidad', '/guia']],
    ['auditor', ['/dashboard', '/alertas', '/historial', '/reportes'], ['/trazabilidad', '/metricas-ia', '/guia', '/auditoria']],
    [
      'administrador',
      ['/dashboard', '/alertas', '/historial', '/reportes'],
      ['/trazabilidad', '/metricas-ia', '/guia', '/auditoria', '/usuarios', '/dispositivos'],
    ],
  ])('%s: la cápsula y «Más» salen de la misma lista de permisos', (rol, principales, mas) => {
    const nav = navegacionDe(rol)
    expect(nav.principales.map((item) => item.ruta)).toEqual(principales)
    expect(nav.mas.map((item) => item.ruta)).toEqual(mas)
    // Cada pantalla de «Más» dice para qué sirve.
    for (const item of nav.mas) expect(i18n.exists(item.claveDetalle ?? '')).toBe(true)
  })
})

describe('Navegación de escritorio', () => {
  beforeEach(() => simularAncho(1440))

  it('una sola cápsula arriba, con palabras y sin barra lateral', () => {
    const { container } = montar('tecnico')

    const nav = navPrincipal()
    expect(screen.getAllByRole('navigation', { name: 'Navegación principal' })).toHaveLength(1)
    expect(screen.getByRole('banner')).toContainElement(nav)
    // Un técnico no tiene Reportes: no aparece ni deja hueco.
    expect(palabras(nav)).toEqual(['Inicio', 'Alertas', 'Historial'])
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4)
    expect(within(nav).getByRole('button', { name: /^Más/ })).toHaveTextContent('Más')
    // Sin barra que plegar ni preferencia que la recuerde.
    expect(container.querySelector('[data-nav]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Contraer menú|Expandir menú/ })).toBeNull()
  })

  it('«Más» reúne el resto, cada pantalla con una línea simple, y se cierra al elegir', async () => {
    const usuario = userEvent.setup()
    montar('administrador')

    expect(palabras(navPrincipal())).toEqual(['Inicio', 'Alertas', 'Historial', 'Reportes'])
    await usuario.click(screen.getByRole('button', { name: /^Más/ }))

    const panel = await screen.findByRole('dialog', { name: 'Más' })
    expect(nombresMas(panel)).toEqual(['Comprobar registros', 'Clasificador', 'Ayuda', 'Auditoría', 'Usuarios', 'Equipos'])
    expect(within(panel).getByRole('link', { name: 'Ayuda' })).toHaveAccessibleDescription('Qué hace cada pantalla y qué hacer ante una alerta.')

    await usuario.click(within(panel).getByRole('link', { name: 'Ayuda' }))
    expect(screen.queryByRole('dialog', { name: 'Más' })).toBeNull()
  })

  it('el auditor ve en «Más» solo lo suyo', async () => {
    const usuario = userEvent.setup()
    montar('auditor')

    await usuario.click(screen.getByRole('button', { name: /^Más/ }))
    expect(nombresMas(await screen.findByRole('dialog', { name: 'Más' }))).toEqual(['Comprobar registros', 'Clasificador', 'Ayuda', 'Auditoría'])
  })

  it('marca la pantalla actual para el lector de pantalla', () => {
    montar('farmaceutico', '/historial')

    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Alertas' })).not.toHaveAttribute('aria-current')
  })

  it('en una pantalla de «Más», la píldora va a «Más» y la fila se marca', async () => {
    const usuario = userEvent.setup()
    montar('farmaceutico', '/trazabilidad')

    expect(screen.getByRole('button', { name: /^Más/ })).toHaveAttribute('data-activo', 'true')
    await usuario.click(screen.getByRole('button', { name: /^Más/ }))
    expect(within(await screen.findByRole('dialog', { name: 'Más' })).getByRole('link', { name: 'Comprobar registros' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('a la derecha, la lectura y la cuenta; tema e idioma viven en la cuenta', async () => {
    const usuario = userEvent.setup()
    montar('farmaceutico')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('button', { name: /Abrir el detalle/ })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ajustes' })).toBeNull()

    await usuario.click(within(banner).getByRole('button', { name: /^Menú de usuario/ }))
    expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Cambiar contraseña/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Oscuro' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /Español/ })).toBeInTheDocument()
  })

  it('conserva el salto al contenido', () => {
    montar('farmaceutico')
    expect(screen.getByRole('link', { name: 'Saltar al contenido principal' })).toHaveAttribute('href', '#contenido-principal')
  })
})

describe('Navegación de móvil', () => {
  beforeEach(() => simularAncho(402))

  it('arriba marca, lectura y cuenta; abajo la misma navegación', () => {
    montar('administrador')

    const nav = navPrincipal()
    expect(screen.getByRole('banner')).not.toContainElement(nav)
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /Abrir el detalle/ })).toBeInTheDocument()
    expect(palabras(nav)).toEqual(['Inicio', 'Alertas', 'Historial', 'Reportes'])
    // WCAG 2.5.3: el nombre accesible contiene la etiqueta visible.
    expect(within(nav).getByRole('button', { name: /^Más/ })).toHaveTextContent('Más')
  })

  it('un técnico no ve Reportes y la cápsula no deja hueco', () => {
    montar('tecnico')

    const nav = navPrincipal()
    expect(palabras(nav)).toEqual(['Inicio', 'Alertas', 'Historial'])
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4)
  })

  it('la hoja «Más» trae el resto del rol y se cierra al elegir', async () => {
    const usuario = userEvent.setup()
    montar('auditor')

    await usuario.click(screen.getByRole('button', { name: /Abrir menú/ }))

    const hoja = screen.getByRole('dialog', { name: 'Más' })
    expect(nombresMas(hoja)).toEqual(['Comprobar registros', 'Clasificador', 'Ayuda', 'Auditoría'])

    await usuario.click(within(hoja).getByRole('link', { name: 'Auditoría' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Más» se marca cuando la pantalla actual no está en la cápsula', () => {
    montar('administrador', '/usuarios')

    expect(screen.getByRole('button', { name: /Abrir menú/ })).toHaveAttribute('data-activo', 'true')
  })

  it('el menú de la cuenta trae tema, idioma y cierre de sesión', async () => {
    const usuario = userEvent.setup()
    montar('farmaceutico')

    await usuario.click(screen.getByRole('button', { name: /^Menú de usuario/ }))
    expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Oscuro' })).toBeInTheDocument()
  })
})

describe('Número de alertas', () => {
  function montarNav(alertas: ResumenIsla['alertas']) {
    iniciarSesion('farmaceutico')
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NavPrincipal posicion="arriba" alertas={alertas} masAbierto={false} alCambiarMas={vi.fn()} />
      </MemoryRouter>,
    )
  }

  it('Alertas lleva su número y lo dice con palabras', () => {
    montarNav({ total: 3, criticas: 1 })

    const enlace = screen.getByRole('link', { name: 'Alertas, 3 alertas pendientes' })
    expect(enlace.querySelector('[data-critica="true"]')).toHaveTextContent('3')
  })

  it('sin alertas, o sin saber cuántas hay, no inventa un cero', () => {
    const { unmount } = montarNav({ total: 0, criticas: 0 })
    expect(screen.getByRole('link', { name: 'Alertas' })).toBeInTheDocument()
    unmount()

    montarNav(null)
    expect(screen.getByRole('link', { name: 'Alertas' })).toBeInTheDocument()
  })
})

const RESUMEN_VACIO: ResumenIsla = { equipos: [], principal: null, alertas: null, conectado: null, cargando: false }

describe('La lectura actual', () => {
  it('dice el equipo por su nombre, no por su código', () => {
    const principal = {
      id: 'FARM-01-CDL',
      nombre: 'Refrigerador principal',
      estado: 'normal' as const,
      antiguedad: 5,
      lectura: { device_id: 'FARM-01-CDL', timestamp: new Date().toISOString(), temperatura_interna: 4.7 } as never,
    }
    render(
      <MemoryRouter>
        <LecturaActual resumen={{ ...RESUMEN_VACIO, equipos: [principal], principal }} verAlertas />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Refrigerador principal. 4.7 °C. Normal. Abrir el detalle' })).toBeInTheDocument()
  })
})

describe('La cápsula central se transforma', () => {
  function montarIsla({ resumen = RESUMEN_VACIO, retenida = false } = {}) {
    return render(
      <MemoryRouter>
        <IslaDinamica resumen={resumen} verAlertas retenida={retenida}>
          <nav aria-label="Navegación principal">
            <a href="/dashboard">Inicio</a>
          </nav>
        </IslaDinamica>
      </MemoryRouter>,
    )
  }

  beforeEach(() => {
    simularAncho(1440)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cuenta el aviso y vuelve sola a las palabras, sin que nadie haga nada', async () => {
    montarIsla()
    const calma = screen.getByRole('navigation').parentElement

    act(() => {
      notificarNotch('aviso', { id: 'a', titulo: 'Aviso', detalle: 'El buffer de FARM-01 supera el 80 %.', duracion: 15_000 })
    })
    expect(await screen.findByRole('button', { name: /El buffer de FARM-01 supera el 80 %/ })).toBeInTheDocument()
    // La navegación no se desmonta: se oculta en su sitio.
    expect(calma).toHaveAttribute('data-oculta', 'true')
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(screen.queryByRole('button', { name: /El buffer de FARM-01/ })).toBeNull()
    expect(calma).toHaveAttribute('data-oculta', 'false')
  })

  it('lo crítico se adelanta a lo que se estaba contando', async () => {
    montarIsla()

    act(() => {
      notificarNotch('ok', { id: 'b', titulo: 'Confirmado', detalle: 'FARM-01 volvió al rango seguro.', duracion: 15_000 })
    })
    act(() => {
      notificarNotch('critico', { id: 'c', titulo: 'Alerta crítica', detalle: 'FARM-02 se desconectó.', duracion: 15_000 })
    })

    expect(await screen.findByRole('button', { name: /FARM-02 se desconectó/ })).toBeInTheDocument()
  })

  it('no se recoge mientras alguien la está leyendo', async () => {
    montarIsla()
    act(() => {
      notificarNotch('ok', { id: 'd', titulo: 'Confirmado', detalle: 'Credencial rotada.', duracion: 15_000 })
    })
    const boton = await screen.findByRole('button', { name: /Credencial rotada/ })

    act(() => boton.focus())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(screen.getByRole('button', { name: /Credencial rotada/ })).toBeInTheDocument()
  })

  it('llegar a la navegación con el teclado la recupera al instante', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    montarIsla()
    act(() => {
      notificarNotch('aviso', { id: 'g', titulo: 'Aviso', detalle: 'FARM-01 lleva tiempo sin red.', duracion: 15_000 })
    })
    await screen.findByRole('button', { name: /FARM-01 lleva tiempo sin red/ })

    await usuario.tab() // el aviso
    await usuario.tab() // ocultarlo
    await usuario.tab() // la navegación

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: /FARM-01 lleva tiempo sin red/ })).toBeNull()
  })

  it('con el foco de teclado en la navegación, el aviso espera a que salga', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    montarIsla()
    await usuario.tab()
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveFocus()

    act(() => {
      notificarNotch('critico', { id: 'h', titulo: 'Alerta crítica', detalle: 'FARM-04 se desconectó.', duracion: 15_000 })
    })
    expect(screen.queryByRole('button', { name: /FARM-04/ })).toBeNull()

    act(() => screen.getByRole('link', { name: 'Inicio' }).blur())
    expect(await screen.findByRole('button', { name: /FARM-04/ })).toBeInTheDocument()
  })

  it('con «Más» abierto encima, el aviso espera', async () => {
    const { rerender } = montarIsla({ retenida: true })
    act(() => {
      notificarNotch('aviso', { id: 'i', titulo: 'Aviso', detalle: 'FARM-05 cambió de red.', duracion: 15_000 })
    })
    expect(screen.queryByRole('button', { name: /FARM-05/ })).toBeNull()

    rerender(
      <MemoryRouter>
        <IslaDinamica resumen={RESUMEN_VACIO} verAlertas>
          <nav aria-label="Navegación principal">
            <a href="/dashboard">Inicio</a>
          </nav>
        </IslaDinamica>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: /FARM-05/ })).toBeInTheDocument()
  })

  it('se puede ocultar a mano; el foco vuelve a la navegación', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    montarIsla()
    act(() => {
      notificarNotch('aviso', { id: 'j', titulo: 'Aviso', detalle: 'FARM-06 se reinició.', duracion: 15_000 })
    })
    await screen.findByRole('button', { name: /FARM-06/ })

    await usuario.tab()
    await usuario.tab()
    expect(screen.getByRole('button', { name: 'Ocultar este aviso' })).toHaveFocus()
    await usuario.keyboard('{Enter}')

    expect(screen.queryByRole('button', { name: /FARM-06/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveFocus()
  })

  it('cuenta con el nombre del equipo, no con su código', async () => {
    const equipo = { id: 'FARM-01-CDL', nombre: 'Refrigerador principal', estado: 'normal' as const, antiguedad: 5, lectura: null }
    montarIsla({ resumen: { ...RESUMEN_VACIO, equipos: [equipo], principal: equipo } })
    act(() => {
      notificarNotch('critico', { id: 'k', titulo: 'Alerta crítica', detalle: 'FARM-01-CDL se quedó sin conexión.', duracion: 15_000 })
    })

    expect(await screen.findByRole('button', { name: /Refrigerador principal se quedó sin conexión/ })).toBeInTheDocument()
  })

  it('el panel conserva el detalle completo de los avisos de la sesión', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    montarIsla()
    act(() => {
      notificarNotch('aviso', { id: 'e', titulo: 'Aviso', detalle: 'Se cambió la configuración de FARM-01 desde su consola.', duracion: 15_000 })
    })

    await usuario.click(await screen.findByRole('button', { name: /Abrir el detalle/ }))

    const panel = await screen.findByRole('dialog', { name: 'Estado actual de los equipos' })
    expect(within(panel).getByText('Se cambió la configuración de FARM-01 desde su consola.')).toBeInTheDocument()
  })

  it('al desmontarse olvida los avisos: el siguiente usuario no los hereda', async () => {
    const { unmount } = montarIsla()
    act(() => {
      notificarNotch('critico', { id: 'f', titulo: 'Alerta crítica', detalle: 'FARM-03 se desconectó.', duracion: 15_000 })
    })
    await screen.findByRole('button', { name: /FARM-03/ })
    unmount()

    montarIsla()

    expect(screen.queryByRole('button', { name: /FARM-03/ })).toBeNull()
  })
})
