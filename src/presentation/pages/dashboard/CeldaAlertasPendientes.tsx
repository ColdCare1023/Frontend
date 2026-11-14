import { memo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { duracionLegible, fechaHora } from '@/lib/formato'
import { clsx } from 'clsx'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Esqueleto } from '../../components/ui/esqueleto'
import { IlustracionVacia } from '../../components/ui/ilustracion-vacia'
import { Regla } from '../../components/ui/regla'
import { useMinuto } from '../../hooks/useReloj'
import { haceRelativo } from './utilidades'

const HORA_MS = 3_600_000

/**
 * Cuándo empezaron y cuánto duraron las pendientes, en una cinta de 24 h a
 * 7 días (la familia de la cinta 24 h, DIRECTION §4). Solo con datos reales:
 * inicio (`iniciada_en` o `created_at`) y `duracion_s`; sin duración, una marca.
 */
function LineaPendientes({ alertas, nombres }: { alertas: readonly AlertaTermica[]; nombres: ReadonlyMap<string, string> }) {
  const { t, i18n } = useTranslation()
  const ahora = useMinuto()
  const conInicio = alertas
    .map((alerta) => ({ alerta, inicio: Date.parse(alerta.iniciada_en ?? alerta.created_at ?? '') }))
    .filter((a) => Number.isFinite(a.inicio))
  if (conInicio.length === 0) return null
  const masAntigua = Math.min(...conInicio.map((a) => a.inicio))
  const horas = Math.min(168, Math.max(24, Math.ceil((ahora - masAntigua) / (24 * HORA_MS)) * 24))
  const desde = ahora - horas * HORA_MS
  const lapso = horas * HORA_MS
  const detalle = conInicio
    .map(({ alerta }) =>
      [t(`riesgo.${alerta.nivel_riesgo}`), nombres.get(alerta.device_id) ?? alerta.device_id, haceRelativo(alerta.iniciada_en ?? alerta.created_at, i18n.language), alerta.duracion_s != null ? duracionLegible(alerta.duracion_s) : null]
        .filter(Boolean)
        .join(', '),
    )
    .join('; ')
  return (
    <figure className="mt-auto pt-4">
      <div
        role="img"
        aria-label={t('dashboard.alertasLineaEtiqueta', { horas, detalle })}
        className="relative h-4 overflow-hidden rounded-[3px] bg-surface-sunken ring-1 ring-border ring-inset"
      >
        {conInicio.map(({ alerta, inicio }) => {
          const izquierda = Math.max(0, Math.min(1, (inicio - desde) / lapso))
          const ancho = Math.min(1 - izquierda, ((alerta.duracion_s ?? 0) * 1000) / lapso)
          return (
            <span
              key={alerta.id}
              title={`${t(`riesgo.${alerta.nivel_riesgo}`)} · ${fechaHora(alerta.iniciada_en ?? alerta.created_at)}${alerta.duracion_s != null ? ` · ${duracionLegible(alerta.duracion_s)}` : ''}`}
              className={clsx(
                'absolute inset-y-0.5 rounded-[2px]',
                alerta.nivel_riesgo === 'excursion_critica' ? 'bg-critical-solid' : 'bg-warning-600',
              )}
              style={{ left: `${izquierda * 100}%`, width: `max(4px, ${ancho * 100}%)` }}
            />
          )
        })}
      </div>
      <figcaption aria-hidden className="nums mt-1 flex justify-between gap-3 text-micro text-faint">
        <span>{t('dashboard.haceHorasEje', { h: horas })}</span>
        <span className="truncate">{t('dashboard.alertasLineaTitulo')}</span>
        <span>{t('dashboard.ejeAhora')}</span>
      </figcaption>
    </figure>
  )
}

/** «Excursión crítica · 8.6 °C»: el nivel y, si existe, el pico del episodio. */
function tituloAlerta(alerta: AlertaTermica, t: (clave: string) => string): string {
  const nivel = t(`riesgo.${alerta.nivel_riesgo}`)
  return alerta.temperatura_pico != null ? `${nivel} · ${alerta.temperatura_pico.toFixed(1)}\u202f°C` : nivel
}

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
    // Con menos de 3 pendientes, la última atendida completa la lista: es
    // contexto real (no relleno) y responde «¿cuándo fue la última vez?».
    const conAtendida = primeras.length < 3 && ultimaAtendida
    cuerpo = (
      <ol className="mt-2 divide-y divide-border">
        {primeras.map((alerta) => {
          const critica = alerta.nivel_riesgo === 'excursion_critica'
          const Icono = critica ? OctagonAlert : TriangleAlert
          const nombre = nombres.get(alerta.device_id) ?? alerta.device_id
          const meta = [
            nombre,
            haceRelativo(alerta.iniciada_en ?? alerta.created_at, i18n.language),
            alerta.duracion_s != null ? duracionLegible(alerta.duracion_s) : null,
            alerta.estado === 'reconocida' ? t('dashboard.alertaReconocida') : null,
          ].filter(Boolean)
          return (
            <li key={alerta.id}>
              <Link
                to="/alertas"
                className="relative grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-(--radius-field) py-2 pl-3 pr-2 transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span aria-hidden className={clsx('absolute inset-y-2 left-0 w-[3px] rounded-full', critica ? 'bg-critical-solid' : 'bg-warning-600')} />
                <Icono aria-hidden className={clsx('size-4', critica ? 'text-critical' : 'text-warning-700')} />
                <span className="min-w-0">
                  <span className="nums block truncate text-body font-medium text-foreground">
                    {tituloAlerta(alerta, t)}
                  </span>
                  <span className="nums block text-meta text-faint sm:truncate">{meta.join(' · ')}</span>
                </span>
                {/* DIRECTION §4: la Regla S dice dónde cae el pico respecto de 2–8 °C. */}
                {alerta.temperatura_pico != null ? (
                  <Regla tamano="s" valor={alerta.temperatura_pico} tono={critica ? 'critico' : 'preventivo'} decorativa />
                ) : (
                  <span />
                )}
              </Link>
            </li>
          )
        })}
        {conAtendida && (
          <li className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2 pl-3 pr-2">
            <CircleCheck aria-hidden className="size-4 text-success-700" />
            <span className="min-w-0">
              <span className="nums block truncate text-body text-subtle">{tituloAlerta(ultimaAtendida, t)}</span>
              <span className="nums block truncate text-meta text-faint">
                {t('dashboard.ultimaAtendida', {
                  fecha: fechaHora(ultimaAtendida.atendida_en ?? ultimaAtendida.created_at),
                  equipo: nombres.get(ultimaAtendida.device_id) ?? ultimaAtendida.device_id,
                })}
              </span>
            </span>
            {ultimaAtendida.temperatura_pico != null ? (
              <Regla tamano="s" valor={ultimaAtendida.temperatura_pico} tono="neutro" decorativa />
            ) : (
              <span />
            )}
          </li>
        )}
      </ol>
    )
  }

  // Con pocas pendientes la celda tiene sitio: la cinta dice cuándo ocurrieron.
  const linea = estado === 'listo' && total > 0 && primeras.length < 3 ? <LineaPendientes alertas={alertas} nombres={nombres} /> : null

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
      {linea}
    </section>
  )
})
