import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'

import { useAlertasPendientes, useUltimaAlertaAtendida } from '@/application/hooks/useAlertasPendientes'
import { useEstadoOperativo } from '@/application/hooks/useEstadoOperativo'
import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { useSerieTermica } from '@/application/hooks/useSerieTermica'
import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { inicioCalibracionVencida, umbralSilencioSegundos } from '@/domain/entities/Dispositivo'
import { estadoRiesgoDe } from '@/domain/entities/LecturaTermica'
import { resumenCombinado } from '@/domain/entities/SerieTermica'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { useVencido } from '../hooks/useReloj'
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
  // Contexto de «Alertas pendientes»: sin pendientes es el estado vacío y con
  // menos de 3 completa la lista (misma consulta de lectura que Alertas).
  const ultimaAtendida = useUltimaAlertaAtendida(alertas.estado === 'listo' && alertas.total < 3)
  const ultimasVivo = useEstadoVivoStore((s) => s.ultimas)

  const flota = equipos
  const estadoIoTPrincipal =
    flota.find((equipo) => equipo.id === deviceId) ?? flota.find((equipo) => equipo.id === (deviceId ?? DISPOSITIVO_DEMO))

  const [animarBento] = useState(() => !bentoYaEntro)
  useEffect(() => {
    bentoYaEntro = true
  }, [])

  // HU-32 criterio 4 / HU-33 criterio 2: «hace cuánto» avanza aunque no
  // llegue lectura nueva. El segundo vive en las celdas que lo muestran
  // (Lectura y Condiciones, `useSegundosDesde`); la página solo se repinta
  // cuando el dato cruza el umbral (PERFORMANCE C1).
  // HU-33 criterio 2 / B-17: desactualizado al superar el umbral SIN_DATOS del propio nodo.
  const umbralFrescura = umbralSilencioSegundos(estadoIoTPrincipal)
  const vencido = useVencido(ultima?.timestamp, umbralFrescura)
  const datoDesactualizado = estadoIoTPrincipal?.estado_operativo === 'SIN_DATOS' || (ultima !== null && vencido)

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
    for (const [id, lectura] of Object.entries(ultimasVivo)) mapa[id] = { valor: lectura.temperatura, riesgo: lectura.riesgo }
    if (ultima && deviceId) mapa[deviceId] = { valor: ultima.temperatura_interna ?? null, riesgo: estadoRiesgo }
    return mapa
  }, [ultimasVivo, ultima, deviceId, estadoRiesgo])

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
    recargarSerie()
  }, [consultarEstadoOperativo, reintentar, recargarSerie])

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
        <CeldaEquipo deviceId={deviceId} equipo={estadoIoTPrincipal} ultima={ultima} onVerDetalles={verDetalles} />
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
        <CeldaEstadoEquipos
          equipos={flota}
          deviceId={deviceId}
          temperaturas={temperaturas}
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
