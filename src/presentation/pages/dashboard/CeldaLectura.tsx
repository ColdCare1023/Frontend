import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Hourglass, ShieldQuestion, TriangleAlert } from 'lucide-react'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { hora as formatearHora } from '@/lib/formato'
import { clsx } from 'clsx'
import { RiskBadge } from '../../components/RiskBadge'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { CifraAnimada } from '../../components/ui/cifra-animada'
import { Esqueleto } from '../../components/ui/esqueleto'
import { tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { formatearCifra } from '../../components/ui/formato-cifra'
import { IlustracionVacia } from '../../components/ui/ilustracion-vacia'
import { Regla } from '../../components/ui/regla'
import { EJE_REGLA } from '../../components/ui/regla-eje'
import { Tooltip } from '../../components/ui/tooltip'
import { useSegundosDesde } from '../../hooks/useReloj'
import { fallaSensor } from './puerta'

export interface ExtremosVentana {
  minima: number
  maxima: number
}

/**
 * Celda foco del monitoreo (DIRECTION §12): la cifra en `text-hero`, la Regla
 * 2–8 XL con los extremos de la ventana, la guía en una frase y la frescura
 * junto al valor (HU-32 esc. 4). La región conserva el nombre «Temperatura
 * actual» que usan las pruebas.
 */
export const CeldaLectura = memo(function CeldaLectura({
  ultima,
  estadoHistorial,
  reintentar,
  equipos,
  deviceId,
  onElegirEquipo,
  desactualizado,
  sseConectado,
  extremos,
  ventana,
}: {
  ultima: LecturaTermica | null
  estadoHistorial: 'cargando' | 'completo' | 'error'
  reintentar: () => void
  equipos: readonly Dispositivo[]
  deviceId: string | null
  onElegirEquipo: (id: string) => void
  desactualizado: boolean
  sseConectado: boolean
  extremos: ExtremosVentana | null
  /** Frase de la ventana elegida («las últimas 24 h»). */
  ventana: string
}) {
  const { t } = useTranslation()
  const segundosDesdeUltima = useSegundosDesde(ultima?.timestamp)
  const riesgo = ultima?.riesgo_efectivo ?? null

  const selector = equipos.length > 1 && (
    <label className="flex min-w-0 items-center gap-2 max-sm:basis-full sm:ml-auto">
      <span className="text-meta text-muted max-xl:sr-only">{t('dashboard.equipo')}</span>
      <select
        value={deviceId ?? ''}
        onChange={(evento) => onElegirEquipo(evento.target.value)}
        className="h-9 min-w-0 max-w-60 flex-1 truncate rounded-(--radius-field) border border-border-field bg-surface-sunken px-3 text-body font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-11 max-sm:max-w-none pointer-coarse:h-11"
      >
        {equipos.map((equipo) => (
          <option key={equipo.id} value={equipo.id}>
            {equipo.nombre ? `${equipo.nombre} (${equipo.id})` : equipo.id}
          </option>
        ))}
      </select>
    </label>
  )

  const titulo = (
    <h2 id="resumen-termico-titulo" className="text-title text-foreground">
      {desactualizado ? t('dashboard.ultimaTemperatura') : t('dashboard.estadoRefrigerador')}
    </h2>
  )

  if (!ultima) {
    return (
      <section
        aria-labelledby="resumen-termico-titulo"
        data-testid="celda-lectura"
        className="superficie col-span-4 flex min-w-0 flex-col p-4 sm:col-span-8 lg:col-span-7 lg:row-span-2 xl:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          {titulo}
          {selector}
        </div>
        {estadoHistorial === 'cargando' ? (
          <div aria-busy="true" className="mt-3 space-y-4">
            <span className="sr-only">{t('app.cargando')}</span>
            <Esqueleto className="h-[72px] w-48" />
            <Esqueleto className="h-1.5 w-full" />
            <Esqueleto className="h-4 w-64 max-w-full" />
          </div>
        ) : estadoHistorial === 'error' ? (
          <div role="alert" className="mt-4 flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 text-body font-medium text-danger-700">
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              {t('dashboard.errorHistorial')}
            </p>
            <Button variant="secondary" size="sm" onClick={reintentar}>
              {t('comunes.reintentar')}
            </Button>
          </div>
        ) : (
          <div role="status" className="mt-4 flex items-center gap-4">
            <IlustracionVacia variante="sin-datos" />
            <div className="min-w-0 space-y-1">
              <p className="text-title text-foreground">{t('dashboard.esperandoDatos')}</p>
              <p className="max-w-prose text-body text-muted">{t('dashboard.esperandoDetalle')}</p>
            </div>
          </div>
        )}
      </section>
    )
  }

  const lectura = ultima.temperatura_interna
  const lecturaFinita = lectura != null && Number.isFinite(lectura)
  const fueraDeEscala = lecturaFinita && (lectura < EJE_REGLA.minimo || lectura > EJE_REGLA.maximo)
  const sensorFallido = fallaSensor(ultima, 'temperatura_interna')
  const sinLectura = lectura == null
  const critica = riesgo === 'excursion_critica' && !desactualizado
  const tonoRegla = desactualizado || !lecturaFinita ? 'sin_datos' : tonoDesdeRiesgo(riesgo)
  const fmt = (v: number) => formatearCifra(v)
  const etiquetaRegla = lecturaFinita
    ? extremos
      ? t('dashboard.reglaEtiqueta', { valor: fmt(lectura), min: fmt(extremos.minima), max: fmt(extremos.maxima), ventana })
      : t('regla.nombre', { valor: `${fmt(lectura)} °C`, minimo: RANGO_TERMICO.minimo, maximo: RANGO_TERMICO.maximo })
    : t('dashboard.reglaSinValor')

  return (
    <section
      aria-labelledby="resumen-termico-titulo"
      data-testid="celda-lectura"
      className="superficie col-span-4 flex min-w-0 flex-col p-4 sm:col-span-8 lg:col-span-7 lg:row-span-2 xl:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {titulo}
        {/* HU-54 esc. 4: sin datos recientes no se presenta el equipo como Normal. */}
        {desactualizado && riesgo === 'normal' ? (
          <Badge variant="neutral">
            <Hourglass aria-hidden className="size-3.5 text-nodata-700" />
            {t('dashboard.sinDatosRecientes')}
          </Badge>
        ) : (
          <RiskBadge nivel={riesgo} />
        )}
        {riesgo === 'normal' && !ultima.ia_experimental && !ultima.excursion_confirmada && ultima.nivel_riesgo === null && (
          // Sin clase del modelo: «Normal» lo dice solo la regla 2-8 °C.
          <Tooltip contenido={t('dashboard.sinClasificacionIaDetalle')} lado="top">
            <button type="button" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Badge variant="outline">{t('dashboard.sinClasificacionIa')}</Badge>
              <span className="sr-only">. {t('dashboard.sinClasificacionIaDetalle')}</span>
            </button>
          </Tooltip>
        )}
        {ultima.ia_experimental && !ultima.excursion_confirmada && (
          // HU-20 / B-1: la clase la produjo el modelo legado (datos sintéticos).
          <Tooltip contenido={t('dashboard.iaExperimentalDetalle')} lado="top">
            <button type="button" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Badge variant="outline">{t('dashboard.iaExperimental')}</Badge>
              <span className="sr-only">. {t('dashboard.iaExperimentalDetalle')}</span>
            </button>
          </Tooltip>
        )}
        {selector}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        {sensorFallido || sinLectura ? (
          sensorFallido ? (
            <p role="alert" className="flex items-center gap-2 text-title text-warning-700">
              <TriangleAlert aria-hidden className="size-5 shrink-0" />
              {t('dashboard.fallaSensor')}
            </p>
          ) : (
            <p role="status" className="flex items-center gap-2 text-title text-muted">
              <Hourglass aria-hidden className="size-5 shrink-0 text-nodata-700" />
              {t('dashboard.sinLecturaDisponible')}
            </p>
          )
        ) : (
          <>
            <p
              data-testid="valor-actual"
              data-valor={lectura.toFixed(1)}
              {...{ elementtiming: 'valor-actual' }}
              className={clsx(
                'nums text-hero max-sm:text-[56px] max-sm:leading-[56px]',
                critica ? 'text-danger-700' : desactualizado ? 'text-muted' : 'text-foreground',
              )}
            >
              <CifraAnimada valor={lectura} clave={deviceId ?? ''} />
              <span className="sr-only"> °C</span>
            </p>
            <span aria-hidden className="text-metric font-medium text-muted">°C</span>
          </>
        )}
      </div>

      <Regla
        key={deviceId ?? ''}
        tamano="xl"
        valor={lecturaFinita ? lectura : null}
        tono={tonoRegla}
        minimo={extremos?.minima ?? null}
        maximo={extremos?.maxima ?? null}
        cotas
        etiqueta={etiquetaRegla}
        className="mt-4"
      />
      {extremos && (
        <p className="nums mt-1 text-micro text-faint">
          {t('dashboard.extremosVentana', { min: `${fmt(extremos.minima)}°`, max: `${fmt(extremos.maxima)}°`, ventana })}
        </p>
      )}
      {fueraDeEscala && lectura != null && (
        <p role="note" className="mt-2 text-meta font-medium text-danger-700">
          {lectura > EJE_REGLA.maximo
            ? t('dashboard.lecturaSobreEscala', { temperatura: lectura.toFixed(1) })
            : t('dashboard.lecturaBajoEscala', { temperatura: lectura.toFixed(1) })}
        </p>
      )}

      <p className="mt-3 text-pretty text-body text-muted">
        {riesgo
          ? desactualizado
            ? t(riesgo === 'normal' ? 'dashboard.sinDatosRecientesDetalle' : 'dashboard.riesgoUltimaLectura')
            : t(`riesgo.detalle.${riesgo}`)
          : t('dashboard.sinClasificacion')}
      </p>
      {ultima.excursion_confirmada && (
        <p className="mt-1 text-meta font-semibold text-danger-700">{t('dashboard.excursionConfirmada')}</p>
      )}
      {!ultima.excursion_confirmada && ultima.nivel_riesgo === 'excursion_critica' && riesgo !== 'excursion_critica' && (
        <p className="mt-1 flex items-start gap-1.5 text-meta text-warning-700">
          <ShieldQuestion className="mt-px size-3.5 shrink-0" aria-hidden />
          {t('dashboard.clasificacionIaDivergente')}
        </p>
      )}

      <p className="nums mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-meta text-faint">
        {desactualizado && (
          <>
            <Hourglass aria-hidden className="size-3.5 text-nodata-700" />
            <span className="font-medium text-subtle">{t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })}</span>
            {/* El flujo del navegador puede seguir sano aunque el nodo calle (RF-18): se dicen ambos. */}
            <span aria-hidden>·</span>
          </>
        )}
        {sseConectado ? (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-success-600" />
            <span className="font-medium text-subtle">{t('dashboard.actualizacionActiva')}</span>
            {!desactualizado && (
              <>
                <span aria-hidden>·</span>
                <span>{t('dashboard.haceSegundos', { s: segundosDesdeUltima ?? 0 })}</span>
              </>
            )}
          </>
        ) : (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-warning-600" />
            <span className="font-medium text-warning-700">{t('dashboard.actualizacionReconectando')}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span className="sr-only">{t('dashboard.ultimaLecturaHora')}:</span>
        <time dateTime={ultima.timestamp}>{formatearHora(ultima.timestamp)}</time>
      </p>
    </section>
  )
})
