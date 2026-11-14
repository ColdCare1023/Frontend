import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, DoorClosed, DoorOpen, Droplets, Hourglass, ThermometerSun } from 'lucide-react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { duracionBreve } from '@/lib/formato'
import { clsx } from 'clsx'
import { Esqueleto } from '../../components/ui/esqueleto'
import { useSegundosDesde } from '../../hooks/useReloj'
import { aperturasEnSerie, estadoPuerta, fallaSensor } from './puerta'
import { submuestrear } from './utilidades'

/** Sparkline SVG en línea (PERF B3: sin ECharts). Decorativa: el valor ya se dice. */
function Sparkline({ valores, className }: { valores: readonly number[]; className?: string }) {
  if (valores.length < 2) return <div aria-hidden className={clsx('h-6', className)} />
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  const puntos = valores
    .map((v, i) => `${((i / (valores.length - 1)) * 100).toFixed(2)},${(22 - ((v - min) / rango) * 20).toFixed(2)}`)
    .join(' ')
  return (
    <svg aria-hidden viewBox="0 0 100 24" preserveAspectRatio="none" className={clsx('h-6 w-full', className)}>
      <polyline points={puntos} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function Antiguedad({ segundos }: { segundos: number | null }) {
  const { t } = useTranslation()
  return (
    <span className="nums ml-auto inline-flex items-center gap-1 text-micro text-faint">
      <Hourglass aria-hidden className="size-3 text-nodata-700" />
      {t('dashboard.haceSegundos', { s: segundos ?? 0 })}
    </span>
  )
}

function Metrica({
  icono: Icono,
  etiqueta,
  valor,
  unidad,
  decimales,
  campo,
  ultima,
  anterior,
  serie,
  desactualizado,
  segundos,
  textoDelta,
}: {
  icono: React.ComponentType<{ className?: string }>
  etiqueta: string
  valor: number | null | undefined
  unidad: string
  decimales: number
  campo: 'temperatura_ambiental' | 'humedad_ambiental'
  ultima: LecturaTermica
  anterior: LecturaTermica | null
  serie: readonly LecturaTermica[]
  desactualizado: boolean
  segundos: number | null
  textoDelta: string
}) {
  const { t } = useTranslation()
  const fallo = fallaSensor(ultima, campo)
  const delta = valor != null && anterior?.[campo] != null ? valor - (anterior[campo] as number) : null
  const puntos = useMemo(
    () => submuestrear(serie.map((l) => l[campo]).filter((v): v is number => v != null && Number.isFinite(v))),
    [serie, campo],
  )
  return (
    <div className="flex min-w-0 flex-col px-3 first:pl-0 last:pr-0">
      <dt className="flex items-center gap-1.5 text-meta font-medium text-muted">
        <Icono aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{etiqueta}</span>
        {desactualizado && !fallo && valor != null && <Antiguedad segundos={segundos} />}
      </dt>
      {fallo || valor == null ? (
        <dd role={fallo ? 'alert' : 'status'} className="mt-1 text-meta font-medium text-warning-700">
          {fallo ? t('dashboard.fallaSensor') : t('dashboard.sinLecturaDisponible')}
        </dd>
      ) : (
        <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className={clsx('nums text-metric', desactualizado ? 'text-muted' : 'text-foreground')}>
            {valor.toFixed(decimales)}
          </span>
          <span className="text-body font-medium text-muted">{unidad}</span>
          {delta != null && Math.abs(delta) >= 0.05 && (
            <span className="nums inline-flex items-center text-micro text-faint">
              {delta > 0 ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
              {Math.abs(delta).toFixed(1)}
              <span className="sr-only"> {unidad} · {textoDelta}</span>
            </span>
          )}
        </dd>
      )}
      {/* Dentro de un <dd>: un <dl> solo admite dt/dd (axe definition-list). */}
      <dd aria-hidden className="mt-auto pt-2 text-subtle">
        <Sparkline valores={puntos} />
      </dd>
    </div>
  )
}

/** Marcas verticales de cada apertura de la ventana (HU-35 esc. 3). */
function TiraAperturas({ serie, umbral, desde, hasta }: { serie: readonly LecturaTermica[]; umbral: number; desde: number; hasta: number }) {
  const marcas = useMemo(() => aperturasEnSerie(serie, umbral), [serie, umbral])
  const rango = Math.max(1, hasta - desde)
  return (
    <div aria-hidden className="relative h-6 w-full border-b border-border">
      {marcas
        .filter((m) => m.ms >= desde && m.ms <= hasta)
        .map((m) => (
          <span
            key={m.ms}
            className={clsx('absolute bottom-0 h-4 w-0.5 rounded-full', m.prolongada ? 'bg-warning-600' : 'bg-faint')}
            style={{ left: `${((m.ms - desde) / rango) * 100}%` }}
          />
        ))}
    </div>
  )
}

/**
 * Condiciones (ambiente, humedad y puerta) en tres columnas que se mantienen
 * en móvil (DIRECTION §12). La sparkline toma el alto sobrante: nada se
 * estira para llenar.
 */
export const CeldaCondiciones = memo(function CeldaCondiciones({
  ultima,
  serie,
  cargando,
  desactualizado,
  ventana,
  horasVentana,
}: {
  ultima: LecturaTermica | null
  serie: readonly LecturaTermica[]
  cargando: boolean
  desactualizado: boolean
  ventana: string
  horasVentana: number
}) {
  const { t } = useTranslation()
  const segundosDesdeUltima = useSegundosDesde(ultima?.timestamp)
  const anterior = serie.at(-2) ?? null

  let contenido: React.ReactNode
  if (!ultima) {
    contenido = cargando ? (
      <div aria-hidden className="grid h-full grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Esqueleto className="h-3 w-16" />
            <Esqueleto className="h-7 w-14" />
            <Esqueleto className="h-6 w-full" />
          </div>
        ))}
      </div>
    ) : (
      <dl className="grid grid-cols-3 divide-x divide-border">
        {[
          [ThermometerSun, t('dashboard.ambienteCorto')],
          [Droplets, t('dashboard.humedadCorta')],
          [DoorClosed, t('dashboard.puerta')],
        ].map(([Icono, etiqueta]) => {
          const I = Icono as React.ComponentType<{ className?: string }>
          return (
            <div key={etiqueta as string} className="flex min-w-0 flex-col px-3 first:pl-0 last:pr-0">
              <dt className="flex items-center gap-1.5 text-meta font-medium text-muted">
                <I aria-hidden className="size-3.5" />
                {etiqueta as string}
              </dt>
              <dd className="mt-1 flex items-center gap-1 text-metric text-faint">
                <Hourglass aria-hidden className="size-4 text-nodata-700" />—
              </dd>
            </div>
          )
        })}
      </dl>
    )
  } else {
    const puerta = estadoPuerta(ultima, segundosDesdeUltima, desactualizado)
    const hasta = Date.parse(ultima.timestamp) || 0
    const aperturas = puerta.sinSensor ? 0 : aperturasEnSerie(serie, puerta.umbral).length
    contenido = (
      <dl className="grid h-full grid-cols-3 divide-x divide-border">
        <Metrica
          icono={ThermometerSun}
          etiqueta={t('dashboard.ambienteCorto')}
          valor={ultima.temperatura_ambiental}
          unidad="°C"
          decimales={1}
          campo="temperatura_ambiental"
          ultima={ultima}
          anterior={anterior}
          serie={serie}
          desactualizado={desactualizado}
          segundos={segundosDesdeUltima}
          textoDelta={t('dashboard.variacionVsAnterior')}
        />
        <Metrica
          icono={Droplets}
          etiqueta={t('dashboard.humedadCorta')}
          valor={ultima.humedad_ambiental}
          unidad="%"
          decimales={0}
          campo="humedad_ambiental"
          ultima={ultima}
          anterior={anterior}
          serie={serie}
          desactualizado={desactualizado}
          segundos={segundosDesdeUltima}
          textoDelta={t('dashboard.variacionVsAnterior')}
        />
        <div className="flex min-w-0 flex-col px-3 first:pl-0 last:pr-0">
          <dt className="flex items-center gap-1.5 text-meta font-medium text-muted">
            {puerta.abiertaAhora ? (
              <DoorOpen className="size-3.5 shrink-0 text-warning-600" aria-hidden />
            ) : (
              <DoorClosed className="size-3.5 shrink-0" aria-hidden />
            )}
            {t('dashboard.puerta')}
          </dt>
          <dd
            className={clsx('mt-1 text-title', puerta.abiertaAhora ? 'text-warning-700' : 'text-foreground')}
            role={puerta.aperturaProlongada ? 'alert' : undefined}
            data-testid={puerta.abiertaAhora ? 'puerta-advertencia' : undefined}
          >
            {puerta.sinSensor
              ? t('dashboard.puertaSinDato')
              : puerta.abiertaAhora
                ? t('dashboard.puertaAbierta')
                : t('dashboard.puertaCerrada')}
            {puerta.aperturaEnCurso != null && (
              <span className={clsx('nums ml-1 text-meta font-normal', puerta.aperturaProlongada ? 'text-danger-700' : 'text-muted')}>
                · {t('dashboard.puertaDesdeHace', { duracion: duracionBreve(puerta.aperturaEnCurso) })}
                {puerta.aperturaProlongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}
              </span>
            )}
            {!puerta.conAperturaContinua && ultima.apertura_refrigerador && ultima.duracion_apertura_segundos != null && (() => {
              const duracion = ultima.duracion_apertura_segundos
              const prolongada = duracion >= puerta.umbral
              return (
                <span className={clsx('nums ml-1 text-meta font-normal', prolongada ? 'text-danger-700' : 'text-muted')}>
                  · {duracionBreve(duracion)}
                  {prolongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}
                </span>
              )
            })()}
            {puerta.huboAperturaCerrada && ultima.duracion_apertura_segundos != null && (
              <span className="mt-0.5 block text-meta font-normal text-muted">
                {t('dashboard.puertaHuboApertura', { segundos: ultima.duracion_apertura_segundos })}
              </span>
            )}
            {puerta.aperturaProlongada && (
              <span className="mt-0.5 block text-meta font-medium text-danger-700">
                {t('dashboard.puertaSuperaUmbral', { segundos: puerta.umbral })}
              </span>
            )}
          </dd>
          {!puerta.sinSensor && (
            <>
              <dd className="mt-auto">
                <TiraAperturas serie={serie} umbral={puerta.umbral} desde={hasta - horasVentana * 3_600_000} hasta={hasta} />
              </dd>
              <dd className="nums mt-1 truncate text-micro text-faint">{t('dashboard.aperturasVentana', { count: aperturas, ventana })}</dd>
            </>
          )}
        </div>
      </dl>
    )
  }

  return (
    <section
      aria-labelledby="condiciones-titulo"
      className="superficie col-span-4 flex min-w-0 flex-col p-4 lg:col-span-5 xl:p-5"
    >
      <h2 id="condiciones-titulo" className="sr-only">
        {t('dashboard.condicionesTitulo')}
      </h2>
      {contenido}
    </section>
  )
})
