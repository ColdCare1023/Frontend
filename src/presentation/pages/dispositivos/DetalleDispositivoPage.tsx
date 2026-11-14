import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, FlaskConical } from 'lucide-react'

import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { estadoCalibracion, type Dispositivo } from '@/domain/entities/Dispositivo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { BadgeConectividad } from '../../components/BadgeConectividad'
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/EstadoPagina'
import { Button } from '../../components/ui/button'
import { PanelPestana, Pestanas } from '../../components/ui/pestanas'
import { IconoEquipo } from './compartido'
import { useFlota } from './contextoFlota'
import { accionFila, esPestanaEquipo, estadoVisualEquipo, PESTANAS_EQUIPO, type EstadoVisual, type PestanaEquipo } from './estadoEquipo'
import { AccionContextual } from './lista/AccionContextual'
import { PanelSimuladorIoT } from './paneles/PanelSimuladorIoT'
import { TabCalibracion } from './detalle/TabCalibracion'
import { TabConfiguracion } from './detalle/TabConfiguracion'
import { TabHistorial } from './detalle/TabHistorial'
import { TabMonitoreo } from './detalle/TabMonitoreo'
import { TabSeguridad } from './detalle/TabSeguridad'
import { TabUbicacion } from './detalle/TabUbicacion'

const ID_PESTANAS = 'equipo'
/** Dato de la línea meta con su «·» delante (ver el recorte en la cabecera). */
const SEPARADO = "relative pl-4 before:absolute before:top-1/2 before:left-[5px] before:-translate-y-1/2 before:content-['·']"

/**
 * `/dispositivos/:deviceId`: cada acción del antiguo menú de 11 entradas vive
 * en su pestaña (SPEC P5b D1). La pestaña se enlaza con `?tab=` y se escribe
 * con `replace` para que «Atrás» vuelva a la lista.
 */
export function DetalleDispositivoPage() {
  const { t } = useTranslation()
  const { deviceId = '' } = useParams()
  const location = useLocation()
  const [parametros, setParametros] = useSearchParams()
  const { dispositivos, cargando, errorCarga, consultar } = useFlota()
  const ultima = useEstadoVivoStore((s) => s.ultimas[deviceId])
  const dispositivo = dispositivos.find((d) => d.id === deviceId)
  const tabParam = parametros.get('tab')
  const tab: PestanaEquipo = esPestanaEquipo(tabParam) ? tabParam : 'monitoreo'
  const previa = useRef(tab)
  const direccion: 1 | -1 = PESTANAS_EQUIPO.indexOf(tab) >= PESTANAS_EQUIPO.indexOf(previa.current) ? 1 : -1
  const [simulando, setSimulando] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const volverA = (location.state as { desde?: string } | null)?.desde ?? '/dispositivos'

  useEffect(() => {
    previa.current = tab
  }, [tab])

  // Foco al h1 solo al entrar al equipo, no en cada actualización por SSE.
  const existe = Boolean(dispositivo)
  useEffect(() => {
    if (existe) titulo.current?.focus({ preventScroll: true })
  }, [deviceId, existe])

  const cambiarTab = (valor: PestanaEquipo) => {
    setParametros(
      (previos) => {
        const siguientes = new URLSearchParams(previos)
        siguientes.set('tab', valor)
        siguientes.delete('accion')
        return siguientes
      },
      { replace: true, state: location.state },
    )
  }

  const volver = (
    <Link
      to={volverA}
      className="inline-flex min-h-8 w-fit items-center gap-1 text-meta text-muted transition-colors duration-(--duration-micro) hover:text-foreground max-sm:min-h-11"
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      {t('dispositivos.detalle.volver')}
    </Link>
  )

  if (cargando && dispositivos.length === 0) return <EstadoCarga />
  if (errorCarga) {
    return (
      <EstadoError mensaje={t('comunes.errorCargar')}>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>{t('comunes.reintentar')}</Button>
      </EstadoError>
    )
  }
  if (!dispositivo) {
    return (
      <div className="vista-entra-x space-y-3">
        {volver}
        <h1 className="text-page text-foreground">{t('dispositivos.detalle.noEncontradoTitulo', { id: deviceId })}</h1>
        <EstadoVacio ilustracion="sin-equipos" titulo={t('dispositivos.detalle.noEncontradoDetalle')}>
          <Link to="/dispositivos" className="mt-3 inline-flex min-h-11 items-center text-body font-medium text-primary-text hover:underline">
            {t('dispositivos.detalle.volverLista')}
          </Link>
        </EstadoVacio>
      </div>
    )
  }

  const estado = estadoVisualEquipo(dispositivo, ultima)
  const calibracion = estadoCalibracion(dispositivo)
  const accion = accionFila(dispositivo, calibracion)
  const seguridadPendiente = Boolean(dispositivo.broker_pendiente || dispositivo.posesion_pendiente || dispositivo.rotacion_por_compromiso)
  const pestanas = PESTANAS_EQUIPO.map((valor) => ({
    valor,
    etiqueta:
      t(`dispositivos.tabs.${valor}`) +
      ((valor === 'calibracion' && (calibracion === 'vencida' || calibracion === 'proxima_a_vencer')) || (valor === 'seguridad' && seguridadPendiente)
        ? ' •'
        : ''),
  }))

  return (
    <div className="vista-entra-x">
      <header className="mb-3 flex flex-col gap-3 sm:mb-4">
        {volver}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 ref={titulo} tabIndex={-1} className="flex items-center gap-2 text-page text-foreground focus:outline-none">
              <IconoEquipo estado={estado} className="size-5" />
              <span className="codigo">{dispositivo.id}</span>
            </h1>
            {/* Separadores que no quedan colgando al partir la línea: cada «·» va
                delante de su dato y, al empezar una línea nueva, cae fuera del
                recorte del contenedor (desplazado 16 px a la izquierda). */}
            <div className="mt-1 overflow-hidden">
              <p className="-ml-4 flex flex-wrap items-center gap-y-1 text-meta text-faint">
                <span className="pl-4">{[dispositivo.nombre, dispositivo.ubicacion].filter(Boolean).join(' · ') || '—'}</span>
                <span className={SEPARADO}>
                  <BadgeConectividad estado={dispositivo.estado_conectividad} desde={dispositivo.conectividad_cambiada_en} />
                </span>
                {dispositivo.ultimo_reporte_en && (
                  <span className={cn(SEPARADO, 'nums')}>
                    {t('dispositivos.ultimoReporte')}: {fechaHora(dispositivo.ultimo_reporte_en)}
                  </span>
                )}
              </p>
            </div>
            <p className="mt-2 max-w-[68ch] text-body text-subtle">{guia(dispositivo, estado, t)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {MODO_DEMO && (
              <Button variant="secondary" size="sm" onClick={() => setSimulando(dispositivo.id)}>
                <FlaskConical />
                {t('dispositivos.probarIoT')}
              </Button>
            )}
            {accion && <AccionContextual dispositivo={dispositivo} accion={accion} primaria />}
          </div>
        </div>
      </header>

      <div className="sticky top-14 z-20 -mx-4 mb-4 bg-background px-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <Pestanas<PestanaEquipo>
          idBase={ID_PESTANAS}
          etiqueta={t('dispositivos.detalle.secciones')}
          pestanas={pestanas}
          valor={tab}
          onCambiar={cambiarTab}
        />
      </div>

      <PanelPestana idBase={ID_PESTANAS} valor={tab} direccion={direccion}>
        {tab === 'monitoreo' && <TabMonitoreo dispositivo={dispositivo} estado={estado} ultima={ultima} />}
        {tab === 'historial' && <TabHistorial dispositivo={dispositivo} />}
        {tab === 'calibracion' && <TabCalibracion dispositivo={dispositivo} abrirRegistro={parametros.get('accion') === 'registrar'} />}
        {tab === 'ubicacion' && <TabUbicacion dispositivo={dispositivo} />}
        {tab === 'configuracion' && <TabConfiguracion dispositivo={dispositivo} />}
        {tab === 'seguridad' && <TabSeguridad dispositivo={dispositivo} />}
      </PanelPestana>

      {MODO_DEMO && <PanelSimuladorIoT deviceId={simulando} alCerrar={() => setSimulando(null)} />}
    </div>
  )
}

function guia(d: Dispositivo, estado: EstadoVisual, t: (clave: string, opciones?: Record<string, unknown>) => string): string {
  switch (estado) {
    case 'baja':
      return t('dispositivos.detalle.guia.baja', { fecha: d.dado_de_baja_en ? fechaCorta(d.dado_de_baja_en) : '—' })
    case 'sin_datos':
      return t('dispositivos.detalle.guia.sin_datos', {
        hora: d.ultimo_reporte_en ? fechaHora(d.ultimo_reporte_en) : '—',
        n: d.buffer_littlefs?.pendientes ?? 0,
      })
    case 'sin_conexion':
      return t('dispositivos.detalle.guia.sin_conexion', { hora: d.conectividad_cambiada_en ? fechaHora(d.conectividad_cambiada_en) : '—' })
    case 'falla_sensor': {
      const sensor = d.sensores?.find((s) => s.estado === 'error')?.modelo ?? 'DS18B20'
      return t('dispositivos.detalle.guia.falla_sensor', { sensor })
    }
    case 'normal':
      return t('dispositivos.detalle.guia.normal', { s: d.intervalo_reporte_segundos ?? 30 })
    default:
      return t(`dispositivos.detalle.guia.${estado}`)
  }
}
