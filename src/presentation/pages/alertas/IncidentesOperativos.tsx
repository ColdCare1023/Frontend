import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, CircleCheck, Hourglass, KeyRound, Link2, ShieldAlert, Thermometer, type LucideIcon } from 'lucide-react'

import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import { fechaHora, haceCuanto } from '@/lib/formato'
import { propsFilaNueva, useIdsNuevos } from '@/presentation/hooks/useIdsNuevos'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Detalles } from '../../components/ui/detalles'
import { Esqueleto } from '../../components/ui/esqueleto'
import { formatearCifra } from '../../components/ui/formato-cifra'
import { ordenarIncidentes } from './logica'

type Tipo = IncidenteOperativo['tipo']

const ICONO_TIPO: Record<Tipo, LucideIcon> = {
  sin_datos: Hourglass,
  monitoreo_suspendido: KeyRound,
  excursion_no_verificada: ShieldAlert,
  sensor_fault: Thermometer,
  colision_clave: Link2,
}

const VISIBLES = 5

/** «Sin datos» va en acero con trama, nunca en carmesí: no es una excursión (HU-54). */
function InsigniaIncidente({ incidente }: { incidente: IncidenteOperativo }) {
  const { t } = useTranslation()
  const texto = t(`alertas.incidenteEstado.${incidente.estado}`)
  const tipo = incidente.tipo ?? 'sin_datos'
  if (incidente.estado !== 'activo') return <Badge dot variant="ok">{texto}</Badge>
  if (tipo === 'sin_datos') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-nodata-100 px-2 py-0.5 text-xs leading-5 font-medium text-nodata-700 ring-1 ring-inset ring-nodata-600/30">
        <span aria-hidden className="trama-sin-datos size-1.5 rounded-full ring-1 ring-nodata-600" />
        {texto}
      </span>
    )
  }
  return (
    <Badge dot variant={tipo === 'excursion_no_verificada' ? 'critical' : 'warn'}>
      {texto}
    </Badge>
  )
}

/**
 * HU-54 / A-3: incidentes operativos (sin datos, monitoreo suspendido,
 * excursión no verificada, falla de sensor, colisión de clave), distintos de
 * las alertas térmicas. En el rail y SIEMPRE visible: con datos, vacío o error.
 */
export function IncidentesOperativos({
  incidentes,
  cargando,
  errorCarga,
  onReintentar,
  ahora,
}: {
  incidentes: readonly IncidenteOperativo[]
  cargando: boolean
  errorCarga: boolean
  onReintentar: () => void
  ahora: number
}) {
  const { t } = useTranslation()
  const equipos = useEstadoVivoStore((s) => s.equipos)
  const [todos, setTodos] = useState(false)
  const ordenados = useMemo(() => ordenarIncidentes(incidentes), [incidentes])
  const activos = ordenados.filter((i) => i.estado === 'activo').length
  const visibles = todos ? ordenados : ordenados.slice(0, VISIBLES)
  const nuevos = useIdsNuevos(
    ordenados.map((i) => i.id),
    !cargando,
  )

  return (
    <section id="incidentes-operativos" aria-labelledby="incidentes-titulo" className="superficie overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="incidentes-titulo" className="text-title text-foreground">
          {t('alertas.incidentesOperativos')}
        </h2>
        {!cargando && !errorCarga && (
          <span className="nums text-meta text-muted">{t('alertas.rail.incidentesActivos', { count: activos })}</span>
        )}
      </header>
      {cargando ? (
        <div role="status" className="divide-y divide-border">
          <span className="sr-only">{t('app.cargando')}</span>
          {[0, 1].map((i) => (
            <div key={i} aria-hidden className="h-16 space-y-2 px-4 py-3">
              <Esqueleto className="h-4 w-1/2" />
              <Esqueleto className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : errorCarga ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-body text-muted">{t('alertas.rail.incidentesError')}</p>
          <Button size="sm" variant="secondary" onClick={onReintentar}>
            {t('comunes.reintentar')}
          </Button>
        </div>
      ) : ordenados.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-3 text-body text-muted">
          <CircleCheck aria-hidden className="size-4 shrink-0 text-success-600" />
          {t('alertas.rail.incidentesVacio')}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {visibles.map((incidente, indice) => {
              const tipo = incidente.tipo ?? 'sin_datos'
              const Icono = ICONO_TIPO[tipo] ?? Hourglass
              const activo = incidente.estado === 'activo'
              return (
                <li key={incidente.id} {...propsFilaNueva(incidente.id, nuevos, indice)}>
                  <details className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                      <Icono aria-hidden className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-medium text-foreground">{t(`alertas.incidenteTipo.${tipo}`)}</span>
                        <span className="block text-meta text-muted">
                          {equipos.find((equipo) => equipo.id === incidente.device_id)?.nombre || incidente.device_id}
                          {activo && <> · {t('alertas.incidenteActivoDesde', { hace: haceCuanto(incidente.detectado_en, ahora) })}</>}
                          {tipo === 'excursion_no_verificada' && incidente.detalle?.temperatura_interna != null && (
                            <> · {t('alertas.incidenteTemperatura', { temperatura: formatearCifra(incidente.detalle.temperatura_interna) })}</>
                          )}
                        </span>
                      </span>
                      <InsigniaIncidente incidente={incidente} />
                      <ChevronDown aria-hidden className="size-4 shrink-0 text-muted group-open:rotate-180" />
                    </summary>
                    <div className="space-y-1 border-t border-border bg-surface-sunken px-4 py-3 text-meta text-muted sm:pl-11">
                      <p className="codigo">{incidente.device_id}</p>
                      <p>{tipo === 'sin_datos'
                        ? t('alertas.incidenteDetectado', { fecha: fechaHora(incidente.detectado_en), segundos: incidente.umbral_silencio_segundos })
                        : t('alertas.incidenteAbierto', { fecha: fechaHora(incidente.detectado_en) })}</p>
                      {incidente.ultimo_reporte_en && <p>{t('alertas.incidenteUltimoReporte', { fecha: fechaHora(incidente.ultimo_reporte_en) })}</p>}
                      {!activo && incidente.recuperado_en && <p>{t('alertas.incidenteRecuperado', { fecha: fechaHora(incidente.recuperado_en) })}</p>}
                      <p>{incidente.notificado_en
                        ? t('alertas.incidenteNotificado', { fecha: fechaHora(incidente.notificado_en) })
                        : t('alertas.incidenteSinAviso')}</p>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
          {ordenados.length > VISIBLES && (
            <div className="border-t border-border px-2 py-1">
              <Button variant="ghost" size="sm" aria-expanded={todos} onClick={() => setTodos((v) => !v)}>
                {todos ? t('alertas.rail.verMenos') : t('alertas.rail.verTodos', { count: ordenados.length })}
              </Button>
            </div>
          )}
        </>
      )}
      <Detalles titulo={t('alertas.rail.queSon')} className="border-t border-border px-4 py-1">
        <p className="max-w-[72ch] pb-2 text-meta text-muted">{t('alertas.incidentesOperativosDetalle')}</p>
      </Detalles>
    </section>
  )
}
