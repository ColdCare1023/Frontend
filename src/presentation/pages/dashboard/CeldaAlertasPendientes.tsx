import { memo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, OctagonAlert, TriangleAlert } from 'lucide-react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHora } from '@/lib/formato'
import { clsx } from 'clsx'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Esqueleto } from '../../components/ui/esqueleto'
import { IlustracionVacia } from '../../components/ui/ilustracion-vacia'
import { Regla } from '../../components/ui/regla'
import { haceRelativo } from './utilidades'

/**
 * Alertas pendientes (HU-21 esc. 3, HU-23 esc. 3): críticas primero y, dentro
 * de cada grupo, la que lleva más tiempo esperando. Cada fila lleva a Alertas,
 * donde se reconoce y se registra la acción; aquí no se actúa.
 */
export const CeldaAlertasPendientes = memo(function CeldaAlertasPendientes({
  total,
  criticas,
  alertas,
  estado,
  reintentar,
  nombres,
  ultimaAtendida,
}: {
  total: number
  criticas: number
  alertas: readonly AlertaTermica[]
  estado: 'cargando' | 'listo' | 'error'
  reintentar: () => void
  nombres: ReadonlyMap<string, string>
  ultimaAtendida: AlertaTermica | null
}) {
  const { t, i18n } = useTranslation()
  const primeras = alertas.slice(0, 3)

  let cuerpo: React.ReactNode
  if (estado === 'cargando') {
    cuerpo = (
      <div aria-hidden className="mt-3 space-y-3">
        {[0, 1, 2].map((i) => (
          <Esqueleto key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  } else if (estado === 'error') {
    cuerpo = (
      <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-body text-danger-700">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {t('dashboard.alertasError')}
        </p>
        <Button variant="secondary" size="sm" onClick={reintentar}>
          {t('comunes.reintentar')}
        </Button>
      </div>
    )
  } else if (total === 0) {
    cuerpo = (
      <div role="status" className="mt-3 flex max-h-40 items-center gap-4">
        <IlustracionVacia variante="al-dia" />
        <div className="min-w-0 space-y-1">
          <p className="text-title text-foreground">{t('dashboard.todoEnOrden')}</p>
          <p className="text-body text-muted">{t('dashboard.todoEnOrdenDetalle')}</p>
          {ultimaAtendida && (
            <p className="nums text-meta text-faint">
              {t('dashboard.ultimaAtendida', {
                fecha: fechaHora(ultimaAtendida.atendida_en ?? ultimaAtendida.created_at),
                equipo: nombres.get(ultimaAtendida.device_id) ?? ultimaAtendida.device_id,
              })}
            </p>
          )}
          <Link to="/alertas" className="inline-flex min-h-9 items-center gap-1 text-body font-medium text-primary-text hover:underline">
            {t('dashboard.verTodasAlertas')}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    )
  } else {
    cuerpo = (
      <ol className="mt-2 divide-y divide-border">
        {primeras.map((alerta) => {
          const critica = alerta.nivel_riesgo === 'excursion_critica'
          const Icono = critica ? OctagonAlert : TriangleAlert
          return (
            <li key={alerta.id}>
              <Link
                to="/alertas"
                className="relative grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-(--radius-field) py-2.5 pl-3 pr-2 transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span aria-hidden className={clsx('absolute inset-y-2 left-0 w-[3px] rounded-full', critica ? 'bg-critical-solid' : 'bg-warning-600')} />
                <Icono aria-hidden className={clsx('size-4', critica ? 'text-critical' : 'text-warning-700')} />
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-foreground">{nombres.get(alerta.device_id) ?? alerta.device_id}</span>
                  <span className="nums block truncate text-meta text-faint">
                    {haceRelativo(alerta.iniciada_en ?? alerta.created_at, i18n.language)}
                    {alerta.temperatura_pico != null && ` · ${t('dashboard.alertaPico', { temp: alerta.temperatura_pico.toFixed(1) })}`}
                    {alerta.estado === 'reconocida' && ` · ${t('dashboard.alertaReconocida')}`}
                  </span>
                </span>
                {alerta.temperatura_pico != null ? (
                  <Regla tamano="s" valor={alerta.temperatura_pico} tono={critica ? 'critico' : 'preventivo'} decorativa />
                ) : (
                  <span />
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <section aria-labelledby="alertas-pendientes-titulo" className="superficie col-span-4 flex min-w-0 flex-col p-4 lg:col-span-6 xl:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="alertas-pendientes-titulo" className="text-title text-foreground">
          {t('dashboard.alertasTitulo')}
        </h2>
        {estado === 'listo' && total > 0 && (
          <Badge variant={criticas > 0 ? 'critical' : 'warn'} className="nums">
            {total}
          </Badge>
        )}
        <Link to="/alertas" className="ml-auto inline-flex min-h-9 items-center gap-1 text-body font-medium text-primary-text hover:underline">
          {t('dashboard.verAlertas')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      {estado === 'listo' && total > 0 && (
        <p className="nums text-meta text-faint">
          {t('dashboard.alertasSinAtender', { count: total })}
          {criticas > 0 && ` · ${t('dashboard.alertasCriticas', { count: criticas })}`}
        </p>
      )}
      {cuerpo}
    </section>
  )
})
