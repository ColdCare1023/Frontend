import { memo, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { EChartsCoreOption } from 'echarts/core'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Clock3, DoorClosed, DoorOpen, Droplets, FlaskConical, RadioTower, ShieldQuestion, TableProperties, Thermometer, Wind } from 'lucide-react'

import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { useEstadoOperativo } from '@/application/hooks/useEstadoOperativo'
import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { apiClient } from '@/infrastructure/api/apiClient'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { temaGrafica } from '@/infrastructure/charts/temaColdCare'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/datosDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { duracionBreve, fechaHora, hora as formatearHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { AnuncioRiesgo } from '../components/AnuncioRiesgo'
import { EstadoCarga, EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'

// HU-35: el nodo entrega su umbral configurado; 120 s cubre respuestas de
// backends anteriores que todavía no publican este campo.
const UMBRAL_PUERTA_ABIERTA_POR_DEFECTO = 120

// HU-33 criterio 2: a partir de este umbral sin una lectura nueva, el dato
// mostrado se marca como desactualizado — no basta con "hay un valor", tiene
// que seguir siendo reciente. El doble del intervalo de muestreo (30 s) deja
// margen a la latencia normal de red sin disparar falsos positivos.
const UMBRAL_FRESCURA_SEGUNDOS = 90

// HU-31 criterio 4: opciones de rango para la curva térmica del dashboard.
// 24 h es el valor por defecto exigido por el criterio; las demás son la
// forma de "ampliar o modificar el rango" que pide el mismo criterio sin
// duplicar el panel de filtros completo de HU-36 (ese vive en Historial,
// sobre datos ya cerrados — este es el propio monitoreo en vivo).
const OPCIONES_VENTANA_HORAS = [1, 24, 24 * 7] as const

function TarjetaMetrica({
  etiqueta,
  valor,
  unidad,
  icono: Icono,
  delta,
  retraso = 0,
  destacada = false,
  // HU-33 criterio 3: cuando el sensor de ESTA métrica falla, no se muestra
  // un valor null como si fuera "sin dato" genérico — se dice explícitamente
  // que el sensor falló, para no confundirlo con "todavía no llegó nada".
  fallaSensor = false,
  textoFallaSensor,
  sinLectura = false,
  textoSinLectura,
  // HU-33 criterio 2: dato presente pero desactualizado — distinto de
  // `fallaSensor` (dato ausente porque el sensor falló). Se atenúa la
  // tarjeta y se avisa, en vez de mostrar un número viejo como si fuera
  // vigente.
  desactualizado = false,
  textoDesactualizado,
  textoDelta,
  // HU-32 criterio 4: indicador "En vivo/Tiempo real" JUNTO AL VALOR (no solo
  // en la cabecera de la página), con el timestamp de la última
  // actualización, para que no haya ambigüedad entre una lectura activa y
  // una desconectada/congelada. Solo se pasa en la tarjeta principal.
  enVivo,
}: {
  etiqueta: string
  valor: string
  unidad: string
  icono: React.ComponentType<{ className?: string }>
  delta?: number | null
  retraso?: number
  destacada?: boolean
  fallaSensor?: boolean
  textoFallaSensor?: string
  sinLectura?: boolean
  textoSinLectura?: string
  desactualizado?: boolean
  textoDesactualizado?: string
  textoDelta?: string
  enVivo?: { conectado: boolean; texto: string }
}) {
  return (
    <Card
      className={cn(
        'rounded-none border-0 bg-transparent shadow-none',
        destacada && !fallaSensor && !sinLectura && !desactualizado && 'border-pine-200 bg-primary-tint/50',
        (fallaSensor || sinLectura) && 'border-clay-200 bg-clay-50/40',
        !fallaSensor && !sinLectura && desactualizado && 'opacity-60',
      )}
      style={{ animationDelay: `${retraso}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex min-h-5 items-start justify-between gap-2">
          <p className="text-sm leading-5 font-medium text-muted">{etiqueta}</p>
          <span className={cn('flex size-7 items-center justify-center', fallaSensor || sinLectura || desactualizado ? 'text-accent' : destacada ? 'text-secondary' : 'text-faint')}>
            {fallaSensor || sinLectura || desactualizado ? (
              <AlertTriangle className="size-4" />
            ) : (
              <Icono className="size-4" />
            )}
          </span>
        </div>
        {fallaSensor || sinLectura ? (
          <p role={fallaSensor ? 'alert' : 'status'} className="mt-2 rounded-md border-l-2 border-accent bg-accent-tint px-2.5 py-2 text-sm font-medium leading-snug text-clay-700">
            {fallaSensor ? textoFallaSensor : textoSinLectura}
          </p>
        ) : (
          <>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-2">
              <span className="nums text-[26px] sm:text-[28px] font-semibold leading-none tracking-tight">
                {valor}
              </span>
              <span className="text-sm text-muted">{unidad}</span>
              {delta != null && Math.abs(delta) >= 0.05 && (
                <span
                  className="nums ml-auto flex items-center gap-0.5 text-xs font-medium text-muted"
                >
                  {delta > 0 ? <ArrowUpRight aria-hidden className="size-3.5" /> : <ArrowDownRight aria-hidden className="size-3.5" />}
                  {Math.abs(delta).toFixed(1)} °C
                </span>
              )}
            </p>
            {delta != null && Math.abs(delta) >= 0.05 && textoDelta && (
              <p className="mt-1 text-right text-xs text-muted">{textoDelta}</p>
            )}
            {desactualizado && (
              <p className="mt-1 rounded-md border-l-2 border-accent bg-accent-tint px-2.5 py-1.5 text-xs font-medium leading-snug text-clay-700">
                {textoDesactualizado}
              </p>
            )}
            {enVivo && !desactualizado && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <span className="relative flex size-1.5">
                  {enVivo.conectado && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glacier-600 opacity-60" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex size-1.5 rounded-full',
                      enVivo.conectado ? 'bg-glacier-600' : 'bg-faint',
                    )}
                  />
                </span>
                {enVivo.texto}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EstadoPrincipal({
  ultima,
  riesgo,
  segundosDesdeUltima,
  desactualizado,
}: {
  ultima: LecturaTermica
  riesgo: LecturaTermica['riesgo_efectivo']
  segundosDesdeUltima: number | null
  desactualizado: boolean
}) {
  const { t } = useTranslation()
  const lectura = ultima.temperatura_interna
  const minimoIndicador = 0
  const maximoIndicador = 10
  const lecturaFinita = lectura != null && Number.isFinite(lectura)
  const fueraDeEscala = lecturaFinita && (lectura < minimoIndicador || lectura > maximoIndicador)
  const porcentaje = !lecturaFinita
    ? 50
    : Math.max(minimoIndicador, Math.min(maximoIndicador, lectura)) * 10
  const colorIndicador = riesgo === 'excursion_critica'
    ? 'var(--color-clay-600)'
    : riesgo === 'riesgo_preventivo'
      ? 'var(--color-honey-600)'
      : 'var(--color-primary)'
  const sensorFallido = fallaSensor(ultima, 'temperatura_interna')
  const sinLectura = lectura == null
  const umbralConfigurado = ultima.umbral_puerta_abierta_segundos
  const umbralPuerta = typeof umbralConfigurado === 'number' && Number.isFinite(umbralConfigurado) && umbralConfigurado > 0
    ? umbralConfigurado
    : UMBRAL_PUERTA_ABIERTA_POR_DEFECTO
  const aperturaProlongada = ultima.apertura_refrigerador === true &&
    ultima.duracion_apertura_segundos != null && ultima.duracion_apertura_segundos >= umbralPuerta

  return (
    <Card className="overflow-hidden border-border bg-surface shadow-none">
      <CardContent className="grid gap-5 p-4 sm:p-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] sm:items-center">
        <section aria-labelledby="resumen-termico-titulo" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p id="resumen-termico-titulo" className="text-sm font-semibold text-foreground">
              {desactualizado ? t('dashboard.ultimaTemperatura') : t('dashboard.estadoRefrigerador')}
            </p>
            <RiskBadge nivel={riesgo} />
          </div>
          {riesgo
            ? <p className="mt-1.5 text-sm text-muted">
                {desactualizado
                  ? t('dashboard.riesgoUltimaLectura')
                  : t(`riesgo.detalle.${riesgo}`)}
              </p>
            : <p className="mt-1.5 text-sm text-muted">{t('dashboard.sinClasificacion')}</p>}
          {ultima.excursion_confirmada && (
            <p className="mt-1.5 text-xs font-semibold text-clay-700">{t('dashboard.excursionConfirmada')}</p>
          )}
          {!ultima.excursion_confirmada && ultima.nivel_riesgo === 'excursion_critica' && riesgo !== 'excursion_critica' && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-honey-700">
              <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('dashboard.clasificacionIaDivergente')}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            {sensorFallido || sinLectura ? (
              <p role={sensorFallido ? 'alert' : 'status'} className="text-sm font-medium text-clay-700">
                {sensorFallido ? t('dashboard.fallaSensor') : t('dashboard.sinLecturaDisponible')}
              </p>
            ) : (
              <>
                <span className="mb-1 flex size-8 items-center justify-center text-muted" aria-hidden="true">
                  <Thermometer className="size-6" />
                </span>
                <p className="nums text-[48px] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[56px]">
                  {lectura?.toFixed(1) ?? '—'}
                </p>
                <span className="pb-1 text-xl font-medium text-muted">°C</span>
              </>
            )}
          </div>
          <div className="mt-4 max-w-[340px]" aria-hidden="true">
            <div className="relative h-2 rounded-full bg-cream-200">
              <span className="absolute inset-y-0 left-[20%] w-[60%] bg-secondary/40" />
              {lecturaFinita && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{left: `${porcentaje}%`, background: colorIndicador}} />}
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted"><span>0 °C</span><span>{t('dashboard.rangoConservacion')}</span><span>10 °C</span></div>
          </div>
          {fueraDeEscala && lectura != null && (
            <p role="note" className="mt-2 rounded-md border-l-2 border-accent bg-accent-tint px-2.5 py-1.5 text-xs font-medium text-clay-700">
              {lectura > maximoIndicador
                ? t('dashboard.lecturaSobreEscala', { temperatura: lectura.toFixed(1) })
                : t('dashboard.lecturaBajoEscala', { temperatura: lectura.toFixed(1) })}
            </p>
          )}
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className={cn('size-2 rounded-full', desactualizado ? 'bg-clay-600' : 'bg-success-600')} />
            {desactualizado
              ? t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })
              : t('dashboard.lecturaReciente', { s: segundosDesdeUltima })}
            <span aria-hidden="true">·</span>
            <span>{t('dashboard.ultimaLecturaHora')}:</span>
            <time dateTime={ultima.timestamp}>{formatearHora(ultima.timestamp)}</time>
          </p>
        </section>


        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-1 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
          <div className="py-1.5">
            <dt className="flex items-center gap-2 text-xs font-medium text-muted">{ultima.apertura_refrigerador ? <DoorOpen className="size-4 text-honey-600" aria-hidden /> : <DoorClosed className="size-4 text-primary" aria-hidden />}{t('dashboard.puerta')}</dt>
            <dd
              className={cn('mt-2 text-sm font-semibold', ultima.apertura_refrigerador ? 'text-honey-700' : 'text-foreground')}
              role={aperturaProlongada ? 'alert' : undefined}
              data-testid={ultima.apertura_refrigerador ? 'puerta-advertencia' : undefined}
            >
              {ultima.apertura_refrigerador === null
                ? t('dashboard.puertaSinDato')
                : ultima.apertura_refrigerador
                  ? t('dashboard.puertaAbierta')
                  : t('dashboard.puertaCerrada')}
              {ultima.apertura_refrigerador && ultima.duracion_apertura_segundos != null && (() => {
                const duracion = ultima.duracion_apertura_segundos
                const prolongada = duracion >= umbralPuerta
                return <span className={cn('nums ml-1 font-normal', prolongada ? 'text-clay-700' : 'text-muted')}>· {duracionBreve(duracion)}{prolongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}</span>
              })()}
              {aperturaProlongada && (
                <span className="mt-1 block text-xs font-medium text-clay-700">
                  {t('dashboard.puertaSuperaUmbral', { segundos: umbralPuerta })}
                </span>
              )}
            </dd>
          </div>
          <div className="py-1.5">
            <dt className="flex items-center gap-2 text-xs font-medium text-muted"><RadioTower className="size-4 text-primary" aria-hidden />{t('dashboard.conexionEquipo')}</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              <Badge variant={ultima.estado_conectividad === 'online' ? 'ok' : 'neutral'} dot data-testid="conectividad-dispositivo">
                {ultima.estado_conectividad === 'online' ? t('dashboard.dispositivoOnline') : t('dashboard.dispositivoOffline')}
              </Badge>
            </dd>
            <dd className="nums mt-1 break-all text-xs text-faint">{ultima.device_id}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

// HU-33 criterio 3: `estado_sensores` distingue un sensor que falló
// (invalido/fisicamente_imposible/ausente) de uno que simplemente no aplica
// a esta lectura — un valor `null` sin más contexto es indistinguible de
// "aún no llegó el dato", que es justo la confusión que la historia pide
// evitar.
function fallaSensor(lectura: LecturaTermica, campo: string): boolean {
  const estado = lectura.estado_sensores?.[campo]
  return estado !== undefined && estado !== null && estado !== 'valido'
}

function construirOpcionCurva(serie: LecturaTermica[], etiquetas: {
  interna: string
  ambiental: string
  rangoEsperado: string
}): EChartsCoreOption {
  const horas = serie.map((l) => l.timestamp)
  const colores = temaGrafica()
  return {
    // Range controls update the dataset in place; keep the curve stable instead
    // of fading out and animating every point between unrelated time scales.
    animation: false,
    textStyle: { fontFamily: 'Inter Variable, sans-serif', color: colores.foreground },
    grid: { left: 44, right: 40, top: 32, bottom: 28 },
    tooltip: {
      confine: true,
      trigger: 'axis',
      axisPointer: { label: { formatter: ({ value }: { value: string | number }) => fechaHora(String(value)) } },
      backgroundColor: colores.surface,
      borderColor: colores.border,
      textStyle: { color: colores.foreground, fontSize: 12, fontFamily: 'Inter Variable, sans-serif' },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} °C` : '—'),
    },
    legend: {
      selected: { [etiquetas.ambiental]: false },
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 3,
      formatter: etiquetaCortaTemperatura,
      textStyle: { color: colores.muted, fontSize: 12, fontFamily: 'Inter Variable, sans-serif' },
    },
    xAxis: {
      type: 'category',
      data: horas,
      boundaryGap: false,
      axisLine: { lineStyle: { color: colores.border } },
      axisTick: { show: false },
      axisLabel: { formatter: (value: string) => formatearHora(value), fontSize: 11, color: colores.muted, fontFamily: 'Inter Variable, sans-serif' },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(Math.min(value.min, 0)),
      max: (value: { max: number }) => Math.ceil(Math.max(value.max, 10)),
      splitLine: { lineStyle: { color: colores.grid } },
      axisLabel: { fontSize: 11, color: colores.muted, fontFamily: 'Inter Variable, sans-serif', formatter: '{value} °C' },
    },
    series: [
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: false,
        symbol: 'none',
        // HU-31 criterio 3: con la ventana ampliada a días, miles de puntos
        // continuos se muestrean automáticamente (LTTB conserva la forma
        // real de la tendencia, a diferencia de un promedio simple) para que
        // la interfaz siga fluida sin perder picos ni caídas relevantes.
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_interna),
        lineStyle: { width: 2.5, color: colores.primary },
        itemStyle: { color: colores.primary },
        areaStyle: { color: colores.primary, opacity: 0.1 },
        markArea: {
          silent: true,
          itemStyle: { color: colores.primary, opacity: 0.06 },
          label: { show: true, position: 'insideTop', color: colores.primary, fontSize: 10, formatter: etiquetas.rangoEsperado },
          data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          // Tono `clay-700` existente: mantiene semántica de excursión crítica.
          lineStyle: { color: colores.critical, type: 'dashed', width: 1 },
          label: { color: colores.critical, fontSize: 10, fontFamily: 'Inter Variable, sans-serif', formatter: '{c} °C' },
          data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 14,
          itemStyle: { color: colores.critical, borderColor: colores.surface, borderWidth: 2 },
          label: { show: true, formatter: '!', color: '#FFFFFF', fontWeight: 700, fontSize: 10 },
          data: serie.flatMap((lectura, indice) => lectura.excursion_confirmada && lectura.temperatura_interna != null
            ? [{ coord: [horas[indice], lectura.temperatura_interna], name: 'Excursión confirmada' }]
            : []),
        },
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: false,
        symbol: 'none',
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_ambiental),
        lineStyle: { width: 1.5, color: colores.secondary, type: 'dashed' },
        itemStyle: { color: colores.secondary },
      },
    ],
  }
}

function etiquetaCortaTemperatura(nombre: string): string {
  return nombre
    .replace(/^temperatura\s+/i, '')
    .replace(/\s+temperature$/i, '')
}

function EstadoEquiposIoT({ equipos }: { equipos: Dispositivo[] }) {
  const { t } = useTranslation()
  if (equipos.length === 0) return null

  return (
    <Card className="rounded-(--radius-card) border-border bg-surface">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <RadioTower className="mt-0.5 size-5 shrink-0 text-glacier-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
              <p className="text-sm font-semibold text-foreground">{t('dashboard.estadoIoTTitulo')}</p>
              <p className="text-xs text-muted">{t('dashboard.estadoIoTDetalle')}</p>
            </div>
            <ul className="mt-2 grid gap-3 md:grid-cols-2">
              {equipos.map((dispositivo) => {
                const buffer = dispositivo.buffer_littlefs
                const pendientes = buffer?.pendientes ?? 0
                const perdidas = buffer?.perdidas ?? 0
                const incidentes = dispositivo.incidencias_operativas ?? []
                const incidenteActivo = incidentes.find((incidente) => incidente.estado === 'activo')
                const incidentesResueltos = incidentes.filter((incidente) => incidente.estado === 'resuelto')

                return (
                  <li key={dispositivo.id} className="border-t border-glacier-200 pt-2 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-semibold">{dispositivo.nombre || dispositivo.id}</span>
                      <span className="font-mono text-xs text-muted">{dispositivo.id}</span>
                      {dispositivo.estado_operativo === 'SIN_DATOS' && (
                        <Badge variant="critical">
                          {t('dashboard.estadoSinDatos', {
                            segundos: incidenteActivo?.umbral_silencio_segundos ?? dispositivo.umbral_sin_datos_segundos ?? 90,
                          })}
                        </Badge>
                      )}
                      {dispositivo.estado_operativo === 'FALLA_SENSOR' && <Badge variant="critical">{t('dispositivos.estadoOperativo.FALLA_SENSOR')}</Badge>}
                      {dispositivo.estado_operativo === 'OPERATIVO' && incidentesResueltos.length > 0 && <Badge variant="ok">{t('dispositivos.estadoOperativo.OPERATIVO')}</Badge>}
                    </div>
                    {incidenteActivo && (
                      <p role="status" className="mt-1.5 text-xs font-medium text-clay-700">
                        {t('dashboard.alertaSilencio', {
                          fecha: fechaHora(incidenteActivo.detectado_en),
                          segundos: incidenteActivo.umbral_silencio_segundos,
                        })}
                      </p>
                    )}
                    {dispositivo.estado_operativo === 'SIN_DATOS' && (
                      <p className="mt-1 text-xs text-muted">
                        {dispositivo.ultimo_reporte_en
                          ? t('dashboard.ultimoDatoOperativo', { fecha: fechaHora(dispositivo.ultimo_reporte_en) })
                          : t('dashboard.nuncaReporto')}
                      </p>
                    )}
                    {buffer && (
                      <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
                        {pendientes > 0 ? (
                          <span>{t('dispositivos.bufferLittlefs', { n: pendientes, max: buffer.limite })}</span>
                        ) : buffer.ultima_sincronizacion_en ? (
                          <span className="text-success-700">
                            {t('dashboard.sinPendientes', { fecha: fechaHora(buffer.ultima_sincronizacion_en) })}
                          </span>
                        ) : null}
                        {buffer.desde && (
                          <span>
                            {t('dispositivos.rangoBuffer', {
                              desde: fechaHora(buffer.desde),
                              hasta: buffer.hasta ? fechaHora(buffer.hasta) : '—',
                            })}
                          </span>
                        )}
                        {perdidas > 0 && (
                          <span className="font-semibold text-honey-600">
                            {t('dispositivos.perdidas', { n: perdidas })}
                          </span>
                        )}
                        {buffer.brechas?.slice(-2).map((brecha) => (
                          <span key={`${brecha.desde}-${brecha.hasta}`} className="rounded-md bg-critical-tint px-2 py-1 text-clay-700">
                            {t('dashboard.brechaBuffer', { n: brecha.muestras_perdidas })} · {t('dashboard.causaBufferAgotado')}
                            <span className="mt-0.5 block font-normal">
                              {t('dashboard.periodoBrecha', {
                                desde: fechaHora(brecha.desde),
                                hasta: fechaHora(brecha.hasta),
                              })}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {incidentesResueltos.length > 0 && (
                      <details className="group mt-2 text-xs text-muted">
                        <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded px-1 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                          {t('dashboard.incidentesRecientes', { n: incidentesResueltos.length })}
                          <ChevronDown className="size-3.5" aria-hidden />
                        </summary>
                        <ul className="mt-1 space-y-1 pl-3">
                          {incidentesResueltos.slice(-3).map((incidente) => (
                            <li key={incidente.id}>
                              {t('dashboard.incidenteRecuperado', { fecha: fechaHora(incidente.recuperado_en) })}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type EscenarioDashboard =
  | 'sin_datos'
  | 'buffer_pendiente'
  | 'buffer_lleno'
  | 'falla_sensor'
  | 'puerta_abierta'
  | 'puerta_cerrada'
  | 'recuperar'

const ESCENARIOS_DASHBOARD: Array<{ id: EscenarioDashboard; clave: string }> = [
  { id: 'sin_datos', clave: 'dashboard.demoSinDatos' },
  { id: 'buffer_pendiente', clave: 'dashboard.demoBufferPendiente' },
  { id: 'buffer_lleno', clave: 'dashboard.demoBufferLleno' },
  { id: 'falla_sensor', clave: 'dashboard.demoFallaSensor' },
  { id: 'puerta_abierta', clave: 'dashboard.demoPuertaAbierta' },
  { id: 'puerta_cerrada', clave: 'dashboard.demoPuertaCerrada' },
  { id: 'recuperar', clave: 'dashboard.demoRecuperar' },
]

function SimuladorDashboard({ onActualizado }: { onActualizado: () => Promise<void> }) {
  const { t } = useTranslation()
  const [ejecutando, setEjecutando] = useState<EscenarioDashboard | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [umbralSilencio, setUmbralSilencio] = useState(90)
  const [umbralPuerta, setUmbralPuerta] = useState(120)

  const ejecutar = async (escenario: EscenarioDashboard) => {
    setEjecutando(escenario)
    setMensaje(null)
    try {
      await apiClient.post(`/api/demo/dispositivos/${DISPOSITIVO_DEMO}/simulacion`, {
        escenario,
        umbral_sin_datos_segundos: umbralSilencio,
        umbral_puerta_abierta_segundos: umbralPuerta,
      })
      await onActualizado()
      setMensaje({ tipo: 'ok', texto: t('dashboard.demoAplicado') })
    } catch {
      setMensaje({ tipo: 'error', texto: t('dashboard.demoError') })
    } finally {
      setEjecutando(null)
    }
  }

  if (!MODO_DEMO) return null

  return (
    <details className="group mb-4 rounded-xl border border-border bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-cream-100/70 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <FlaskConical className="size-4 text-primary" aria-hidden />
          {t('dashboard.demoTitulo')}
          <span className="rounded-full bg-[#E9F8FF] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-glacier-600">
            {t('demo.badge')}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-3">
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted">{t('dashboard.demoAyuda')}</p>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-muted" htmlFor="umbral-silencio-demo">
            {t('dashboard.umbralSilencio')}
            <select
              id="umbral-silencio-demo"
              className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              disabled={ejecutando !== null}
              value={umbralSilencio}
              onChange={(event) => setUmbralSilencio(Number(event.target.value))}
            >
              <option value={60}>60 s</option>
              <option value={90}>90 s</option>
              <option value={180}>180 s</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted" htmlFor="umbral-puerta-demo">
            {t('dashboard.umbralPuerta')}
            <select
              id="umbral-puerta-demo"
              className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              disabled={ejecutando !== null}
              value={umbralPuerta}
              onChange={(event) => setUmbralPuerta(Number(event.target.value))}
            >
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
              <option value={300}>5 min</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {ESCENARIOS_DASHBOARD.map(({ id, clave }) => (
            <Button
              key={id}
              type="button"
              variant={id === 'recuperar' ? 'primary' : 'secondary'}
              size="sm"
              className={cn('justify-center', id === 'recuperar' && 'sm:col-span-2 xl:col-span-2')}
              disabled={ejecutando !== null}
              onClick={() => void ejecutar(id)}
            >
              {ejecutando === id ? t('dashboard.demoAplicando') : t(clave)}
            </Button>
          ))}
        </div>
        {mensaje && (
          <p
            role={mensaje.tipo === 'error' ? 'alert' : 'status'}
            className={cn(
              'mt-3 text-xs font-medium',
              mensaje.tipo === 'error' ? 'text-clay-700' : 'text-success-700',
            )}
          >
            {mensaje.texto}
          </p>
        )}
      </div>
    </details>
  )
}

function resumenVentana(serie: LecturaTermica[]) {
  const temps = serie
    .map((l) => l.temperatura_interna)
    .filter((v): v is number => v != null)
  if (temps.length === 0) return null
  return {
    minima: Math.min(...temps),
    maxima: Math.max(...temps),
    promedio: temps.reduce((suma, v) => suma + v, 0) / temps.length,
    // HU-34: cuenta excursiones CONFIRMADAS por la regla directa de rango,
    // no por lo que haya clasificado la IA (`nivel_riesgo`/model_class).
    fueraDeRango: serie.filter((l) => l.excursion_confirmada).length,
  }
}

/**
 * Tabla accesible de datos para la curva del dashboard.
 * Las filas solo se convierten a texto mientras la tabla está abierta; el
 * componente memorizado tampoco se ejecuta en los ticks del reloj del padre.
 */
const TablaAlternativaMonitoreo = memo(function TablaAlternativaMonitoreo({
  serie,
  titulo,
}: {
  serie: LecturaTermica[]
  titulo: string
}) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const columnas = [
    t('historial.fecha'),
    t('dashboard.tempInterna'),
    t('dashboard.tempAmbiental'),
    t('historial.riesgo'),
    t('dashboard.eventoGrafica'),
  ]
  const filas = useMemo(
    () =>
      abierto
        ? serie.map((lectura) => [
            formatearHora(lectura.timestamp),
            lectura.temperatura_interna?.toFixed(1) ?? '—',
            lectura.temperatura_ambiental?.toFixed(1) ?? '—',
            lectura.riesgo_efectivo ? t(`riesgo.${lectura.riesgo_efectivo}`) : '—',
            lectura.excursion_confirmada ? t('dashboard.excursionEvento') : '—',
          ])
        : [],
    [abierto, serie, t],
  )

  if (serie.length === 0) return null

  return (
    <details
      id="curva-termica-datos"
      open={abierto}
      onToggle={(evento) => setAbierto(evento.currentTarget.open)}
      className="mt-4 border-t border-border pt-3"
    >
      <summary className="inline-flex cursor-pointer items-center gap-2 rounded-(--radius-field) text-[13px] font-medium text-pine-600 hover:text-pine-700">
        <TableProperties className="size-3.5" aria-hidden />
        {t('comunes.verDatosGrafica')}
      </summary>
      {abierto && (
        <div className="mt-3 max-h-72 overflow-auto rounded-(--radius-field) border border-border">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">{titulo}</caption>
            <thead className="sticky top-0 bg-cream-100">
              <tr>
                {columnas.map((columna, indice) => (
                  <th
                    key={columna}
                    scope="col"
                    className={cn(
                      'px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint',
                      indice > 0 && 'text-center',
                    )}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((fila, indice) => (
                <tr key={indice}>
                  {fila.map((celda, columna) => (
                    <td key={columna} className={cn('nums px-3 py-1.5', columna > 0 && 'text-center')}>
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
})

/** Nodo que reportó más recientemente; null si aún no hay ninguno. */
function equipoMasReciente(equipos: Dispositivo[]): string | null {
  const conReporte = equipos.filter((equipo) => equipo.ultimo_reporte_en)
  const candidatos = conReporte.length > 0 ? conReporte : equipos
  if (candidatos.length === 0) return null
  return [...candidatos].sort((a, b) =>
    Date.parse(b.ultimo_reporte_en ?? '') - Date.parse(a.ultimo_reporte_en ?? '') || a.id.localeCompare(b.id),
  )[0].id
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [horasVentana, setHorasVentana] = useState<number>(24)
  const { equipos: equiposConIncidencias, consultar: consultarEstadoOperativo } = useEstadoOperativo()
  // HU-31/HU-33: el dashboard muestra UN refrigerador a la vez. Por defecto,
  // el que reportó más recientemente; con más de uno, se elige en el selector.
  const { equipos } = useEstadoOperativo(true)
  const [equipoElegido, setEquipoElegido] = useState<string | null>(null)
  const deviceId = equipoElegido ?? equipoMasReciente(equipos)
  const { ultima, serie, sseConectado, estadoHistorial, reintentar } = useMonitoreoTermico(horasVentana, deviceId)
  const estadoIoTPrincipal =
    equipos.find((equipo) => equipo.id === deviceId) ??
    equiposConIncidencias.find((equipo) => equipo.id === (deviceId ?? DISPOSITIVO_DEMO))
  const previa = serie.at(-2) ?? null
  const resumen = useMemo(() => resumenVentana(serie), [serie])
  const lecturasRecientes = useMemo(
    () => [...serie].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 4),
    [serie],
  )

  // HU-32 criterio 4 / HU-33 criterio 2: si "hace cuánto" solo se recalculara
  // al recibir una lectura nueva, se congelaría hasta la siguiente — este
  // tick lo mantiene avanzando aunque el dato no cambie, que es justo lo que
  // distingue una lectura vigente de una congelada/desconectada.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const segundosDesdeUltima = ultima ? Math.max(0, Math.floor((ahora - new Date(ultima.timestamp).getTime()) / 1000)) : null
  const datoDesactualizado = estadoIoTPrincipal?.estado_operativo === 'SIN_DATOS' ||
    (segundosDesdeUltima != null && segundosDesdeUltima >= UMBRAL_FRESCURA_SEGUNDOS)

  const deltaDe = (
    actual: number | null | undefined,
    anterior: number | null | undefined,
  ): number | null =>
    actual != null && anterior != null ? actual - anterior : null

  const opcionCurva = useMemo(
    () =>
      construirOpcionCurva(serie, {
        interna: t('dashboard.tempInterna'),
        ambiental: t('dashboard.tempAmbiental'),
        rangoEsperado: t('dashboard.rangoEsperadoCorto'),
      }),
    [serie, t],
  )

  const actualizarDemo = async () => {
    await consultarEstadoOperativo()
    reintentar()
  }

  return (
    <div>
      {/* RF-11 + WCAG 4.1.3: la excursión térmica que llega por SSE se anuncia.
          HU-34: se anuncia el riesgo EFECTIVO, no la clase cruda de la IA —
          es lo que decide si hay que actuar, no lo que opinó el modelo. */}
      <AnuncioRiesgo
        nivel={datoDesactualizado ? null : ultima?.riesgo_efectivo ?? null}
        temperatura={datoDesactualizado ? null : ultima?.temperatura_interna}
      />

      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('dashboard.titulo')} descripcion={t('dashboard.descripcion')}>
        {equipos.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            {t('dashboard.equipo')}
            <select
              value={deviceId ?? ''}
              onChange={(evento) => setEquipoElegido(evento.target.value)}
              className="min-h-11 rounded-(--radius-field) border border-border bg-surface px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary sm:min-h-9"
            >
              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre ? `${equipo.nombre} (${equipo.id})` : equipo.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
            sseConectado
              ? 'border-glacier-200 bg-glacier-100 text-glacier-700'
              : 'border-honey-600/25 bg-honey-100 text-honey-700',
          )}
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                sseConectado ? 'bg-glacier-600' : 'bg-honey-600',
              )}
            />
          </span>
          {sseConectado ? t('dashboard.actualizacionActiva') : t('dashboard.actualizacionReconectando')}
        </span>
      </PageHeader>

      {estadoHistorial === 'error' && (
        <div className="mb-4">
          <EstadoError mensaje={t('dashboard.errorHistorial')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reintentar}>
              {t('comunes.reintentar')}
            </Button>
          </EstadoError>
        </div>
      )}

      {/* El estado del nodo no depende de que exista una lectura térmica para
          mostrar: una cámara sin telemetría también debe aparecer aquí. */}
      {!ultima && estadoHistorial !== 'cargando' && <EstadoEquiposIoT equipos={equiposConIncidencias} />}

      {ultima === null && estadoHistorial === 'cargando' ? (
        <EstadoCarga variant="dashboard">
          {equiposConIncidencias.length > 0
            ? <EstadoEquiposIoT equipos={equiposConIncidencias} />
            : <div aria-hidden className="h-52 rounded-(--radius-card) border border-border bg-surface p-5"><div className="h-4 w-48 rounded bg-cream-200" /><div className="mt-6 h-4 w-64 max-w-full rounded bg-cream-200" /></div>}
        </EstadoCarga>
      ) : ultima === null && estadoHistorial === 'error' ? null : ultima === null ? (
        <Card className="animate-rise">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-cream-200 text-faint">
              <RadioTower className="size-6" />
            </span>
            <p className="font-medium text-foreground">{t('dashboard.esperandoDatos')}</p>
            <p className="max-w-sm text-sm text-muted">{t('dashboard.esperandoDetalle')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
          <EstadoPrincipal
            ultima={ultima}
            riesgo={ultima.riesgo_efectivo}
            segundosDesdeUltima={segundosDesdeUltima}
            desactualizado={datoDesactualizado}
          />

          {/* El bloque principal prioriza estado y temperatura. Estas métricas
              quedan como contexto secundario para una lectura rápida. */}
          <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-(--radius-card) border border-border bg-surface xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
            <TarjetaMetrica
              etiqueta={t('dashboard.tempAmbiental')}
              valor={ultima.temperatura_ambiental?.toFixed(1) ?? '—'}
              unidad="°C"
              icono={Wind}
              delta={deltaDe(ultima.temperatura_ambiental, previa?.temperatura_ambiental)}
              textoDelta={t('dashboard.variacionVsAnterior')}
              retraso={60}
              fallaSensor={fallaSensor(ultima, 'temperatura_ambiental')}
              textoFallaSensor={t('dashboard.fallaSensor')}
              sinLectura={ultima.temperatura_ambiental == null && !fallaSensor(ultima, 'temperatura_ambiental')}
              textoSinLectura={t('dashboard.sinLecturaDisponible')}
              desactualizado={datoDesactualizado}
              textoDesactualizado={t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })}
            />
            <TarjetaMetrica
              etiqueta={t('dashboard.humedad')}
              valor={ultima.humedad_ambiental?.toFixed(0) ?? '—'}
              unidad="%"
              fallaSensor={fallaSensor(ultima, 'humedad_ambiental')}
              textoFallaSensor={t('dashboard.fallaSensor')}
              sinLectura={ultima.humedad_ambiental == null && !fallaSensor(ultima, 'humedad_ambiental')}
              textoSinLectura={t('dashboard.sinLecturaDisponible')}
              icono={Droplets}
              retraso={120}
              desactualizado={datoDesactualizado}
              textoDesactualizado={t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })}
            />
          </div>

          </div>

          {/* ── Curva térmica ───────────────────────────────── */}
          <div><Card className="min-w-0">
            <CardHeader className="gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
              <CardTitle>{t('dashboard.curvaTermica')}</CardTitle>
                <CardDescription>
                  {t('dashboard.ultimasLecturas', { n: serie.length })} ·{' '}
                  {t('dashboard.rangoConservacion')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* RF-18: el dashboard muestra el estado de conectividad del
                    dispositivo. Es distinto del indicador SSE de la cabecera,
                    que refleja la salud del stream del navegador, no la del nodo. */}
                {/* HU-31 criterio 4: ventana de 24 h por defecto, con opción
                    de ampliar o acotar sin salir del dashboard. */}
                {estadoHistorial === 'cargando' && ultima && (
                  <span role="status" className="text-xs text-muted">{t('app.cargando')}</span>
                )}
                <div role="group" aria-label={t('dashboard.rangoVentana')} className="flex gap-1">
                  {OPCIONES_VENTANA_HORAS.map((horas) => (
                    <button
                      key={horas}
                      type="button"
                      onClick={() => setHorasVentana(horas)}
                      aria-pressed={horasVentana === horas}
                      className={cn(
                        'min-h-11 rounded-(--radius-field) px-3 py-2 text-sm font-medium transition-colors',
                        horasVentana === horas
                          ? 'bg-pine-100 text-pine-700'
                          : 'text-faint hover:bg-cream-200 hover:text-muted',
                      )}
                    >
                      {horas === 1
                        ? t('dashboard.ventana1h')
                        : horas === 24
                          ? t('dashboard.ventana24h')
                          : t('dashboard.ventana7d')}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <EChartWrapper
                option={opcionCurva}
                height="260px"
                ariaLabel={t('dashboard.graficaEtiqueta', { n: serie.length })}
                ariaDescribedBy="curva-termica-datos"
              />
              <TablaAlternativaMonitoreo
                serie={serie}
                titulo={t('dashboard.graficaEtiqueta', { n: serie.length })}
              />

              {/* Resumen editorial de la ventana visible */}
              {resumen && (
                <dl className="mt-4 grid grid-cols-2 gap-y-3 border-t border-border pt-4 sm:grid-cols-4 sm:divide-x sm:divide-border">
                  {(
                    [
                      ['dashboard.resumenMinima', `${resumen.minima.toFixed(1)} °C`, false],
                      ['dashboard.resumenMaxima', `${resumen.maxima.toFixed(1)} °C`, false],
                      ['dashboard.resumenPromedio', `${resumen.promedio.toFixed(1)} °C`, false],
                      [
                        'dashboard.resumenFueraRango',
                        String(resumen.fueraDeRango),
                        resumen.fueraDeRango > 0,
                      ],
                    ] as const
                  ).map(([clave, valor, alerta]) => (
                    <div key={clave} className="px-3 text-center first:pl-0 last:pr-0">
                      <dt className="text-xs font-medium text-muted">{t(clave)}</dt>
                      <dd
                        className={cn(
                          'nums mt-1 text-lg font-semibold tracking-tight',
                          alerta && 'text-clay-600',
                        )}
                      >
                        {valor}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
          </div>
          {equiposConIncidencias.length > 0 && (
            <section className="mt-4 grid items-stretch gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('dashboard.estadoIoTTitulo')}</CardTitle>
                  <CardDescription>{t('dashboard.estadoIoTDetalle')}</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {equiposConIncidencias.map((equipo) => {
                    const ultimaLectura = equipo.ultimo_reporte_en ? fechaHora(equipo.ultimo_reporte_en) : '—'
                    const segundosSilencio = equipo.umbral_sin_datos_segundos ?? 90
                    const lecturasPendientes = equipo.buffer_littlefs?.pendientes ?? 0
                    const incidenteActivo = equipo.incidencias_operativas?.find((incidente) => incidente.estado === 'activo')
                    return (
                      <article key={equipo.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{equipo.nombre || equipo.id}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted">{equipo.id}</p>
                        </div>
                        <Badge variant={equipo.estado_operativo === 'OPERATIVO' ? 'ok' : 'critical'}>
                          {equipo.estado_operativo === 'SIN_DATOS'
                            ? t('dashboard.estadoSinDatos', { segundos: segundosSilencio })
                            : equipo.estado_operativo === 'FALLA_SENSOR'
                              ? t('dispositivos.estadoOperativo.FALLA_SENSOR')
                              : t('dispositivos.estadoOperativo.OPERATIVO')}
                        </Badge>
                      </div>
                      {incidenteActivo && <p role="status" className="mt-2 rounded-md border-l-2 border-accent bg-accent-tint px-2.5 py-1.5 text-xs font-medium text-clay-700">{t('dashboard.alertaSilencio', { fecha: fechaHora(incidenteActivo.detectado_en), segundos: incidenteActivo.umbral_silencio_segundos })}</p>}
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                        <div><dt className="text-muted">{t('dispositivos.ultimoReporte')}</dt><dd className="mt-0.5 font-medium">{ultimaLectura}</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.conectividad')}</dt><dd className="mt-0.5 font-medium">{equipo.estado_conectividad === 'online' ? t('dashboard.dispositivoOnline') : t('dashboard.dispositivoOffline')}</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.fallasSensor')}</dt><dd className="mt-0.5 font-medium">{(equipo.sensores ?? []).filter((sensor) => sensor.estado === 'error').length}</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.bufferLittlefs', { n: lecturasPendientes, max: equipo.buffer_littlefs?.limite ?? 128 })}</dt><dd className="mt-0.5 font-medium">{t('dispositivos.perdidas', { n: equipo.buffer_littlefs?.perdidas ?? 0 })}</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.intervaloReporte')}</dt><dd className="mt-0.5 font-medium">{equipo.intervalo_reporte_segundos ?? 30} s</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.umbralSinDatos')}</dt><dd className="mt-0.5 font-medium">{segundosSilencio} s</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.firmware')}</dt><dd className="mt-0.5 font-medium">{equipo.firmware_version || '—'}</dd></div>
                        <div><dt className="text-muted">{t('dispositivos.credencialEstado')}</dt><dd className="mt-0.5 font-medium">{t(`dispositivos.credencial.${equipo.estado_credencial_broker ?? 'sin_reportar'}`)}</dd></div>
                        {equipo.buffer_littlefs?.desde && <div><dt className="text-muted">{t('dispositivos.ventanaCola')}</dt><dd className="mt-0.5 font-medium">{t('dispositivos.rangoBuffer', { desde: fechaHora(equipo.buffer_littlefs.desde), hasta: equipo.buffer_littlefs.hasta ? fechaHora(equipo.buffer_littlefs.hasta) : '—' })}</dd></div>}
                      </dl>
                      </article>
                    )
                  })}
                </CardContent>
              </Card>
              {lecturasRecientes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dashboard.lecturasRecientesTitulo')}</CardTitle>
                    <CardDescription>{t('dashboard.lecturasRecientesAyuda')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="divide-y divide-border">
                      {lecturasRecientes.map((lectura) => (
                        <li key={`${lectura.device_id}-${lectura.timestamp}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                          <div>
                            <time dateTime={lectura.timestamp} className="text-xs text-muted">{fechaHora(lectura.timestamp)}</time>
                            <p className="mt-0.5 text-xs font-medium">{lectura.device_id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="nums text-sm font-semibold">{lectura.temperatura_interna?.toFixed(1) ?? '—'} °C</span>
                            <RiskBadge nivel={lectura.riesgo_efectivo} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          <div role="status" className="mt-4 mb-4 flex items-center justify-between gap-2 border-t border-border px-1 pt-3 sm:flex-nowrap">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary sm:size-8">
                <Clock3 className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-0.5">
                <span className="text-[11px] text-muted sm:text-xs">{t('dashboard.ultimaActualizacion')}</span>
                <time dateTime={ultima.timestamp} className="nums text-xs font-semibold text-foreground sm:text-sm">
                  {formatearHora(ultima.timestamp)}
                </time>
              </div>
            </div>
            <Link
              to="/alertas"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-surface px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-tint sm:min-h-9 sm:gap-2 sm:px-3"
            >
              {t('dashboard.verAlertas')}
              <ArrowRight className="size-3 sm:size-3.5" aria-hidden />
            </Link>
          </div>
        </>
      )}
      <SimuladorDashboard onActualizado={actualizarDemo} />
    </div>
  )
}
