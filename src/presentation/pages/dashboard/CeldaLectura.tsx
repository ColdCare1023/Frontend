import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Hourglass, ShieldQuestion, TriangleAlert } from 'lucide-react'

import { haceCuanto } from '@/lib/formato'
import type { MotivoDesconexionSse } from '@/infrastructure/sse/sseClient'
import { estadoRiesgoDe, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { clsx } from 'clsx'
import { HoraLectura } from '../../components/HoraLectura'
import { RiskBadge } from '../../components/RiskBadge'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
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
  deviceId,
  desactualizado,
  sseConectado,
  motivoDesconexion = null,
  extremos,
  ventana,
}: {
  ultima: LecturaTermica | null
  estadoHistorial: 'cargando' | 'completo' | 'error'
  reintentar: () => void
  deviceId: string | null
  desactualizado: boolean
  sseConectado: boolean
  /** HU-32 esc. 3: causa conocida del corte del flujo (null: red o servidor). */
  motivoDesconexion?: MotivoDesconexionSse | null
  extremos: ExtremosVentana | null
  /** Frase de la ventana elegida («las últimas 24 h»). */
  ventana: string
}) {
  const { t } = useTranslation()
  const segundosDesdeUltima = useSegundosDesde(ultima?.timestamp)
  // HU-34: se rotula el estado de riesgo, no `riesgo_efectivo`, que vale
  // «normal» para una lectura en rango que el modelo no clasificó.
  const riesgo = estadoRiesgoDe(ultima)

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
        className="flex min-w-0 flex-col"
      >
        <div className="flex flex-wrap items-center gap-2">
          {titulo}
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

  const estadoInferencia = ultima.estado_inferencia ? t(`ia.estado.${ultima.estado_inferencia}`, { defaultValue: '' }) : ''
  const motivoSinClasificacion = [t('dashboard.sinClasificacionIaDetalle'), estadoInferencia].filter(Boolean).join(' · ')
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
      className="flex min-w-0 flex-col"
    >
      <div className="flex flex-wrap items-center gap-2">
        {titulo}
        {/* HU-54 esc. 4: sin datos recientes no se presenta el equipo como Normal. */}
        {desactualizado ? (
          <Badge variant="neutral">
            <Hourglass aria-hidden className="size-3.5 text-nodata-700" />
            {t('dashboard.sinDatosRecientes')}
          </Badge>
        ) : riesgo === 'sin_clasificacion_ia' ? (
          // HU-34 esc. 4: sin clase del modelo no se presenta como Normal,
          // aunque la regla 2-8 °C no vea excursión. El motivo, en el detalle.
          <Tooltip contenido={motivoSinClasificacion} lado="top">
            <button
              type="button"
              data-testid="riesgo-sin-clasificacion"
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <RiskBadge nivel={riesgo} />
              <span className="sr-only">. {motivoSinClasificacion}</span>
            </button>
          </Tooltip>
        ) : (
          <RiskBadge nivel={riesgo} />
        )}
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
          <p
            data-testid={desactualizado ? 'valor-historico' : 'valor-actual'}
            data-valor={lectura.toFixed(1)}
            {...(!desactualizado && { elementtiming: 'valor-actual' })}
            className={clsx(
              'nums inline-flex items-baseline gap-1 whitespace-nowrap',
              desactualizado ? 'text-metric text-subtle' : 'text-hero max-sm:text-[56px] max-sm:leading-[56px]',
              critica && 'text-danger-700',
            )}
          >
            {fmt(lectura)}
            <span className="text-metric font-medium text-muted"> °C</span>
          </p>
        )}
      </div>

      {desactualizado && (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-meta text-muted">
          <HoraLectura lectura={ultima} formato="fechaHora" />
          <span>{haceCuanto(ultima.timestamp)}</span>
        </p>
      )}

      <details className="group mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-meta font-medium text-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          {t('dashboard.rangoConservacion')}
          <ChevronDown aria-hidden className="size-3.5 group-open:rotate-180" />
        </summary>
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
        {desactualizado && <p className="mt-2 text-meta text-muted">
          {t('dashboard.sinDatosRecientesDetalle')}
          {ultima.excursion_confirmada && <> {t('dashboard.excursionConfirmada')}</>}
        </p>}
        {!desactualizado && riesgo === 'normal' && <p className="mt-2 text-meta text-muted">{t('riesgo.detalle.normal')}</p>}
        {ultima.ia_experimental && !ultima.excursion_confirmada && (
          // HU-20 / B-1: la clase la produjo el modelo legado (datos sintéticos).
          // Plegado junto al rango: no compite con la temperatura.
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
            <Badge variant="outline">{t('dashboard.iaExperimental')}</Badge>
            <span>{t('dashboard.iaExperimentalDetalle')}</span>
          </p>
        )}
      </details>
      {fueraDeEscala && lectura != null && (
        <p role="note" className="mt-2 text-meta font-medium text-danger-700">
          {lectura > EJE_REGLA.maximo
            ? t('dashboard.lecturaSobreEscala', { temperatura: lectura.toFixed(1) })
            : t('dashboard.lecturaBajoEscala', { temperatura: lectura.toFixed(1) })}
        </p>
      )}

      {!desactualizado && riesgo !== 'normal' && <p className="mt-3 text-pretty text-body text-muted">
        {riesgo ? t(`riesgo.detalle.${riesgo}`) : t('dashboard.sinClasificacion')}
      </p>}
      {desactualizado && riesgo && riesgo !== 'normal' && riesgo !== 'sin_clasificacion_ia' && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted">
          {t('dashboard.ultimaLecturaHora')} <RiskBadge nivel={riesgo} />
        </p>
      )}
      {!desactualizado && ultima.excursion_confirmada && (
        <p className="mt-1 text-meta font-semibold text-danger-700">{t('dashboard.excursionConfirmada')}</p>
      )}
      {!ultima.excursion_confirmada && ultima.nivel_riesgo === 'excursion_critica' && riesgo !== 'excursion_critica' && (
        <p className="mt-1 flex items-start gap-1.5 text-meta text-warning-700">
          <ShieldQuestion className="mt-px size-3.5 shrink-0" aria-hidden />
          {t('dashboard.clasificacionIaDivergente')}
        </p>
      )}

      <p className="nums mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-meta text-faint">
        {sseConectado ? (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-success-600" />
            <span className="font-medium text-subtle">{t(desactualizado ? 'medicion.flujoConectado' : 'dashboard.actualizacionActiva')}</span>
            {!desactualizado && (
              <>
                <span aria-hidden>·</span>
                <span>{t('dashboard.haceSegundos', { s: segundosDesdeUltima ?? 0 })}</span>
              </>
            )}
          </>
        ) : motivoDesconexion === 'demasiados_flujos' ? (
          // HU-32 esc. 3: la cuenta ya tiene abiertos los flujos que admite el
          // backend. No es una caída: se dice la causa y qué hacer.
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-warning-600" />
            <span role="status" className="font-medium text-warning-700">
              {t('dashboard.demasiadasPestanas')}
              <span className="font-normal text-muted"> · {t('dashboard.demasiadasPestanasGuia')}</span>
            </span>
          </>
        ) : (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-warning-600" />
            <span className="font-medium text-warning-700">{t('dashboard.actualizacionReconectando')}</span>
          </>
        )}
        {/* «hace X s» basta a la vista; la hora exacta sigue para lector de pantalla. */}
        {!desactualizado && <span className="sr-only">
          · {t('dashboard.ultimaLecturaHora')}: <HoraLectura lectura={ultima} formato="hora" />
        </span>}
      </p>
    </section>
  )
})
