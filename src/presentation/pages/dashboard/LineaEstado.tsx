import { memo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarClock, CircleCheck, Hourglass, OctagonAlert, TriangleAlert } from 'lucide-react'

import { fechaCorta, hora } from '@/lib/formato'
import { clsx } from 'clsx'
import type { CondicionLinea } from './condicionesLinea'

// Por debajo de 640 px la frase puede ocupar 2 líneas (min. 44 px, nunca
// menos): truncada a una sola perdía justo la parte que importa.
const BASE =
  'mb-3 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-(--radius-card) border px-4 text-left text-body max-sm:py-2 sm:h-11 xl:mb-4 animate-(--animate-fade)'
const ENFOQUE = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function useFrase() {
  const { t } = useTranslation()
  return (c: CondicionLinea): string => {
    switch (c.tipo) {
      case 'criticas':
        return `${t('dashboard.alertasSinAtender', { count: c.total })} · ${t('dashboard.alertasCriticas', { count: c.criticas })}`
      case 'pendientes':
        return t('dashboard.alertasSinAtender', { count: c.total })
      case 'sin_datos': {
        if (c.equipos.length > 1) return t('dashboard.lineaEstado.equiposSinDatos', { count: c.equipos.length, total: c.total })
        const [equipo] = c.equipos
        return t('dashboard.lineaEstado.equipoSinDatos', {
          equipo: equipo.nombre || equipo.id,
          hora: equipo.ultimo_reporte_en ? hora(equipo.ultimo_reporte_en) : '—',
        })
      }
      case 'falla':
        return t('dashboard.lineaEstado.equipoFalla', { equipo: c.equipo.nombre || c.equipo.id })
      case 'calibracion_vencida':
        return `${t('dashboard.lineaEstado.calibracionVencida', { equipo: c.equipo.nombre || c.equipo.id })} · ${fechaCorta(c.equipo.fecha_proxima_calibracion)}`
      case 'calibracion_por_vencer':
        return `${t('dashboard.lineaEstado.calibracionPorVencer', { equipo: c.equipo.nombre || c.equipo.id })} · ${fechaCorta(c.equipo.fecha_proxima_calibracion)}`
      case 'alertas_error':
        return t('dashboard.lineaEstado.alertasNoDisponibles')
      case 'todo_en_orden':
        return t('dashboard.lineaEstado.todoEnOrden', { reportando: c.reportando, total: c.total })
    }
  }
}

/**
 * Línea de estado (TA, PLAN H2): una frase con lo peor de la farmacia y su
 * acción. Ocupa siempre su sitio (44 px) para que aparecer no mueva el bento
 * (CLS). No es región viva: es navegación; los avisos vivos están en las celdas.
 */
export const LineaEstado = memo(function LineaEstado({
  condiciones,
  cargando,
  onVerEquipo,
  onReintentar,
}: {
  condiciones: readonly CondicionLinea[]
  cargando: boolean
  onVerEquipo: (id: string) => void
  onReintentar: () => void
}) {
  const { t } = useTranslation()
  const frase = useFrase()
  if (cargando) return <div aria-hidden className="esqueleto mb-3 h-11 rounded-(--radius-card) xl:mb-4" />
  const [principal, secundaria] = condiciones
  if (!principal) return null

  const extra = secundaria && (
    <span className="truncate text-faint max-lg:hidden">· {frase(secundaria)}</span>
  )
  const texto = <span className="min-w-0 max-sm:line-clamp-2 sm:truncate">{frase(principal)}</span>

  if (principal.tipo === 'criticas' || principal.tipo === 'pendientes') {
    const critica = principal.tipo === 'criticas'
    const Icono = critica ? OctagonAlert : TriangleAlert
    return (
      <Link
        key={principal.tipo}
        to="/alertas"
        className={clsx(
          BASE,
          ENFOQUE,
          'transition-colors duration-(--duration-micro)',
          critica
            ? 'border-critical/30 bg-critical-tint text-danger-700 hover:border-critical/50'
            : 'border-warning-200 bg-warning-100 text-warning-700 hover:border-warning-600/50',
        )}
      >
        <Icono aria-hidden className="size-4 shrink-0" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {texto}
          {extra}
        </span>
        <span className="shrink-0 font-medium max-sm:sr-only">{t('dashboard.lineaEstado.revisarAlertas')}</span>
        <ArrowRight aria-hidden className="size-4 shrink-0" />
      </Link>
    )
  }

  if (principal.tipo === 'todo_en_orden') {
    return (
      <p key="ok" className={clsx(BASE, 'border-border bg-surface text-subtle')}>
        <CircleCheck aria-hidden className="size-4 shrink-0 text-success-700" />
        {texto}
      </p>
    )
  }

  if (principal.tipo === 'alertas_error') {
    return (
      <button key="error" type="button" onClick={onReintentar} className={clsx(BASE, ENFOQUE, 'cursor-pointer border-border bg-surface text-subtle hover:bg-surface-hover')}>
        <Hourglass aria-hidden className="size-4 shrink-0 text-nodata-700" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">{texto}</span>
        <span className="shrink-0 font-medium">{t('comunes.reintentar')}</span>
      </button>
    )
  }

  const equipoId = principal.tipo === 'sin_datos' ? principal.equipos[0].id : principal.equipo.id
  const sinDatos = principal.tipo === 'sin_datos'
  const Icono = sinDatos ? Hourglass : principal.tipo === 'falla' ? TriangleAlert : CalendarClock
  return (
    <button
      key={principal.tipo}
      type="button"
      onClick={() => onVerEquipo(equipoId)}
      className={clsx(
        BASE,
        ENFOQUE,
        'relative cursor-pointer overflow-hidden transition-colors duration-(--duration-micro)',
        sinDatos
          ? 'border-border bg-surface text-subtle hover:bg-surface-hover'
          : 'border-warning-200 bg-warning-100 text-warning-700 hover:border-warning-600/50',
      )}
    >
      {sinDatos && <span aria-hidden className="trama-sin-datos absolute inset-y-0 left-0 w-[3px]" />}
      <Icono aria-hidden className={clsx('size-4 shrink-0', sinDatos && 'text-nodata-700')} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {texto}
        {extra}
      </span>
      <span className="shrink-0 font-medium max-sm:sr-only">{t('dashboard.lineaEstado.verEquipo')}</span>
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </button>
  )
})
