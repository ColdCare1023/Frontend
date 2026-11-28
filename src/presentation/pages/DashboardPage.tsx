import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, Refrigerator, SlidersHorizontal } from 'lucide-react'

import { useAlertasPendientes } from '@/application/hooks/useAlertasPendientes'
import { useEstadoOperativo } from '@/application/hooks/useEstadoOperativo'
import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { useSerieTermica } from '@/application/hooks/useSerieTermica'
import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { inicioCalibracionVencida, umbralSilencioSegundos } from '@/domain/entities/Dispositivo'
import { estadoRiesgoDe } from '@/domain/entities/LecturaTermica'
import { resumenCombinado } from '@/domain/entities/SerieTermica'
import { cn } from '@/lib/utils'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useVencido } from '../hooks/useReloj'
import { AnuncioRiesgo } from '../components/AnuncioRiesgo'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { TooltipProvider } from '../components/ui/tooltip'
import { BandejaAlertasOperativa } from './dashboard/BandejaAlertasOperativa'
import { ConsultasFarmacia } from './dashboard/ConsultasFarmacia'
import { CeldaCondiciones } from './dashboard/CeldaCondiciones'
import { CeldaCurva } from './dashboard/CeldaCurva'
import { CeldaEquipo } from './dashboard/CeldaEquipo'
import { CeldaEstadoEquipos, type TemperaturaEquipo } from './dashboard/CeldaEstadoEquipos'
import { CeldaLectura } from './dashboard/CeldaLectura'
import { CeldaLecturasRecientes } from './dashboard/CeldaLecturasRecientes'
import { LineaEstado } from './dashboard/LineaEstado'
import { PanelDetalleEquipo } from './dashboard/PanelDetalleEquipo'
import { PanelSimulador } from './dashboard/PanelSimulador'
import { condicionesLineaEstado } from './dashboard/condicionesLinea'
import { useEquipoSeleccionado } from './dashboard/useEquipoSeleccionado'
import { ROLES_SIMULADOR, resumenVentana } from './dashboard/utilidades'

export function DashboardPage() {
  const { t } = useTranslation()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const [horasVentana, setHorasVentana] = useState<number>(24)
  // HU-31/HU-33: el dashboard muestra UN refrigerador a la vez. Por defecto,
  // el que reportó más recientemente; con más de uno, se elige en el selector.
  // Un solo sondeo con `todos=true`: el backend devuelve los mismos datos por
  // equipo que sin el parámetro, solo que incluye también los operativos.
  const { equipos, consultar: consultarEstadoOperativo } = useEstadoOperativo(true)
  const { deviceId, elegir: setEquipoElegido } = useEquipoSeleccionado(equipos)
  const { ultima, serie, sseConectado, motivoDesconexion = null, estadoHistorial, reintentar, cobertura = null, puertaEnVivo = null } = useMonitoreoTermico(horasVentana, deviceId)
  // HU-31: la curva y el resumen de 24 h y 7 d cubren el periodo completo.
  const { serie: agregada, recargar: recargarSerie } = useSerieTermica(deviceId, horasVentana)
  const alertas = useAlertasPendientes()
  const ultimasVivo = useEstadoVivoStore((s) => s.ultimas)

  const flota = equipos
  const estadoIoTPrincipal =
    flota.find((equipo) => equipo.id === deviceId) ?? flota.find((equipo) => equipo.id === (deviceId ?? DISPOSITIVO_DEMO))

  // HU-32 criterio 4 / HU-33 criterio 2: «hace cuánto» avanza aunque no
  // llegue lectura nueva. El segundo vive en las celdas que lo muestran
  // (Lectura y Condiciones, `useSegundosDesde`); la página solo se repinta
  // cuando el dato cruza el umbral (PERFORMANCE C1).
  // HU-33 criterio 2 / B-17: desactualizado al superar el umbral SIN_DATOS del propio nodo.
  const umbralFrescura = umbralSilencioSegundos(estadoIoTPrincipal)
  const vencido = useVencido(ultima?.timestamp, umbralFrescura)
  const datoDesactualizado =
    estadoIoTPrincipal?.estado_operativo === 'SIN_DATOS' ||
    estadoIoTPrincipal?.estado_operativo === 'MONITOREO_SUSPENDIDO' ||
    estadoIoTPrincipal?.estado_conectividad === 'offline' ||
    (ultima !== null && vencido)

  const ventana = t(`dashboard.ventanaFrase.${horasVentana}`)
  const resumen = useMemo(() => (agregada ? resumenCombinado(agregada, serie) : resumenVentana(serie)), [agregada, serie])
  // HU-31: el historial crudo (lista, aperturas) no cubre la ventana.
  const recorte =
    cobertura && cobertura.total !== null && cobertura.total > cobertura.recibidas
      ? { mostradas: cobertura.recibidas, total: cobertura.total }
      : null
  const estadoRiesgo = estadoRiesgoDe(ultima)
  const extremos = useMemo(() => (resumen ? { minima: resumen.minima, maxima: resumen.maxima } : null), [resumen])

  const temperaturas = useMemo(() => {
    const mapa: Record<string, TemperaturaEquipo> = {}
    for (const [id, lectura] of Object.entries(ultimasVivo)) mapa[id] = { valor: lectura.temperatura, riesgo: lectura.riesgo, timestamp: lectura.timestamp }
    if (ultima && deviceId) mapa[deviceId] = { valor: ultima.temperatura_interna ?? null, riesgo: estadoRiesgo, timestamp: ultima.timestamp }
    return mapa
  }, [ultimasVivo, ultima, deviceId, estadoRiesgo])

  const nombres = useMemo(() => new Map(flota.map((e) => [e.id, e.nombre || e.id])), [flota])

  const condiciones = useMemo(
    () => condicionesLineaEstado({ alertas: { estado: alertas.estado, total: alertas.total, criticas: alertas.criticas }, equipos: flota }),
    [alertas.estado, alertas.total, alertas.criticas, flota],
  )
  // Con alertas pendientes, la bandeja (con «Atender») ocupa el lugar de la
  // línea de estado: antes la misma cuenta salía en la línea y en la bandeja.
  const hayAlertas = alertas.estado === 'listo' && alertas.alertas.length > 0

  const [detalleId, setDetalleId] = useState<string | null>(null)
  const equipoDetalle = detalleId ? (flota.find((e) => e.id === detalleId) ?? null) : null
  const [simuladorAbierto, setSimuladorAbierto] = useState(false)
  const puedeSimular = MODO_DEMO && rol !== undefined && tienePermiso(rol, ROLES_SIMULADOR)
  const puedeGestionar = rol !== undefined && tienePermiso(rol, [])
  // HU-30: el QF registra la calibración y el margen (el backend lo autoriza).
  const puedeCalibrar = rol !== undefined && tienePermiso(rol, ['farmaceutico'])
  // HU-30 esc. 3: la curva del equipo en pantalla marca el tramo con certificado
  // vencido. Primitivos: el sondeo de 15 s no debe reconstruir la curva.
  const calibracionVencidaDesde = estadoIoTPrincipal ? inicioCalibracionVencida(estadoIoTPrincipal) : null
  const vencimientoCalibracion = estadoIoTPrincipal?.fecha_proxima_calibracion ?? null

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
  const mostrarLectura = useCallback((id: string) => {
    setEquipoElegido(id)
    const destino = document.getElementById('equipo-monitoreado')
    destino?.focus()
    return destino
  }, [setEquipoElegido])
  const mostrarDesdePanel = useCallback(
    (id: string) => {
      origenPanel.current = mostrarLectura(id)
      setDetalleId(null)
    },
    [mostrarLectura],
  )

  const actualizarDemo = useCallback(async () => {
    await consultarEstadoOperativo()
    reintentar()
    recargarSerie()
  }, [consultarEstadoOperativo, reintentar, recargarSerie])

  const haySerie = serie.length > 0 || Boolean(agregada?.buckets.length)
  const curva = (
    <CeldaCurva
      serie={serie}
      ultimaPresente={ultima !== null}
      estadoHistorial={estadoHistorial}
      reintentar={reintentar}
      horasVentana={horasVentana}
      onCambiarVentana={setHorasVentana}
      ventana={ventana}
      agregada={agregada}
      resumen={resumen}
      cobertura={cobertura}
      calibracionVencidaDesde={calibracionVencidaDesde}
      vencimientoCalibracion={vencimientoCalibracion}
    />
  )

  return (
    <TooltipProvider delayDuration={300}>
      {/* RF-11 + WCAG 4.1.3: la excursión térmica que llega por SSE se anuncia.
          HU-34: se anuncia el estado de riesgo (sin clasificación IA no es
          Normal), no la clase cruda de la IA. */}
      <AnuncioRiesgo
        nivel={datoDesactualizado ? null : estadoRiesgo}
        temperatura={datoDesactualizado ? null : ultima?.temperatura_interna}
      />

      <PageHeader
        eyebrow={t('nav.seccionOperacion')}
        titulo={t('dashboard.titulo')}
      >
        <ConsultasFarmacia equipoId={deviceId} />
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

      {!hayAlertas && (
        <LineaEstado
          condiciones={condiciones}
          cargando={alertas.estado === 'cargando'}
          onVerEquipo={verDetalles}
          onReintentar={alertas.reintentar}
        />
      )}
      {/* Siempre montada: al atender la última alerta su panel sigue abierto
          con la cronología, aunque la bandeja ya no se muestre. */}
      <div
        id="alertas-monitoreo"
        tabIndex={-1}
        className={cn(
          'mb-3 min-w-0 scroll-mt-20 rounded-(--radius-card) border bg-surface px-4 py-3 focus:outline-none sm:px-5 xl:mb-4',
          alertas.criticas > 0 ? 'border-critical/40' : 'border-warning-200',
          !hayAlertas && 'hidden',
        )}
      >
        <BandejaAlertasOperativa bandeja={alertas} nombres={nombres} />
      </div>

      <div className="hoja-monitoreo">
        <div id="equipo-monitoreado" tabIndex={-1} className="flex min-w-0 scroll-mt-20 flex-wrap items-center gap-2 border-b border-border px-4 py-2 focus:outline-none sm:px-6">
          <Refrigerator aria-hidden className="size-4 shrink-0 text-muted" />
          {equipos.length > 1 ? (
            <select aria-label={t('dashboard.equipo')} value={deviceId ?? ''} onChange={(event) => elegir(event.target.value)}
              className="min-h-10 min-w-0 max-w-full flex-1 cursor-pointer truncate bg-transparent pr-3 text-body font-semibold focus-visible:outline-ring sm:flex-none">
              {equipos.map((equipo) => {
                const repetido = equipo.nombre && equipos.some((otro) => otro.id !== equipo.id && otro.nombre === equipo.nombre)
                return <option key={equipo.id} value={equipo.id}>{repetido ? `${equipo.nombre} (${equipo.id})` : equipo.nombre || equipo.id}</option>
              })}
            </select>
          ) : <span className="min-w-0 flex-1 break-all text-body font-semibold">{estadoIoTPrincipal?.nombre || deviceId || t('dashboard.equipo')}</span>}
          {estadoIoTPrincipal && <Button variant="ghost" size="sm" className="ml-auto max-sm:size-11 max-sm:px-0" onClick={() => verDetalles(estadoIoTPrincipal.id)}>
            <SlidersHorizontal aria-hidden className="size-4" /> <span className="max-sm:sr-only">{t('dashboard.ficha')}</span>
          </Button>}
        </div>
        <div className={cn("grid min-w-0", haySerie && "lg:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.5fr)]")}>
          <div className={cn(
            'min-w-0 border-b border-border px-4 py-5 sm:px-6',
            haySerie ? 'space-y-5 lg:border-r lg:border-b-0' : 'grid items-start gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]',
          )}>
            <CeldaLectura
              ultima={ultima}
              estadoHistorial={estadoHistorial}
              reintentar={reintentar}
              deviceId={deviceId}
              desactualizado={datoDesactualizado}
              sseConectado={sseConectado}
              motivoDesconexion={motivoDesconexion}
              extremos={extremos}
              ventana={ventana}
            />
            <CeldaCondiciones
              ultima={ultima}
              serie={serie}
              cargando={estadoHistorial === 'cargando'}
              desactualizado={datoDesactualizado}
              ventana={ventana}
              horasVentana={horasVentana}
              umbralPuertaEquipo={estadoIoTPrincipal?.umbral_puerta_abierta_segundos ?? null}
              recorte={recorte}
              puertaEnVivo={puertaEnVivo && (!ultima || puertaEnVivo.device_id === ultima.device_id) ? puertaEnVivo : null}
            />
          </div>
          <div className="min-w-0 px-4 py-5 sm:px-6">{curva}</div>
        </div>
        {/* Lo secundario, a un clic: lecturas recientes y diagnóstico de equipos. */}
        <div className="border-t border-border px-3 py-1 sm:px-5">
          <SeccionDetalle titulo={t('dashboard.masDetalles')} className="border-0">
            <CeldaLecturasRecientes serie={serie} cargando={estadoHistorial === 'cargando'} ventana={ventana} />
            <div className="space-y-3 border-t border-border pt-3">
              <CeldaEstadoEquipos equipos={flota} deviceId={deviceId} temperaturas={temperaturas} onElegir={mostrarLectura} onVerDetalles={verDetalles} />
              <CeldaEquipo deviceId={deviceId} equipo={estadoIoTPrincipal} ultima={ultima} onVerDetalles={verDetalles} />
            </div>
          </SeccionDetalle>
        </div>
      </div>

      <PanelDetalleEquipo
        equipo={equipoDetalle}
        puedeGestionar={puedeGestionar}
        puedeCalibrar={puedeCalibrar}
        onCalibracionRegistrada={consultarEstadoOperativo}
        onCerrar={cerrarDetalle}
        onMostrar={mostrarDesdePanel}
        onCloseAutoFocus={devolverFoco}
      />
      {puedeSimular && <PanelSimulador abierto={simuladorAbierto} onAbiertoCambia={setSimuladorAbierto} onActualizado={actualizarDemo} onCloseAutoFocus={devolverFoco} />}
    </TooltipProvider>
  )
}
