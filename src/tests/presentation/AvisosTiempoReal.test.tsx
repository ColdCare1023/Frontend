import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventoAlerta, OyentesTiempoReal } from '@/infrastructure/sse/sseClient'

const suscriptores = vi.hoisted(() => [] as OyentesTiempoReal[])
vi.mock('@/infrastructure/sse/sseClient', () => ({
  suscribirseTiempoReal: (oyentes: OyentesTiempoReal) => {
    suscriptores.push(oyentes)
    return () => {}
  },
}))
// Lo visible es el notch: se registra con qué nivel se publicó cada aviso.
const notch = vi.hoisted(() => vi.fn())
vi.mock('@/presentation/components/notificaciones/notificarNotch', async (original) => {
  const real = await original<typeof import('@/presentation/components/notificaciones/notificarNotch')>()
  return {
    ...real,
    notificarNotch: (...args: Parameters<typeof real.notificarNotch>) => {
      notch(...args)
      return real.notificarNotch(...args)
    },
  }
})

import { useFuenteEstadoVivo } from '@/application/hooks/useEstadoVivo'
import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import i18n from '@/infrastructure/i18n'
import { AvisosTiempoReal } from '@/presentation/components/AvisosTiempoReal'
import { instalarAdaptadorFalso } from '../ayudas'

function sesion(rol: 'administrador' | 'farmaceutico') {
  useAuthStore.setState({ usuario: { id: 'u1', email: 'u@x.pe', rol, expiraEn: Date.now() + 3_600_000 }, autenticado: true })
}

/** FE-008: lo que no es una lectura también se ve en tiempo real. */
describe('AvisosTiempoReal', () => {
  beforeEach(async () => {
    suscriptores.length = 0
    notch.mockClear()
    await i18n.changeLanguage('es')
  })

  it('muestra la desconexión del nodo y la alerta como avisos críticos', () => {
    render(<AvisosTiempoReal />)
    const oyentes = suscriptores[0]

    act(() => {
      oyentes.onConectividad?.({ device_id: 'FARM-01', estado: 'offline', desde: 'x', boot_id: null, origen: 'lwt' })
      oyentes.onAlerta?.({ tipo: 'alerta', device_id: 'FARM-02' })
    })

    const criticos = screen.getAllByRole('alert')
    expect(criticos.map((n) => n.textContent)).toEqual([
      'FARM-01 se desconectó del broker.',
      'Nueva alerta térmica en FARM-02.',
    ])
  })

  it('unifica los nombres heredados del buffer', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onAvisoDispositivo?.({ tipo: 'saturacion_buffer', device_id: 'FARM-03', timestamp: 'x', detalle: null })
    })
    expect(screen.getByRole('alert')).toHaveTextContent('El buffer local de FARM-03 se saturó')
  })

  it('una reconexión no genera ruido', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onConectividad?.({ device_id: 'FARM-01', estado: 'online', desde: 'x', boot_id: null, origen: 'online' })
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('avisa del uso de la consola del nodo (IOT-002)', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onAvisoDispositivo?.({
        tipo: 'config_modificada', device_id: 'FARM-01', timestamp: 'x', detalle: { clave: 'mqtt_host', accion: 'set' },
      })
      suscriptores[0].onAvisoDispositivo?.({ tipo: 'consola_desbloqueo_fallido', device_id: 'FARM-01', timestamp: 'x', detalle: { intentos: 5 } })
    })
    expect(screen.getByRole('status')).toHaveTextContent('Se cambió la configuración de FARM-01 desde su consola (mqtt_host).')
    expect(screen.getByRole('alert')).toHaveTextContent('Intentos fallidos repetidos de desbloquear la consola de FARM-01.')
  })

  it('informa el resultado de una actualización OTA según el nodo (IOT-004)', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onAvisoDispositivo?.({
        tipo: 'ota_confirmada', device_id: 'FARM-01', timestamp: 'x', detalle: { firmware_version: '1.3.0', particion: 'app1' },
      })
      suscriptores[0].onAvisoDispositivo?.({
        tipo: 'ota_revertida', device_id: 'FARM-02', timestamp: 'x', detalle: { firmware_version: '1.2.0', particion: 'app0' },
      })
    })
    expect(screen.getByRole('status')).toHaveTextContent('FARM-01 confirmó la actualización a la versión 1.3.0.')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'FARM-02 volvió a la versión 1.2.0: la actualización no superó el arranque.',
    )
  })

  it('HU-44: avisa la excursión no verificada y una prueba de posesión con el token anterior', () => {
    sesion('administrador')
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onIncidenteOperativo?.({
        tipo: 'excursion_no_verificada', id: 'i1', device_id: 'FARM-01', estado: 'activo', detectado_en: 'x',
        ultimo_reporte_en: null, umbral_silencio_segundos: 0, recuperado_en: null,
        detalle: { temperatura_interna: 11.5, captured_at: 'x' },
      })
      suscriptores[0].onPruebaPosesion?.({ device_id: 'FARM-01', verificada: false, motivo: 'firma_invalida' })
    })
    const criticos = screen.getAllByRole('alert').map((n) => n.textContent)
    expect(criticos[0]).toContain('Excursión crítica de origen no verificado en FARM-01: 11.50 °C')
    expect(criticos[1]).toContain('FARM-01 sigue con el token anterior')
  })

  it('HU-44: el aviso de la consola solo le sale al administrador', () => {
    sesion('farmaceutico')
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onPruebaPosesion?.({ device_id: 'FARM-01', verificada: false, motivo: 'firma_invalida' })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('HU-44: la firma inválida del mismo equipo se avisa una vez cada 5 min', () => {
    vi.useFakeTimers()
    try {
      sesion('administrador')
      render(<AvisosTiempoReal />)
      const fallo = { device_id: 'FARM-01', verificada: false, motivo: 'firma_invalida' }
      act(() => {
        suscriptores[0].onPruebaPosesion?.(fallo)
        suscriptores[0].onPruebaPosesion?.(fallo)
      })
      expect(screen.getAllByRole('alert')).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(5 * 60_000)
        suscriptores[0].onPruebaPosesion?.(fallo)
      })
      expect(screen.getAllByRole('alert')).toHaveLength(1) // el primero ya expiró (15 s)
    } finally {
      vi.useRealTimers()
    }
  })

  it('HU-44: la prueba de posesión verificada se anuncia como recuperación', () => {
    render(<AvisosTiempoReal />)
    act(() => {
      suscriptores[0].onPruebaPosesion?.({ device_id: 'FARM-02', verificada: true, motivo: 'verificada' })
    })
    expect(screen.getByRole('status')).toHaveTextContent('FARM-02 probó la credencial nueva')
  })

  describe('HU-08 esc. 3: reconexión Wi-Fi prolongada', () => {
    const avisar = (detalle: Record<string, unknown> | null, tipo: 'wifi_reconexion_prolongada' | 'reconexion_prolongada' = 'wifi_reconexion_prolongada') =>
      act(() => {
        suscriptores[0].onAvisoDispositivo?.({ tipo, device_id: 'FARM-01', timestamp: 'x', detalle })
      })

    it('dice que se reconectó tras N intentos y cuánto duró, con el detalle del nodo', () => {
      render(<AvisosTiempoReal />)
      avisar({ intentos_fallidos: 7, duracion_s: 45, umbral_intentos: 5 })

      expect(screen.getByRole('status')).toHaveTextContent('FARM-01 se reconectó tras 7 intentos (45 s).')
      expect(screen.queryByText(/lleva tiempo intentando/i)).not.toBeInTheDocument()
    })

    it('episodios largos con duración legible, y el nombre heredado del evento igual', () => {
      render(<AvisosTiempoReal />)
      avisar({ intentos_fallidos: 12, duracion_s: 185 }, 'reconexion_prolongada')

      expect(screen.getByRole('status')).toHaveTextContent('FARM-01 se reconectó tras 12 intentos (3 min 5 s).')
    })

    it('sin duración dice los intentos; sin detalle, que se reconectó tras un periodo prolongado', () => {
      render(<AvisosTiempoReal />)
      avisar({ intentos_fallidos: 1 })
      avisar(null)

      const textos = screen.getAllByRole('status').map((n) => n.textContent)
      expect(textos).toEqual([
        'FARM-01 se reconectó tras 1 intento.',
        'FARM-01 se reconectó a la red tras un periodo prolongado sin conexión.',
      ])
    })

    it('en inglés usa el mismo dato', async () => {
      await i18n.changeLanguage('en')
      render(<AvisosTiempoReal />)
      avisar({ intentos_fallidos: 7, duracion_s: 45 })

      expect(screen.getByRole('status')).toHaveTextContent('FARM-01 reconnected after 7 attempts (45 s).')
    })
  })

  /**
   * Ronda 2b (backend `tipo_sse_episodio`): `alerta` es todo episodio abierto
   * distinto del anterior, también la alerta PENDIENTE nueva tras cerrar una
   * ATENDIDA (IA-D18) y el escalamiento preventiva → crítica (IA-D07). Antes
   * llegaban como `episodio_actualizado` y el tablero no avisaba.
   */
  describe('episodios de alerta por SSE', () => {
    // Lo que el backend envía: la lectura más los campos del episodio.
    const evento = (tipo: EventoAlerta['tipo'], episodio: string): EventoAlerta =>
      ({ tipo, device_id: 'FARM-01', temperatura_interna: 9.4, timestamp: '2026-11-14T10:00:00Z', episodio_alerta: episodio }) as EventoAlerta

    function avisosCriticos() {
      return notch.mock.calls.filter(([nivel]) => nivel === 'critico').map(([, opciones]) => (opciones as { detalle: string }).detalle)
    }

    it('una alerta nueva tras una ATENDIDA y un escalamiento interrumpen con el aviso crítico', () => {
      render(<AvisosTiempoReal />)
      act(() => {
        // La ATENDIDA e1 se cerró por la ventana de normalización (recuperación)…
        suscriptores[0].onAlerta?.(evento('recuperacion', 'e1'))
        // …y la excursión siguiente abre otro episodio: alerta nueva, no actualización.
        suscriptores[0].onAlerta?.(evento('alerta', 'e2'))
        // La preventiva e3 escala a crítica: es otro episodio.
        suscriptores[0].onAlerta?.(evento('alerta', 'e3'))
      })
      expect(screen.getAllByRole('alert').map((n) => n.textContent)).toEqual([
        'Nueva alerta térmica en FARM-01.',
        'Nueva alerta térmica en FARM-01.',
      ])
      expect(avisosCriticos()).toEqual(['Nueva alerta térmica en FARM-01.', 'Nueva alerta térmica en FARM-01.'])
      expect(screen.getByRole('status')).toHaveTextContent('FARM-01')
    })

    it('«episodio_actualizado» no interrumpe: ni aviso ni notch', () => {
      render(<AvisosTiempoReal />)
      act(() => {
        suscriptores[0].onAlerta?.(evento('episodio_actualizado', 'e2'))
        suscriptores[0].onAlerta?.(evento('episodio_actualizado', 'e2'))
      })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
      expect(notch).not.toHaveBeenCalled()
    })

    it('el estado en vivo relee las alertas tanto con «alerta» como con «episodio_actualizado»', async () => {
      vi.useFakeTimers()
      const adaptador = instalarAdaptadorFalso((config) => {
        if (config.url === '/api/alertas') return { data: [] }
        return { data: [] }
      })
      try {
        const lecturasAlertas = () => adaptador.peticiones.filter((p) => p.url === '/api/alertas').length
        const { unmount } = renderHook(() => useFuenteEstadoVivo())
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0)
        })
        const oyentes = suscriptores.at(-1)!
        const tras = async (tipo: EventoAlerta['tipo']) => {
          const antes = lecturasAlertas()
          await act(async () => {
            oyentes.onAlerta?.(evento(tipo, 'e2'))
            await vi.advanceTimersByTimeAsync(500)
          })
          return lecturasAlertas() - antes
        }
        // Pendientes y reconocidas: dos páginas por refresco.
        expect(await tras('episodio_actualizado')).toBe(2)
        expect(await tras('alerta')).toBe(2)
        expect(useEstadoVivoStore.getState().alertas).toMatchObject({ total: 0 })
        unmount()
      } finally {
        adaptador.restaurar()
        vi.useRealTimers()
      }
    })
  })
})
