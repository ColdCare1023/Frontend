import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, ChevronRight, HardDrive, TriangleAlert, Wifi, WifiOff } from 'lucide-react'

import { CAPACIDAD_BUFFER_LITTLEFS, estadoCalibracion, type Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { fechaCorta, hora } from '@/lib/formato'
import { clsx } from 'clsx'
import { BadgeConectividad } from '../../components/BadgeConectividad'
import { Button } from '../../components/ui/button'
import { textoRangoBuffer } from './bufferNodo'

/**
 * Anillo del buffer local (HU-48; Magic UI Circular, movin Rings). Estático:
 * `estado_nodo` llega muchas veces al día y no merece movimiento (MOTION §5).
 */
export function AnilloBuffer({
  pendientes,
  limite,
  perdidas,
  tamano = 40,
  etiqueta,
}: {
  pendientes: number
  limite: number
  perdidas: number
  tamano?: number
  etiqueta: string
}) {
  const radio = 15.5
  const circunferencia = 2 * Math.PI * radio
  const fraccion = limite > 0 ? Math.min(1, pendientes / limite) : 0
  const tono = perdidas > 0 ? 'text-critical' : pendientes > 0 ? 'text-warning-600' : 'text-success-600'
  return (
    <svg role="img" aria-label={etiqueta} viewBox="0 0 36 36" width={tamano} height={tamano} className={clsx('shrink-0 -rotate-90', tono)}>
      <circle cx="18" cy="18" r={radio} fill="none" strokeWidth="3" className="stroke-border" />
      <circle
        cx="18"
        cy="18"
        r={radio}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(perdidas > 0 ? circunferencia : fraccion * circunferencia, pendientes > 0 ? 2 : 0)} ${circunferencia}`}
      />
    </svg>
  )
}

/**
 * Meta del buffer (HU-48): con pendientes, el rango que cubren (esc. 1) y las
 * pérdidas si las hay; si no, las pérdidas o la última sincronización
 * (esc. 3). La línea se trunca: la frase completa queda en el `title`.
 */
export function MetaBuffer({ equipo }: { equipo: Dispositivo }) {
  const { t } = useTranslation()
  const buffer = equipo.buffer_littlefs
  if (!buffer) return <span className="text-faint">—</span>
  const perdidas = (buffer.perdidas ?? 0) > 0 ? t('dispositivos.perdidas', { n: buffer.perdidas }) : null
  const rango = textoRangoBuffer(buffer, t)
  if (rango) {
    const texto = [rango, perdidas].filter(Boolean).join(' · ')
    return (
      <span title={texto} data-testid="buffer-rango">
        {rango}
        {perdidas && <span className="font-medium text-warning-700"> · {perdidas}</span>}
      </span>
    )
  }
  if (perdidas) return <span className="font-medium text-warning-700">{perdidas}</span>
  if (buffer.ultima_sincronizacion_en) return <span>{t('dashboard.bufferSincronizado', { hora: hora(buffer.ultima_sincronizacion_en) })}</span>
  return null
}

/** HU-30: estado corto de la calibración (la frase larga vive en la línea de estado y el panel). */
export function EstadoCalibracionCorto({ equipo }: { equipo: Dispositivo | undefined }) {
  const { t } = useTranslation()
  if (!equipo) return <span className="text-faint">—</span>
  const estado = estadoCalibracion(equipo)
  const fecha = fechaCorta(equipo.fecha_proxima_calibracion)
  if (estado === 'vencida')
    return (
      <span role="status" className="inline-flex items-center gap-1 font-medium text-warning-700">
        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
        {t('dashboard.calibracionVencidaCorta', { fecha })}
      </span>
    )
  if (estado === 'proxima_a_vencer')
    return (
      <span role="status" className="font-medium text-warning-700">
        {t('dashboard.calibracionPorVencerCorta', { fecha })}
      </span>
    )
  if (estado === 'vigente') return <span>{t('dashboard.calibracionVigenteHasta', { fecha })}</span>
  return <span>{t('dashboard.calibracionSinRegistro')}</span>
}

/**
 * Calibración en dos líneas para la celda (valor y meta): «Vigente / hasta
 * 11/5/2027». Vencida o por vencer conservan la frase completa en el valor;
 * son el caso que importa y pueden ocupar dos líneas.
 */
function CalibracionCelda({ equipo }: { equipo: Dispositivo | undefined }) {
  const { t } = useTranslation()
  if (!equipo) return <dd className="mt-1 text-body text-faint">—</dd>
  const estado = estadoCalibracion(equipo)
  if (estado === 'vigente') {
    const fecha = fechaCorta(equipo.fecha_proxima_calibracion)
    return (
      <>
        <dd className="mt-1 text-body text-foreground lg:truncate">{t('dashboard.calibracionVigente')}</dd>
        <dd className="nums mt-1 text-faint lg:truncate">{t('dashboard.calibracionHasta', { fecha })}</dd>
      </>
    )
  }
  return (
    <dd className="mt-1 text-body text-foreground">
      <EstadoCalibracionCorto equipo={equipo} />
    </dd>
  )
}

/** «01:04 p. m.»: la hora sin segundos para una meta de una línea. */
const horaCorta = (iso: string) => hora(iso).replace(/:\d{2}(?=\D*$)/, '')

/**
 * Equipo en pantalla: conexión del nodo (HU-13, RF-18), buffer local (HU-48)
 * y calibración (HU-30). «Detalles» abre la ficha completa. Cada columna es
 * etiqueta, valor y una meta de una línea: la celda mide lo mismo que
 * Condiciones (136 px) y la Lectura no se estira (DIRECTION §12).
 */
export const CeldaEquipo = memo(function CeldaEquipo({
  deviceId,
  equipo,
  ultima,
  onVerDetalles,
}: {
  deviceId: string | null
  equipo: Dispositivo | undefined
  ultima: LecturaTermica | null
  onVerDetalles: (id: string) => void
}) {
  const { t } = useTranslation()
  const id = equipo?.id ?? ultima?.device_id ?? deviceId
  const conectividad = equipo?.estado_conectividad ?? ultima?.estado_conectividad
  const buffer = equipo?.buffer_littlefs
  const limite = buffer?.limite ?? CAPACIDAD_BUFFER_LITTLEFS
  const pendientes = buffer?.pendientes ?? 0
  const ultimoReporte = equipo?.ultimo_reporte_en

  return (
    // <640 va al final (DIRECTION §12: Lectura, Condiciones, Curva, Estado de
    // equipos, Alertas, Recientes, Equipo). Solo cambia el orden visual en
    // móvil; el DOM sigue el orden del bento de escritorio.
    <section aria-labelledby="equipo-titulo" className="superficie col-span-4 flex min-w-0 flex-col p-4 max-sm:order-last lg:col-span-5 xl:p-5">
      <div className="flex h-6 min-w-0 items-center gap-2">
        <h2 id="equipo-titulo" className="eyebrow">
          {t('dashboard.equipo')}
        </h2>
        {id && <span className="codigo truncate text-meta text-faint">{id}</span>}
        {id && (
          <Button variant="ghost" size="sm" className="-my-2 -mr-2 ml-auto shrink-0" onClick={() => onVerDetalles(id)}>
            {t('dashboard.detalles')}
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-x-3 text-meta text-muted">
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 font-medium">
            {conectividad === 'online' ? <Wifi aria-hidden className="size-3.5 shrink-0" /> : <WifiOff aria-hidden className="size-3.5 shrink-0" />}
            <span className="min-w-0 lg:truncate">{t('dispositivos.conectividad')}</span>
          </dt>
          <dd className="mt-1">
            {/* HU-13: estado del NODO (LWT/online/telemetría), no el de la
                lectura, que siempre se envió conectada. Sin datos del equipo
                (modo demo) se usa el de la lectura. */}
            <BadgeConectividad estado={conectividad} desde={equipo?.conectividad_cambiada_en} testId="conectividad-dispositivo" />
          </dd>
          {ultimoReporte && (
            <dd className="nums mt-1 text-faint lg:truncate" title={t('dashboard.ultimoReporteCorto', { hora: hora(ultimoReporte) })}>
              <span className="sr-only">{t('dashboard.ultimoReporteCorto', { hora: '' })}</span>
              <time dateTime={ultimoReporte}>{horaCorta(ultimoReporte)}</time>
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 font-medium">
            <HardDrive aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 lg:truncate">{t('dashboard.bufferTitulo')}</span>
          </dt>
          {buffer ? (
            <>
              <dd className="mt-1 flex min-h-5 min-w-0 items-center gap-1.5">
                <AnilloBuffer
                  pendientes={pendientes}
                  limite={limite}
                  perdidas={buffer.perdidas ?? 0}
                  tamano={18}
                  etiqueta={t('dashboard.bufferAnillo', { n: pendientes.toLocaleString(), max: limite.toLocaleString() })}
                />
                <span className="nums text-body text-foreground lg:truncate">
                  {pendientes.toLocaleString()}
                  <span className="text-meta text-faint"> / {limite.toLocaleString()}</span>
                </span>
              </dd>
              <dd className="mt-1 text-faint lg:truncate">
                <MetaBuffer equipo={equipo} />
              </dd>
            </>
          ) : (
            <dd className="mt-1 text-body text-faint">—</dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 font-medium">
            <CalendarClock aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 lg:truncate">{t('dashboard.calibracionTitulo')}</span>
          </dt>
          <CalibracionCelda equipo={equipo} />
        </div>
      </dl>
    </section>
  )
})
