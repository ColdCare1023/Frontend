import { memo, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, ChevronDown, DoorClosed, DoorOpen, Droplets, Hourglass, ThermometerSun } from 'lucide-react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { duracionBreve } from '@/lib/formato'
import { clsx } from 'clsx'
import { HoraLectura } from '../../components/HoraLectura'
import { Esqueleto } from '../../components/ui/esqueleto'
import { DECIMALES_HUMEDAD } from '../../components/ui/formato-cifra'
import { useSegundosDesde } from '../../hooks/useReloj'
import { aperturasEnSerie, estadoPuerta, fallaSensor } from './puerta'
import { submuestrear } from './utilidades'

/** Sparkline SVG en línea (PERF B3: sin ECharts). Decorativa: el valor ya se dice. */
function Sparkline({ valores, className }: { valores: readonly number[]; className?: string }) {
  if (valores.length < 2) return null
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
  textoDelta,
  mostrarTendencia,
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
  textoDelta: string
  mostrarTendencia: boolean
}) {
  const { t } = useTranslation()
  const fallo = fallaSensor(ultima, campo)
  const delta = valor != null && anterior?.[campo] != null ? valor - (anterior[campo] as number) : null
  const puntos = useMemo(
    () => submuestrear(serie.map((l) => l[campo]).filter((v): v is number => v != null && Number.isFinite(v))),
    [serie, campo],
  )
  return (
    <div className="flex min-w-0 flex-col sm:px-3 sm:first:pl-0 sm:last:pr-0">
      <dt className="flex items-center gap-1.5 text-meta font-medium text-muted">
        <Icono aria-hidden className="size-3.5 shrink-0" />
        <span className="break-words">{etiqueta}</span>
      </dt>
      {fallo || valor == null ? (
        <dd className="mt-1 text-meta font-medium text-warning-700">
          {/* El rol va en un span: un <dd> con role deja de ser dd y rompe el <dl> (axe definition-list). */}
          <span role={fallo ? 'alert' : 'status'} data-testid={`kpi-${campo}-sin-valor`}>
            {/* HU-33: la falla dice de qué sensor es; antes decía «No hay lectura de temperatura» también para la humedad. */}
            {fallo ? t(TEXTO_FALLA[campo]) : t('dashboard.sinLecturaDisponible')}
          </span>
        </dd>
      ) : (
        <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className={clsx('nums text-metric', desactualizado ? 'text-muted' : 'text-foreground')}>
            {valor.toFixed(decimales)}
          </span>
          <span className="text-body font-medium text-muted">{unidad}</span>
          {mostrarTendencia && delta != null && Math.abs(delta) >= 0.05 && (
            <span className="nums inline-flex items-center text-micro text-faint">
              {delta > 0 ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
              {Math.abs(delta).toFixed(1)}
              <span className="sr-only"> {unidad} · {textoDelta}</span>
            </span>
          )}
        </dd>
      )}
      {/* Dentro de un <dd>: un <dl> solo admite dt/dd (axe definition-list). */}
      {mostrarTendencia && puntos.length >= 2 && <dd aria-hidden className="mt-auto pt-2 text-subtle">
        <Sparkline valores={puntos} />
      </dd>}
    </div>
  )
}

/** HU-33: texto de falla de cada KPI del SHT31. */
const TEXTO_FALLA: Record<'temperatura_ambiental' | 'humedad_ambiental', string> = {
  temperatura_ambiental: 'dashboard.fallaSensorAmbiente',
  humedad_ambiental: 'dashboard.fallaSensorHumedad',
}

/** «1 h», «24 h» o «7 d»: la misma etiqueta del selector de la curva. */
function ventanaCorta(horas: number, t: (clave: string) => string): string {
  if (horas === 1) return t('dashboard.ventana1h')
  if (horas === 24) return t('dashboard.ventana24h')
  return t('dashboard.ventana7d')
}

/** Marcas verticales de cada apertura de la ventana (HU-35 esc. 3). */
function TiraAperturas({ serie, umbral, desde, hasta }: { serie: readonly LecturaTermica[]; umbral: number; desde: number; hasta: number }) {
  const marcas = useMemo(() => aperturasEnSerie(serie, umbral), [serie, umbral])
  if (marcas.length === 0) return null
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
  umbralPuertaEquipo = null,
  recorte = null,
  puertaEnVivo = null,
}: {
  ultima: LecturaTermica | null
  serie: readonly LecturaTermica[]
  cargando: boolean
  desactualizado: boolean
  ventana: string
  horasVentana: number
  /** HU-35: umbral del backend para el equipo (estado operativo), si la lectura no lo trae. */
  umbralPuertaEquipo?: number | null
  /** HU-31: el historial crudo no cubre la ventana; el conteo de aperturas es parcial. */
  recorte?: { mostradas: number; total: number } | null
  /** HU-35 esc. 1: cambio de puerta en vivo (evento SSE `puerta`) del equipo mostrado. */
  puertaEnVivo?: { abierta: boolean; desde: string } | null
}) {
  const { t } = useTranslation()
  const [mostrarTendencia, setMostrarTendencia] = useState(false)
  const idDatos = useId()
  const segundosDesdeUltima = useSegundosDesde(ultima?.timestamp)
  const segundosDesdePuerta = useSegundosDesde(puertaEnVivo?.desde)
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
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {[
          [ThermometerSun, t('dashboard.ambienteCorto')],
          [Droplets, t('dashboard.humedadCorta')],
          [DoorClosed, t('dashboard.puerta')],
        ].map(([Icono, etiqueta]) => {
          const I = Icono as React.ComponentType<{ className?: string }>
          return (
            <div key={etiqueta as string} className="flex min-w-0 flex-col sm:px-3 sm:first:pl-0 sm:last:pr-0">
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
    const puerta = estadoPuerta(
      ultima, segundosDesdeUltima, desactualizado, umbralPuertaEquipo,
      puertaEnVivo ? { ...puertaEnVivo, segundosDesde: segundosDesdePuerta } : null,
    )
    const hasta = Date.parse(ultima.timestamp) || 0
    const aperturas = puerta.sinSensor ? 0 : aperturasEnSerie(serie, puerta.umbral).length
    contenido = (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:divide-x sm:divide-border">
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
          mostrarTendencia={mostrarTendencia}
          textoDelta={t('dashboard.variacionVsAnterior')}
        />
        <Metrica
          icono={Droplets}
          etiqueta={t('dashboard.humedadCorta')}
          valor={ultima.humedad_ambiental}
          unidad="%"
          decimales={DECIMALES_HUMEDAD}
          campo="humedad_ambiental"
          ultima={ultima}
          anterior={anterior}
          serie={serie}
          desactualizado={desactualizado}
          mostrarTendencia={mostrarTendencia}
          textoDelta={t('dashboard.variacionVsAnterior')}
        />
        <div className="col-span-2 flex min-w-0 flex-col sm:col-span-1 sm:px-3 sm:first:pl-0 sm:last:pr-0">
          <dt className="flex items-center gap-1.5 text-meta font-medium text-muted">
            {puerta.abiertaAhora ? (
              <DoorOpen className="size-3.5 shrink-0 text-warning-600" aria-hidden />
            ) : (
              <DoorClosed className="size-3.5 shrink-0" aria-hidden />
            )}
            {t('dashboard.puerta')}
          </dt>
          <dd className={clsx('mt-1 text-title', puerta.abiertaAhora ? 'text-warning-700' : 'text-foreground')}>
            {/* Rol y testid en un span interno: un <dd> con role rompe el <dl> (axe definition-list). */}
            <span
              role={!desactualizado && puerta.aperturaProlongada ? 'alert' : undefined}
              data-testid={puerta.abiertaAhora ? 'puerta-advertencia' : undefined}
            >
            {puerta.sinSensor
              ? t('dashboard.puertaSinDato')
              : puerta.abiertaAhora
                ? t('dashboard.puertaAbierta')
                : t('dashboard.puertaCerrada')}
            {puerta.aperturaEnCurso != null && (
              <span className={clsx('nums ml-1 text-meta font-normal', puerta.aperturaProlongada ? 'text-danger-700' : 'text-muted')}>
                · {t(desactualizado ? 'medicion.duracionRegistrada' : 'dashboard.puertaDesdeHace', { duracion: duracionBreve(puerta.aperturaEnCurso) })}
                {!desactualizado && puerta.aperturaProlongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}
              </span>
            )}
            {!puerta.conAperturaContinua && ultima.apertura_refrigerador && ultima.duracion_apertura_segundos != null && (() => {
              const duracion = ultima.duracion_apertura_segundos
              const prolongada = duracion >= puerta.umbral
              return (
                <span className={clsx('nums ml-1 text-meta font-normal', prolongada ? 'text-danger-700' : 'text-muted')}>
                  · {duracionBreve(duracion)}
                  {!desactualizado && prolongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}
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
                {t(desactualizado ? 'medicion.umbralSuperado' : 'dashboard.puertaSuperaUmbral', { segundos: puerta.umbral })}
              </span>
            )}
            </span>
          </dd>
          {!puerta.sinSensor && (
            <>
              {mostrarTendencia && <dd className="mt-auto">
                <TiraAperturas serie={serie} umbral={puerta.umbral} desde={hasta - horasVentana * 3_600_000} hasta={hasta} />
              </dd>}
              {/* «5 aperturas · 24 h» cabe en la columna; la frase larga queda en el title. Con el
                  historial recortado el conteo es un mínimo («≥5»), no el total de la ventana. */}
              <dd
                className="nums mt-1 text-micro text-muted"
                title={
                  recorte
                    ? t('dashboard.aperturasVentanaParcial', { count: aperturas, ventana, mostradas: recorte.mostradas.toLocaleString() })
                    : t('dashboard.aperturasVentana', { count: aperturas, ventana })
                }
              >
                {t(recorte ? 'dashboard.aperturasCortoParcial' : 'dashboard.aperturasCorto', {
                  count: aperturas,
                  ventana: ventanaCorta(horasVentana, t).replace(' ', '\u00a0'),
                })}
              </dd>
            </>
          )}
        </div>
      </dl>
    )
  }

  return (
    <section
      aria-labelledby="condiciones-titulo"
      className="flex min-w-0 flex-col"
    >
      <h2 id="condiciones-titulo" className="mb-3 text-title text-foreground">
        {t('dashboard.condicionesTitulo')}
      </h2>
      {desactualizado && ultima && (
        <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-meta text-muted">
          {t('dashboard.ultimaLecturaHora')} <HoraLectura lectura={ultima} formato="fechaHora" />
        </p>
      )}
      <div id={idDatos}>{contenido}</div>
      {ultima && (
        <button
          type="button"
          aria-expanded={mostrarTendencia}
          aria-controls={idDatos}
          onClick={() => setMostrarTendencia((actual) => !actual)}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-sm text-meta font-medium text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {t('operacionFarmacia.variaciones', 'Variaciones del periodo')}
          <ChevronDown aria-hidden className={clsx('size-3.5', mostrarTendencia && 'rotate-180')} />
        </button>
      )}
    </section>
  )
})
