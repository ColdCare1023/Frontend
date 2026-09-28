import { memo, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { EChartsCoreOption } from 'echarts/core'
import { AlertTriangle, DoorClosed, DoorOpen, Droplets, RadioTower, ShieldQuestion, TableProperties, Thermometer, Wind } from 'lucide-react'

import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { duracionBreve, hora as formatearHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { AnuncioRiesgo } from '../components/AnuncioRiesgo'
import { EstadoCarga, EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'

// HU-35 criterio 2: a partir de este umbral, la advertencia de puerta
// abierta se resalta. Es una guía operativa de la UI, no una regla de
// alertas del backend (que sigue siendo puramente térmica, HU-21).
const UMBRAL_PUERTA_ABIERTA_SEGUNDOS = 120

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
  // HU-33 criterio 2: dato presente pero desactualizado — distinto de
  // `fallaSensor` (dato ausente porque el sensor falló). Se atenúa la
  // tarjeta y se avisa, en vez de mostrar un número viejo como si fuera
  // vigente.
  desactualizado = false,
  textoDesactualizado,
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
  desactualizado?: boolean
  textoDesactualizado?: string
  enVivo?: { conectado: boolean; texto: string }
}) {
  return (
    <Card
      className={cn(
        'card-lift animate-rise',
        destacada && !fallaSensor && !desactualizado && 'border-pine-200 bg-primary-tint/50',
        fallaSensor && 'border-clay-200 bg-clay-50/40',
        !fallaSensor && desactualizado && 'opacity-60',
      )}
      style={{ animationDelay: `${retraso}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted">{etiqueta}</p>
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-md',
              fallaSensor || desactualizado
                ? 'bg-clay-100 text-clay-600'
                : destacada
                  ? 'bg-pine-100 text-pine-600'
                  : 'bg-cream-100 text-faint',
            )}
          >
            {fallaSensor || desactualizado ? (
              <AlertTriangle className="size-4" />
            ) : (
              <Icono className="size-4" />
            )}
          </span>
        </div>
        {fallaSensor ? (
          <p role="alert" className="mt-2 text-sm font-medium leading-snug text-clay-700">
            {textoFallaSensor}
          </p>
        ) : (
          <>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="nums text-[32px] font-semibold leading-none tracking-tight">
                {valor}
              </span>
              <span className="text-sm text-muted">{unidad}</span>
              {delta != null && Math.abs(delta) >= 0.05 && (
                <span
                  className={cn(
                    'nums ml-auto text-xs font-medium',
                    delta > 0 ? 'text-honey-600' : 'text-pine-600',
                  )}
                >
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                </span>
              )}
            </p>
            {desactualizado && (
              <p className="mt-1 text-xs font-medium leading-snug text-clay-700">
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
}): EChartsCoreOption {
  const horas = serie.map((l) => formatearHora(l.timestamp))
  return {
    textStyle: { fontFamily: 'Inter, sans-serif', color: '#0F172A' },
    grid: { left: 44, right: 16, top: 32, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#FFFFFF',
      borderColor: '#DCE5F0',
      textStyle: { color: '#0F172A', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} °C` : '—'),
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 3,
      formatter: etiquetaCortaTemperatura,
      textStyle: { color: '#59677C', fontSize: 12, fontFamily: 'Inter, sans-serif' },
    },
    xAxis: {
      type: 'category',
      data: horas,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#DCE5F0' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: '#59677C', fontFamily: 'Inter, sans-serif' },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(Math.min(value.min, 0)),
      max: (value: { max: number }) => Math.ceil(Math.max(value.max, 10)),
      splitLine: { lineStyle: { color: '#DCE5F0' } },
      axisLabel: { fontSize: 11, color: '#59677C', fontFamily: 'Inter, sans-serif', formatter: '{value} °C' },
    },
    series: [
      {
        name: etiquetas.interna,
        type: 'line',
        smooth: true,
        symbol: 'none',
        // HU-31 criterio 3: con la ventana ampliada a días, miles de puntos
        // continuos se muestrean automáticamente (LTTB conserva la forma
        // real de la tendencia, a diferencia de un promedio simple) para que
        // la interfaz siga fluida sin perder picos ni caídas relevantes.
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_interna),
        lineStyle: { width: 2.5, color: '#0B5CFF' },
        itemStyle: { color: '#0B5CFF' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(11, 92, 255, 0.14)' },
              { offset: 1, color: 'rgba(11, 92, 255, 0)' },
            ],
          },
        },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(11, 92, 255, 0.06)' },
          data: [[{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }]],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          // Tono `clay-700` existente: mantiene semántica de excursión crítica.
          lineStyle: { color: '#8F3320', type: 'dashed', width: 1 },
          label: { color: '#8F3320', fontSize: 10, fontFamily: 'Inter, sans-serif', formatter: '{c} °C' },
          data: [{ yAxis: RANGO_TERMICO.minimo }, { yAxis: RANGO_TERMICO.maximo }],
        },
      },
      {
        name: etiquetas.ambiental,
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        large: true,
        data: serie.map((l) => l.temperatura_ambiental),
        lineStyle: { width: 1.5, color: '#08738F', type: 'dashed' },
        itemStyle: { color: '#08738F' },
      },
    ],
  }
}

function etiquetaCortaTemperatura(nombre: string): string {
  return nombre
    .replace(/^temperatura\s+/i, '')
    .replace(/\s+temperature$/i, '')
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
  ]
  const filas = useMemo(
    () =>
      abierto
        ? serie.map((lectura) => [
            formatearHora(lectura.timestamp),
            lectura.temperatura_interna?.toFixed(1) ?? '—',
            lectura.temperatura_ambiental?.toFixed(1) ?? '—',
            lectura.riesgo_efectivo ? t(`riesgo.${lectura.riesgo_efectivo}`) : '—',
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
                {columnas.map((columna) => (
                  <th
                    key={columna}
                    scope="col"
                    className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"
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
                    <td key={columna} className="nums px-3 py-1.5">
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

export function DashboardPage() {
  const { t } = useTranslation()
  const [horasVentana, setHorasVentana] = useState<number>(24)
  const { ultima, serie, sseConectado, estadoHistorial } = useMonitoreoTermico(horasVentana)
  const previa = serie.at(-2) ?? null
  const resumen = useMemo(() => resumenVentana(serie), [serie])

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
  const datoDesactualizado = segundosDesdeUltima != null && segundosDesdeUltima >= UMBRAL_FRESCURA_SEGUNDOS

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
      }),
    [serie, t],
  )

  return (
    <div>
      {/* RF-11 + WCAG 4.1.3: la excursión térmica que llega por SSE se anuncia.
          HU-34: se anuncia el riesgo EFECTIVO, no la clase cruda de la IA —
          es lo que decide si hay que actuar, no lo que opinó el modelo. */}
      <AnuncioRiesgo nivel={ultima?.riesgo_efectivo ?? null} temperatura={ultima?.temperatura_interna} />

      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('dashboard.titulo')} descripcion={t('dashboard.descripcion')}>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
            sseConectado
              ? 'border-glacier-200 bg-glacier-100 text-glacier-700'
              : 'border-border bg-cream-200 text-foreground',
          )}
        >
          <span className="relative flex size-2">
            {sseConectado && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glacier-600 opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                sseConectado ? 'bg-glacier-600' : 'bg-faint',
              )}
            />
          </span>
          {sseConectado ? t('dashboard.conectado') : t('dashboard.desconectado')}
          <span className="text-foreground">· {t('dashboard.tiempoReal')}</span>
        </span>
      </PageHeader>

      {estadoHistorial === 'error' && (
        <div className="mb-4">
          <EstadoError mensaje={t('comunes.error')} />
        </div>
      )}

      {ultima === null && estadoHistorial === 'cargando' ? (
        <EstadoCarga />
      ) : ultima === null && estadoHistorial === 'error' ? null : ultima === null ? (
        <Card className="animate-rise">
          <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-cream-200 text-faint">
              <RadioTower className="size-6" />
            </span>
            <p className="font-medium text-foreground">{t('dashboard.esperandoDatos')}</p>
            <p className="max-w-sm text-sm text-muted">{t('dashboard.esperandoDetalle')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Métricas ────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaMetrica
              etiqueta={t('dashboard.tempInterna')}
              valor={ultima.temperatura_interna?.toFixed(1) ?? '—'}
              unidad="°C"
              icono={Thermometer}
              delta={deltaDe(ultima.temperatura_interna, previa?.temperatura_interna)}
              destacada
              fallaSensor={fallaSensor(ultima, 'temperatura_interna')}
              textoFallaSensor={t('dashboard.fallaSensor')}
              desactualizado={datoDesactualizado}
              textoDesactualizado={t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })}
              enVivo={{
                conectado: sseConectado,
                texto: sseConectado
                  ? t('dashboard.enVivoDesde', { hora: formatearHora(ultima.timestamp) })
                  : t('dashboard.desconectadoDesde', { hora: formatearHora(ultima.timestamp) }),
              }}
            />
            <TarjetaMetrica
              etiqueta={t('dashboard.tempAmbiental')}
              valor={ultima.temperatura_ambiental?.toFixed(1) ?? '—'}
              unidad="°C"
              icono={Wind}
              delta={deltaDe(ultima.temperatura_ambiental, previa?.temperatura_ambiental)}
              retraso={60}
              fallaSensor={fallaSensor(ultima, 'temperatura_ambiental')}
              textoFallaSensor={t('dashboard.fallaSensor')}
              desactualizado={datoDesactualizado}
              textoDesactualizado={t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })}
            />
            <TarjetaMetrica
              etiqueta={t('dashboard.humedad')}
              valor={ultima.humedad_ambiental?.toFixed(0) ?? '—'}
              unidad="% HR"
              fallaSensor={fallaSensor(ultima, 'humedad_ambiental')}
              textoFallaSensor={t('dashboard.fallaSensor')}
              icono={Droplets}
              retraso={120}
              desactualizado={datoDesactualizado}
              textoDesactualizado={t('dashboard.datoDesactualizado', { s: segundosDesdeUltima })}
            />
            <Card className="card-lift animate-rise" style={{ animationDelay: '180ms' }}>
              <CardContent className="p-5">
                <p className="text-[13px] font-medium text-muted">{t('dashboard.estadoActual')}</p>
                <div className="mt-2.5">
                  {/* HU-34 criterios 1-3: el semáforo principal es el riesgo
                      EFECTIVO (regla directa + IA combinadas), nunca la
                      clase cruda de la IA por sí sola. */}
                  <RiskBadge nivel={ultima.riesgo_efectivo} />
                </div>
                {ultima.riesgo_efectivo && (
                  <p className="mt-1.5 text-xs leading-snug text-muted">
                    {t(`riesgo.detalle.${ultima.riesgo_efectivo}`)}
                  </p>
                )}
                {ultima.excursion_confirmada && (
                  <p className="mt-1 text-xs font-medium leading-snug text-clay-700">
                    {t('dashboard.excursionConfirmada')}
                  </p>
                )}
                {/* HU-34 criterio 4: si la IA clasificó más severo que el
                    riesgo efectivo (p. ej. excursión crítica con la
                    temperatura todavía en rango), se muestra diferenciado —
                    nunca se afirma una excursión que la regla directa no
                    confirmó. */}
                {!ultima.excursion_confirmada &&
                  ultima.nivel_riesgo === 'excursion_critica' &&
                  ultima.riesgo_efectivo !== 'excursion_critica' && (
                    <p className="mt-1.5 flex items-start gap-1 text-xs leading-snug text-honey-700">
                      <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {t('dashboard.clasificacionIaDivergente')}
                    </p>
                  )}
                <p className="mt-1.5 text-xs leading-snug text-muted">
                  {ultima.estado_inferencia && ultima.estado_inferencia !== 'completada' ? (
                    <>
                      {t(`ia.estado.${ultima.estado_inferencia}`)}
                      {ultima.origen_clasificacion && <> · {t(`ia.origen.${ultima.origen_clasificacion}`)}</>}
                      {ultima.motivo_no_inferencia && <> · {ultima.motivo_no_inferencia}</>}
                    </>
                  ) : ultima.origen_clasificacion ? (
                    <>
                      {t(`ia.origen.${ultima.origen_clasificacion}`)}
                      {ultima.confianza_ia !== null && (
                        <> · {t('ia.confianza')} {(ultima.confianza_ia * 100).toFixed(0)}%</>
                      )}
                      {(ultima.modelo_version ?? ultima.model_version) && (
                        <> · {t('ia.version')} {ultima.modelo_version ?? ultima.model_version}</>
                      )}
                    </>
                  ) : (
                    t('ia.sinInferencia')
                  )}
                </p>
                {/* HU-35 criterio 4: sin MC-38 instalado, `apertura_refrigerador`
                    llega como null — no se presenta como "cerrada", que
                    sería una falsa lectura de un sensor que no existe. */}
                {ultima.apertura_refrigerador === null ? (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-faint">
                    <ShieldQuestion className="size-3.5" aria-hidden />
                    {t('dashboard.puerta')}: {t('dashboard.puertaSinSensor')}
                  </p>
                ) : ultima.apertura_refrigerador ? (
                  (() => {
                    // HU-35 criterio 2: se resalta y se muestra el tiempo
                    // transcurrido cuando supera el umbral configurado.
                    const duracion = ultima.duracion_apertura_segundos ?? 0
                    const prolongada = duracion >= UMBRAL_PUERTA_ABIERTA_SEGUNDOS
                    return (
                      <p
                        className={cn(
                          'mt-2.5 flex items-center gap-1.5 text-[13px]',
                          prolongada ? 'font-medium text-clay-700' : 'text-muted',
                        )}
                        role={prolongada ? 'alert' : undefined}
                        data-testid="puerta-advertencia"
                      >
                        <DoorOpen
                          className={cn('size-3.5', prolongada ? 'text-clay-600' : 'text-honey-600')}
                        />
                        {t('dashboard.puerta')}: {t('dashboard.puertaAbierta')}
                        {ultima.duracion_apertura_segundos !== null && (
                          <span className="nums">· {duracionBreve(duracion)}</span>
                        )}
                        {prolongada && (
                          <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>
                        )}
                      </p>
                    )
                  })()
                ) : (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-muted">
                    <DoorClosed className="size-3.5" />
                    {t('dashboard.puerta')}: {t('dashboard.puertaCerrada')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Curva térmica ───────────────────────────────── */}
          <Card className="mt-4 animate-rise" style={{ animationDelay: '240ms' }}>
            <CardHeader className="gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <CardTitle>{t('dashboard.curvaTermica')}</CardTitle>
                <CardDescription>
                  {t('dashboard.ultimasLecturas', { n: serie.length })} ·{' '}
                  {t('dashboard.rangoConservacion')}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* RF-18: el dashboard muestra el estado de conectividad del
                    dispositivo. Es distinto del indicador SSE de la cabecera,
                    que refleja la salud del stream del navegador, no la del nodo. */}
                <p className="flex items-center gap-2 text-xs text-faint">
                  {t('dashboard.dispositivo')}:{' '}
                  <span className="nums text-ink-700">{ultima.device_id}</span>
                  <Badge
                    variant={ultima.estado_conectividad === 'online' ? 'ok' : 'neutral'}
                    dot
                    data-testid="conectividad-dispositivo"
                  >
                    {ultima.estado_conectividad === 'online'
                      ? t('dashboard.dispositivoOnline')
                      : t('dashboard.dispositivoOffline')}
                  </Badge>
                </p>
                {/* HU-31 criterio 4: ventana de 24 h por defecto, con opción
                    de ampliar o acotar sin salir del dashboard. */}
                <div role="group" aria-label={t('dashboard.rangoVentana')} className="flex gap-1">
                  {OPCIONES_VENTANA_HORAS.map((horas) => (
                    <button
                      key={horas}
                      type="button"
                      onClick={() => setHorasVentana(horas)}
                      aria-pressed={horasVentana === horas}
                      className={cn(
                        'rounded-(--radius-field) px-2 py-1 text-xs font-medium transition-colors',
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
                height="320px"
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
                      <dt className="eyebrow">{t(clave)}</dt>
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

          <p className="mt-3 text-right text-xs text-faint">
            {t('dashboard.ultimaActualizacion')}:{' '}
            <span className="nums">{formatearHora(ultima.timestamp)}</span> ·{' '}
            <Link to="/alertas" className="text-pine-600 underline-offset-2 hover:underline">
              {t('dashboard.verAlertas')}
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
