import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CircleCheck, Hourglass, KeyRound, Link2, OctagonAlert, ShieldAlert, Thermometer, TriangleAlert, type LucideIcon } from 'lucide-react'

import type { IncidenteOperativo } from '@/domain/entities/Dispositivo'
import { duracionLegible, fechaHora, haceCuanto } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Esqueleto } from '../../components/ui/esqueleto'
import { formatearTemperatura } from '../../components/ui/formato-cifra'
import type { EventoEquipo } from './actividad'

const ICONO_INCIDENTE: Record<IncidenteOperativo['tipo'], LucideIcon> = {
  sin_datos: Hourglass,
  monitoreo_suspendido: KeyRound,
  excursion_no_verificada: ShieldAlert,
  sensor_fault: Thermometer,
  colision_clave: Link2,
}

function Icono({ evento }: { evento: EventoEquipo }) {
  const clase = 'mt-0.5 size-4 shrink-0'
  if (evento.tipo === 'critica') return <OctagonAlert aria-hidden className={cn(clase, 'text-critical')} />
  if (evento.tipo === 'preventiva') return <TriangleAlert aria-hidden className={cn(clase, 'text-warning-700')} />
  if (evento.tipo === 'recuperado') return <CircleCheck aria-hidden className={cn(clase, 'text-success-700')} />
  const Tipo = ICONO_INCIDENTE[evento.incidente?.tipo ?? 'sin_datos'] ?? Hourglass
  return <Tipo aria-hidden className={cn(clase, 'text-nodata-700')} />
}

/**
 * Actividad reciente (alertas e incidentes) en una línea de tiempo compacta.
 * En la lista llena el hueco bajo pocas filas con lo que de verdad pasó en la
 * flota; en el detalle, con lo del equipo. Sin datos nuevos: sale de lo que
 * el layout de Dispositivos ya cargó.
 */
export function ActividadReciente({
  id,
  titulo,
  eventos,
  cargando,
  error,
  ahora,
  conEquipo = true,
  accion,
  desplazable = false,
  pie,
  className,
}: {
  id: string
  titulo: string
  eventos: readonly EventoEquipo[]
  cargando: boolean
  error: boolean
  ahora: number
  /** Muestra el código del equipo en cada evento (vista de flota). */
  conEquipo?: boolean
  accion?: ReactNode
  /**
   * La lista se desplaza dentro de una altura fija que le da el padre (a la
   * par de la curva en el detalle); entonces es enfocable para el teclado.
   */
  desplazable?: boolean
  /** Línea final bajo la lista (p. ej. «Sin más actividad en 7 días»). */
  pie?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const idTitulo = `${id}-titulo`
  const masAbajo = useHayMasAbajo(desplazable, eventos.length)

  let cuerpo: ReactNode
  if (cargando && eventos.length === 0) {
    cuerpo = (
      <div role="status" className="space-y-2 px-4 py-3">
        <span className="sr-only">{t('app.cargando')}</span>
        <Esqueleto className="h-10" />
        <Esqueleto className="h-10" />
      </div>
    )
  } else if (error && eventos.length === 0) {
    cuerpo = <p className="px-4 py-3 text-body text-muted">{t('dispositivos.actividad.error')}</p>
  } else if (eventos.length === 0) {
    cuerpo = (
      <p className="flex items-center gap-2 px-4 py-3 text-body text-muted">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-success-700" />
        {t('dispositivos.actividad.vacio')}
      </p>
    )
  } else {
    cuerpo = (
      <ol
        ref={masAbajo.ref}
        className={cn(
          'divide-y divide-border',
          desplazable && 'min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          // Una fila cortada sin pista no dice que la lista sigue: el borde
          // inferior se funde mientras quede contenido por debajo.
          masAbajo.activo && '[mask-image:linear-gradient(to_bottom,#000_calc(100%-32px),transparent)]',
        )}
        {...(desplazable ? { tabIndex: 0, 'aria-labelledby': idTitulo } : {})}
      >
        {eventos.map((evento) => (
          <li key={evento.id} className="flex items-start gap-3 px-4 py-2.5">
            <Icono evento={evento} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-body">
                {conEquipo && (
                  <Link
                    to={`/dispositivos/${encodeURIComponent(evento.deviceId)}`}
                    className="codigo font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {evento.deviceId}
                  </Link>
                )}
                <span className="min-w-0 text-foreground">{titular(evento, t)}</span>
              </p>
              <p className="mt-0.5 nums text-meta text-faint">{detalle(evento, t, ahora)}</p>
            </div>
            <time
              dateTime={new Date(evento.ms).toISOString()}
              title={fechaHora(new Date(evento.ms).toISOString())}
              className="nums shrink-0 pt-0.5 text-meta text-faint"
            >
              {haceCuanto(new Date(evento.ms).toISOString(), ahora)}
            </time>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <section aria-labelledby={idTitulo} className={cn('superficie min-w-0 overflow-hidden', desplazable && 'flex flex-col', className)}>
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border py-1.5 pr-2 pl-4">
        <h2 id={idTitulo} className="text-title text-foreground">
          {titulo}
        </h2>
        {accion}
      </header>
      {cuerpo}
      {pie && <div className="shrink-0 border-t border-border px-4 py-2.5 text-meta text-faint">{pie}</div>}
    </section>
  )
}

/** ¿La lista desplazable tiene contenido por debajo del borde visible? */
function useHayMasAbajo(activo: boolean, filas: number) {
  const ref = useRef<HTMLOListElement>(null)
  const [hayMas, setHayMas] = useState(false)
  useEffect(() => {
    const lista = ref.current
    if (!activo || !lista) return
    const medir = () => setHayMas(lista.scrollHeight - lista.clientHeight - lista.scrollTop > 2)
    medir()
    lista.addEventListener('scroll', medir, { passive: true })
    if (typeof ResizeObserver === 'undefined') return () => lista.removeEventListener('scroll', medir)
    const observador = new ResizeObserver(medir)
    observador.observe(lista)
    return () => {
      lista.removeEventListener('scroll', medir)
      observador.disconnect()
    }
  }, [activo, filas])
  return { ref, activo: activo && hayMas }
}

type T = (clave: string, opciones?: Record<string, unknown>) => string

function titular(evento: EventoEquipo, t: T): string {
  if (evento.alerta) {
    const pico = evento.alerta.temperatura_pico
    const riesgo = t(`riesgo.${evento.alerta.nivel_riesgo}`)
    return pico != null ? `${riesgo} · ${formatearTemperatura(pico)}` : riesgo
  }
  const tipo = t(`alertas.incidenteTipo.${evento.incidente?.tipo ?? 'sin_datos'}`)
  return evento.tipo === 'recuperado' ? t('dispositivos.actividad.recuperado', { tipo }) : tipo
}

function detalle(evento: EventoEquipo, t: T, ahora: number): string {
  if (evento.alerta) {
    const partes = [t(`alertas.estadoAlerta.${evento.alerta.estado}`)]
    if (evento.alerta.duracion_s != null) partes.push(t('dispositivos.actividad.duracion', { duracion: duracionLegible(evento.alerta.duracion_s) }))
    return partes.join(' · ')
  }
  const incidente = evento.incidente
  if (!incidente) return ''
  if (evento.tipo === 'incidente') return t('alertas.incidenteActivoDesde', { hace: haceCuanto(incidente.detectado_en, ahora) })
  const inicio = Date.parse(incidente.detectado_en)
  const fin = Date.parse(incidente.recuperado_en ?? '')
  return Number.isFinite(inicio) && Number.isFinite(fin) && fin > inicio
    ? t('dispositivos.actividad.duracion', { duracion: duracionLegible((fin - inicio) / 1000) })
    : t('alertas.incidenteEstado.resuelto')
}
