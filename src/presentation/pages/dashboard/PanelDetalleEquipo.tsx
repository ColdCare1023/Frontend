import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

import { brechasRecientes, CAPACIDAD_BUFFER_LITTLEFS, estadoCalibracion, umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import { tramosDisponibilidad } from '@/domain/value-objects/Disponibilidad'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { BadgeConectividad } from '../../components/BadgeConectividad'
import { Button } from '../../components/ui/button'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../components/ui/side-panel'
import { claveBrecha, textoRangoBuffer, textosBrecha } from './bufferNodo'
import { AnilloBuffer, EstadoCalibracionCorto } from './CeldaEquipo'
import { BadgeEstadoOperativo } from './CeldaEstadoEquipos'
import { CintaDisponibilidad } from './CintaDisponibilidad'
import { useMinuto } from '../../hooks/useReloj'

/** Brechas por buffer agotado que caben en el panel (las más recientes). */
const BRECHAS_EN_PANEL = 3

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <h3 className="eyebrow mb-2">{titulo}</h3>
      <div className="space-y-1.5 text-body text-muted">{children}</div>
    </section>
  )
}

/**
 * Ficha del equipo (Cult UI Side Panel), de solo lectura para todos los
 * roles: estado, conexión, buffer, calibración, incidentes y ficha técnica.
 * Nada se pierde respecto del «Ver detalles» anterior.
 */
export function PanelDetalleEquipo({
  equipo,
  puedeGestionar,
  onCerrar,
  onMostrar,
  onCloseAutoFocus,
}: {
  onCloseAutoFocus?: (evento: Event) => void
  equipo: Dispositivo | null
  puedeGestionar: boolean
  onCerrar: () => void
  onMostrar: (id: string) => void
}) {
  const { t } = useTranslation()
  const ahora = useMinuto()
  const tramos = useMemo(() => (equipo ? tramosDisponibilidad(equipo, ahora) : []), [equipo, ahora])

  return (
    <SidePanel open={equipo !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      {equipo && (
        <SidePanelContent onCloseAutoFocus={onCloseAutoFocus}>
          <SidePanelHeader>
            <SidePanelTitle>
              {equipo.nombre || equipo.id} {equipo.nombre && <span className="codigo text-meta font-normal text-faint">{equipo.id}</span>}
            </SidePanelTitle>
            <SidePanelDescription>{t('dashboard.detalleEquipoDescripcion')}</SidePanelDescription>
          </SidePanelHeader>
          {/* Enfocable: con contenido solo de lectura, el teclado también debe poder desplazarlo. */}
          <SidePanelBody tabIndex={0} className="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
            <DetalleEquipo equipo={equipo} tramos={tramos} />
          </SidePanelBody>
          <SidePanelFooter>
            {puedeGestionar && (
              <Link
                to="/dispositivos"
                className="mr-auto inline-flex min-h-10 items-center gap-1 text-body font-medium text-primary-text hover:underline"
              >
                {t('dashboard.gestionarEnDispositivos')}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            )}
            <Button variant="primary" size="sm" onClick={() => onMostrar(equipo.id)}>
              {t('dashboard.mostrarEnMonitoreo', { equipo: equipo.nombre || equipo.id })}
            </Button>
          </SidePanelFooter>
        </SidePanelContent>
      )}
    </SidePanel>
  )
}

function DetalleEquipo({ equipo, tramos }: { equipo: Dispositivo; tramos: ReturnType<typeof tramosDisponibilidad> }) {
  const { t } = useTranslation()
  const buffer = equipo.buffer_littlefs
  const limite = buffer?.limite ?? CAPACIDAD_BUFFER_LITTLEFS
  const pendientes = buffer?.pendientes ?? 0
  const rango = textoRangoBuffer(buffer, t)
  const brechas = brechasRecientes(buffer, BRECHAS_EN_PANEL)
  const incidentes = equipo.incidencias_operativas ?? []
  const silencio = incidentes.find((i) => i.estado === 'activo' && i.tipo === 'sin_datos')
  const excursion = incidentes.find((i) => i.estado === 'activo' && i.tipo === 'excursion_no_verificada')
  const resueltos = incidentes.filter((i) => i.estado === 'resuelto')
  const calibracion = estadoCalibracion(equipo)
  const segundosSilencio = umbralSilencioSegundos(equipo)

  return (
    <div>
      <Seccion titulo={t('dashboard.seccionEstado')}>
        <BadgeEstadoOperativo equipo={equipo} />
        {excursion && (
          <p role="alert" className="font-semibold text-danger-700">
            {t('dashboard.excursionNoVerificada', {
              temperatura: excursion.detalle?.temperatura_interna?.toFixed(2) ?? '—',
              fecha: fechaHora(excursion.detalle?.captured_at ?? excursion.detectado_en),
            })}
          </p>
        )}
        {silencio && (
          <p className="font-medium text-warning-700">
            {t('dashboard.alertaSilencio', { fecha: fechaHora(silencio.detectado_en), segundos: silencio.umbral_silencio_segundos })}
          </p>
        )}
        {equipo.estado_operativo === 'SIN_DATOS' && (
          <p>{equipo.ultimo_reporte_en ? t('dashboard.ultimoDatoOperativo', { fecha: fechaHora(equipo.ultimo_reporte_en) }) : t('dashboard.nuncaReporto')}</p>
        )}
        {equipo.estado_operativo === 'MONITOREO_SUSPENDIDO' && <p>{t('dispositivos.telemetriaRetenidaAyuda')}</p>}
      </Seccion>

      <Seccion titulo={t('dashboard.seccionConexion')}>
        <BadgeConectividad estado={equipo.estado_conectividad} desde={equipo.conectividad_cambiada_en} />
        <p className="nums">
          {t('dispositivos.ultimoReporte')}: {equipo.ultimo_reporte_en ? fechaHora(equipo.ultimo_reporte_en) : '—'}
        </p>
      </Seccion>

      <Seccion titulo={t('dashboard.bufferTitulo')}>
        {buffer ? (
          <>
            <div className="flex items-center gap-3">
              <AnilloBuffer
                pendientes={pendientes}
                limite={limite}
                perdidas={buffer.perdidas ?? 0}
                tamano={64}
                etiqueta={t('dashboard.bufferAnillo', { n: pendientes.toLocaleString(), max: limite.toLocaleString() })}
              />
              <div className="space-y-1">
                <p className="nums text-foreground">{t('dispositivos.bufferLittlefs', { n: pendientes, max: limite })}</p>
                {rango && <p className="nums" data-testid="panel-buffer-rango">{rango}</p>}
                <p className={buffer.perdidas > 0 ? 'font-semibold text-warning-700' : undefined}>{t('dispositivos.perdidas', { n: buffer.perdidas ?? 0 })}</p>
                {(buffer.cuarentena ?? 0) > 0 && <p className="nums">{t('dashboard.bufferCuarentena', { n: buffer.cuarentena })}</p>}
              </div>
            </div>
            {pendientes === 0 && buffer.ultima_sincronizacion_en && (
              <p className="text-success-700">{t('dashboard.sinPendientes', { fecha: fechaHora(buffer.ultima_sincronizacion_en) })}</p>
            )}
            {buffer.reportado_en && <p className="nums text-meta text-faint">{t('dashboard.bufferReportado', { fecha: fechaHora(buffer.reportado_en) })}</p>}
            {/* HU-48 esc. 2: las brechas más recientes primero, con su periodo (o su secuencia si el nodo no tenía hora). */}
            {brechas.length > 0 && (
              <ul className="space-y-1" aria-label={t('dashboard.brechasBufferTitulo')}>
                {brechas.map((brecha, indice) => {
                  const { resumen, periodo } = textosBrecha(brecha, t)
                  return (
                    <li key={claveBrecha(brecha, indice)} className="rounded-(--radius-field) bg-critical-tint px-2 py-1 text-danger-700">
                      {resumen}
                      <span className="block">{periodo}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : (
          <p>—</p>
        )}
      </Seccion>

      <Seccion titulo={t('dashboard.calibracionTitulo')}>
        <EstadoCalibracionCorto equipo={equipo} />
        {(calibracion === 'vencida' || calibracion === 'proxima_a_vencer') && (
          <p className="text-warning-700">
            {t(calibracion === 'vencida' ? 'dashboard.calibracionVencida' : 'dashboard.calibracionPorVencer', {
              fecha: fechaCorta(equipo.fecha_proxima_calibracion),
            })}
          </p>
        )}
        {equipo.numero_certificado_calibracion && (
          <p className="codigo">
            {t('dispositivos.numeroCertificado')}: {equipo.numero_certificado_calibracion}
          </p>
        )}
      </Seccion>

      <Seccion titulo={t('dashboard.seccionIncidentes')}>
        <CintaDisponibilidad tramos={tramos} equipo={equipo.nombre || equipo.id} className="h-6" />
        {resueltos.length > 0 ? (
          <ul className="space-y-1">
            {resueltos.slice(-3).map((incidente) => (
              <li key={incidente.id}>{t('dashboard.incidenteRecuperado', { fecha: fechaHora(incidente.recuperado_en) })}</li>
            ))}
          </ul>
        ) : (
          <p>{t('dashboard.sinIncidentes7d')}</p>
        )}
      </Seccion>

      <Seccion titulo={t('dashboard.seccionFicha')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-meta">
          <div>
            <dt className="text-faint">{t('dispositivos.fallasSensor')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{(equipo.sensores ?? []).filter((s) => s.estado === 'error').length}</dd>
          </div>
          <div>
            <dt className="text-faint">{t('dispositivos.intervaloReporte')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{equipo.intervalo_reporte_segundos ?? 30} s</dd>
          </div>
          <div>
            <dt className="text-faint">{t('dispositivos.umbralSinDatos')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{segundosSilencio} s</dd>
          </div>
          <div>
            <dt className="text-faint">{t('dispositivos.firmware')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{equipo.firmware_version || '—'}</dd>
          </div>
          <div>
            <dt className="text-faint">{t('dispositivos.credencialEstado')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{t(`dispositivos.credencial.${equipo.estado_credencial_broker ?? 'sin_reportar'}`)}</dd>
          </div>
          {buffer?.desde && (
            <div>
              <dt className="text-faint">{t('dispositivos.ventanaCola')}</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {t('dispositivos.rangoBuffer', { desde: fechaHora(buffer.desde), hasta: buffer.hasta ? fechaHora(buffer.hasta) : '—' })}
              </dd>
            </div>
          )}
        </dl>
      </Seccion>
    </div>
  )
}
