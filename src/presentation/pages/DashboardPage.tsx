import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'

import { useAlertasPendientes, useUltimaAlertaAtendida } from '@/application/hooks/useAlertasPendientes'
import { useEstadoOperativo } from '@/application/hooks/useEstadoOperativo'
import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { umbralSilencioSegundos } from '@/domain/entities/Dispositivo'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { AnuncioRiesgo } from '../components/AnuncioRiesgo'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { TooltipProvider } from '../components/ui/tooltip'
import { CeldaAlertasPendientes } from './dashboard/CeldaAlertasPendientes'
import { CeldaCondiciones } from './dashboard/CeldaCondiciones'
import { CeldaCurva } from './dashboard/CeldaCurva'
import { CeldaEquipo } from './dashboard/CeldaEquipo'
import { CeldaEstadoEquipos, type TemperaturaEquipo } from './dashboard/CeldaEstadoEquipos'
import { CeldaLectura } from './dashboard/CeldaLectura'
import { CeldaLecturasRecientes } from './dashboard/CeldaLecturasRecientes'
import { LineaEstado } from './dashboard/LineaEstado'
import { PanelDetalleEquipo } from './dashboard/PanelDetalleEquipo'
import { PanelSimulador } from './dashboard/PanelSimulador'
import { unirEquipos } from './dashboard/equipos'
import { condicionesLineaEstado } from './dashboard/condicionesLinea'
import { useEquipoSeleccionado } from './dashboard/useEquipoSeleccionado'
import { ROLES_SIMULADOR, resumenVentana } from './dashboard/utilidades'

/** La entrada escalonada del bento ocurre una vez por sesión (MOTION 4.12). */
let bentoYaEntro = false

/**
 * Monitoreo (P5c): un bento de siete celdas con un solo foco, la cifra. La
 * página orquesta datos y selección; cada celda vive en `dashboard/` y se
 * memoriza para que una lectura SSE no repinte lo que no cambió.
 */
export function DashboardPage() {
  const { t } = useTranslation()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const [horasVentana, setHorasVentana] = useState<number>(24)
  const { equipos: equiposConIncidencias, consultar: consultarEstadoOperativo } = useEstadoOperativo()
  // HU-31/HU-33: el dashboard muestra UN refrigerador a la vez. Por defecto,
  // el que reportó más recientemente; con más de uno, se elige en el selector.
  const { equipos } = useEstadoOperativo(true)
  const { deviceId, elegir: setEquipoElegido } = useEquipoSeleccionado(equipos)
  const { ultima, serie, sseConectado, estadoHistorial, reintentar } = useMonitoreoTermico(horasVentana, deviceId)
  const alertas = useAlertasPendientes()
  const ultimaAtendida = useUltimaAlertaAtendida(alertas.estado === 'listo' && alertas.total === 0)
  const ultimasVivo = useEstadoVivoStore((s) => s.ultimas)

  const flota = useMemo(() => unirEquipos(equipos, equiposConIncidencias), [equipos, equiposConIncidencias])
  const estadoIoTPrincipal =
    flota.find((equipo) => equipo.id === deviceId) ?? flota.find((equipo) => equipo.id === (deviceId ?? DISPOSITIVO_DEMO))

  const [animarBento] = useState(() => !bentoYaEntro)
  useEffect(() => {
    bentoYaEntro = true
  }, [])

  // HU-32 criterio 4 / HU-33 criterio 2: si "hace cuánto" solo se recalculara
  // al recibir una lectura nueva, se congelaría hasta la siguiente — este
  // tick lo mantiene avanzando aunque el dato no cambie. Las celdas van en
  // `memo`: solo Lectura y Condiciones dependen del segundo.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const segundosDesdeUltima = ultima ? Math.max(0, Math.floor((ahora - new Date(ultima.timestamp).getTime()) / 1000)) : null
  // HU-33 criterio 2 / B-17: desactualizado al superar el umbral SIN_DATOS del propio nodo.
  const umbralFrescura = umbralSilencioSegundos(estadoIoTPrincipal)
  const datoDesactualizado =
    estadoIoTPrincipal?.estado_operativo === 'SIN_DATOS' || (segundosDesdeUltima != null && segundosDesdeUltima >= umbralFrescura)

  // La ventana termina en «ahora» y avanza sola cada 15 s (no cada segundo).
  const marcaVentana = Math.floor(ahora / 15_000)
  const minuto = Math.floor(ahora / 60_000) * 60_000

  const ventana = t(`dashboard.ventanaFrase.${horasVentana}`)
  const resumen = useMemo(() => resumenVentana(serie), [serie])
  const extremos = useMemo(() => (resumen ? { minima: resumen.minima, maxima: resumen.maxima } : null), [resumen])

  const temperaturas = useMemo(() => {
    const mapa: Record<string, TemperaturaEquipo> = {}
    for (const [id, lectura] of Object.entries(ultimasVivo)) mapa[id] = { valor: lectura.temperatura, riesgo: lectura.riesgo }
    if (ultima && deviceId) mapa[deviceId] = { valor: ultima.temperatura_interna ?? null, riesgo: ultima.riesgo_efectivo ?? ultima.nivel_riesgo }
    return mapa
  }, [ultimasVivo, ultima, deviceId])

  const nombres = useMemo(() => new Map(flota.map((e) => [e.id, e.nombre || e.id])), [flota])

  const condiciones = useMemo(
    () => condicionesLineaEstado({ alertas: { estado: alertas.estado, total: alertas.total, criticas: alertas.criticas }, equipos: flota }),
    [alertas.estado, alertas.total, alertas.criticas, flota],
  )

  const [detalleId, setDetalleId] = useState<string | null>(null)
  const equipoDetalle = detalleId ? (flota.find((e) => e.id === detalleId) ?? null) : null
  const [simuladorAbierto, setSimuladorAbierto] = useState(false)
  const puedeSimular = MODO_DEMO && rol !== undefined && tienePermiso(rol, ROLES_SIMULADOR)
  const puedeGestionar = rol !== undefined && tienePermiso(rol, [])

  // Los paneles se abren sin `Trigger` de Radix: el foco vuelve a mano al control de origen.
  const origenPanel = useRef<HTMLElement | null>(null)
  const recordarOrigen = () => {
    origenPanel.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  const devolverFoco = useCallback((evento: Event) => {
    if (origenPanel.current?.isConnected) {
      evento.preventDefault()
      origenPanel.current.focus()
    }
  }, [])

  const elegir = useCallback((id: string) => setEquipoElegido(id), [setEquipoElegido])
  const verDetalles = useCallback((id: string) => {
    recordarOrigen()
    setDetalleId(id)
  }, [])
  const cerrarDetalle = useCallback(() => setDetalleId(null), [])
  const mostrarDesdePanel = useCallback(
    (id: string) => {
      setEquipoElegido(id)
      setDetalleId(null)
    },
    [setEquipoElegido],
  )

  const actualizarDemo = useCallback(async () => {
    await consultarEstadoOperativo()
    reintentar()
  }, [consultarEstadoOperativo, reintentar])

  return (
    <TooltipProvider delayDuration={300}>
      {/* RF-11 + WCAG 4.1.3: la excursión térmica que llega por SSE se anuncia.
          HU-34: se anuncia el riesgo EFECTIVO, no la clase cruda de la IA. */}
      <AnuncioRiesgo
        nivel={datoDesactualizado ? null : (ultima?.riesgo_efectivo ?? null)}
        temperatura={datoDesactualizado ? null : ultima?.temperatura_interna}
      />

      <PageHeader
        eyebrow={t('nav.seccionOperacion')}
        titulo={t('dashboard.titulo')}
        descripcion={t('dashboard.descripcion')}
        meta={flota.length > 0 ? t('dashboard.encabezadoMeta', { count: flota.length }) : undefined}
      >
        {puedeSimular && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              recordarOrigen()
              setSimuladorAbierto(true)
            }}
            aria-label={t('dashboard.simularEtiqueta')}
            className="max-sm:size-11 max-sm:px-0"
          >
            <FlaskConical aria-hidden className="size-4" />
            <span className="max-sm:sr-only">{t('dashboard.simular')}</span>
          </Button>
        )}
      </PageHeader>

      <LineaEstado
        condiciones={condiciones}
        cargando={alertas.estado === 'cargando'}
        onVerEquipo={verDetalles}
        onReintentar={alertas.reintentar}
      />

      <div
        className={
          'grid grid-cols-4 gap-3 sm:grid-cols-8 lg:grid-cols-12 lg:grid-rows-[minmax(136px,auto)_minmax(136px,auto)_auto_auto] xl:gap-4' +
          (animarBento ? ' bento-entra' : '')
        }
      >
        <CeldaLectura
          ultima={ultima}
          estadoHistorial={estadoHistorial}
          reintentar={reintentar}
          equipos={equipos}
          deviceId={deviceId}
          onElegirEquipo={elegir}
          desactualizado={datoDesactualizado}
          segundosDesdeUltima={segundosDesdeUltima}
          sseConectado={sseConectado}
          extremos={extremos}
          ventana={ventana}
        />
        <CeldaCondiciones
          ultima={ultima}
          serie={serie}
          cargando={estadoHistorial === 'cargando'}
          desactualizado={datoDesactualizado}
          segundosDesdeUltima={segundosDesdeUltima}
          ventana={ventana}
          horasVentana={horasVentana}
        />
        <CeldaEquipo deviceId={deviceId} equipo={estadoIoTPrincipal} ultima={ultima} onVerDetalles={verDetalles} />
        <CeldaCurva
          serie={serie}
          ultimaPresente={ultima !== null}
          estadoHistorial={estadoHistorial}
          reintentar={reintentar}
          horasVentana={horasVentana}
          onCambiarVentana={setHorasVentana}
          marcaVentana={marcaVentana}
          ventana={ventana}
        />
        <CeldaEstadoEquipos
          equipos={flota}
          deviceId={deviceId}
          temperaturas={temperaturas}
          ahora={minuto}
          onElegir={elegir}
          onVerDetalles={verDetalles}
        />
        <CeldaAlertasPendientes
          total={alertas.total}
          criticas={alertas.criticas}
          alertas={alertas.alertas}
          estado={alertas.estado}
          reintentar={alertas.reintentar}
          nombres={nombres}
          ultimaAtendida={ultimaAtendida}
        />
        <CeldaLecturasRecientes serie={serie} cargando={estadoHistorial === 'cargando'} ventana={ventana} />
      </div>

      <PanelDetalleEquipo
        equipo={equipoDetalle}
        ahora={minuto}
        puedeGestionar={puedeGestionar}
        onCerrar={cerrarDetalle}
        onMostrar={mostrarDesdePanel}
        onCloseAutoFocus={devolverFoco}
      />
      {puedeSimular && <PanelSimulador abierto={simuladorAbierto} onAbiertoCambia={setSimuladorAbierto} onActualizado={actualizarDemo} onCloseAutoFocus={devolverFoco} />}
    </TooltipProvider>
  )
}
