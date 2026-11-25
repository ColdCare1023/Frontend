import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CalendarClock, HardDrive } from 'lucide-react'

import { CAPACIDAD_BUFFER_LITTLEFS, estadoCalibracion, type Dispositivo, type EstadoCalibracion } from '@/domain/entities/Dispositivo'
import { fechaDia, fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { diasHasta } from '../estadoEquipo'

const ORDEN: Record<EstadoCalibracion, number> = { vencida: 0, proxima_a_vencer: 1, vigente: 2, sin_registrar: 3 }
const PUNTO: Record<EstadoCalibracion, string> = {
  vencida: 'bg-critical-solid',
  proxima_a_vencer: 'bg-warning-600',
  vigente: 'bg-success-600',
  sin_registrar: 'bg-border-strong',
}

/** Rail de contexto (≥ 1280 a la derecha; debajo en pantallas menores). */
export function RailContexto({ dispositivos }: { dispositivos: readonly Dispositivo[] }) {
  const { t } = useTranslation()
  const activos = dispositivos.filter((d) => d.activo)
  const calibraciones = activos
    .map((d) => ({ d, estado: estadoCalibracion(d), dias: diasHasta(d.fecha_proxima_calibracion) }))
    .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || (a.dias ?? Infinity) - (b.dias ?? Infinity))
    .slice(0, 5)

  return (
    <aside
      aria-label={t('dispositivos.rail.etiqueta')}
      className="col-span-12 grid grid-cols-1 content-start gap-3 sm:grid-cols-2 xl:gap-4"
    >
      <section aria-labelledby="rail-calibraciones" className="superficie p-4">
        <h2 id="rail-calibraciones" className="mb-3 flex items-center justify-between gap-2 text-title text-foreground">
          {t('dispositivos.rail.calibraciones')}
          <CalendarClock aria-hidden className="size-4 text-muted" />
        </h2>
        {calibraciones.length === 0 ? (
          <p className="text-meta text-muted">{t('dispositivos.rail.sinActivos')}</p>
        ) : (
          <ol className="space-y-3">
            {calibraciones.map(({ d, estado, dias }, i) => (
              <li
                key={d.id}
                className={cn(
                  'relative pl-5',
                  i < calibraciones.length - 1 && 'before:absolute before:top-4 before:-bottom-3 before:left-1 before:w-px before:-translate-x-1/2 before:bg-border',
                )}
              >
                <span aria-hidden className={cn('absolute top-1.5 left-0 size-2 rounded-full', PUNTO[estado])} />
                <Link
                  to={`/dispositivos/${encodeURIComponent(d.id)}?tab=calibracion`}
                  className="codigo text-body font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {d.id}
                </Link>
                <p className="nums text-meta text-muted">
                  {d.fecha_proxima_calibracion ? fechaDia(d.fecha_proxima_calibracion) : t('dispositivos.rail.sinCertificado')}
                  {dias !== null && (
                    <span className={cn('ml-1', dias < 0 ? 'text-critical' : estado === 'proxima_a_vencer' && 'text-warning-700')}>
                      {' · '}
                      {dias < 0
                        ? t('dispositivos.rail.vencioHace', { dias: -dias })
                        : dias === 0
                          ? t('dispositivos.rail.venceHoy')
                          : t('dispositivos.rail.venceEn', { dias })}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="rail-buffer" className="superficie p-4">
        <h2 id="rail-buffer" className="mb-3 flex items-center justify-between gap-2 text-title text-foreground">
          {t('dispositivos.rail.buffer')}
          <HardDrive aria-hidden className="size-4 text-muted" />
        </h2>
        {activos.length === 0 ? (
          <p className="text-meta text-muted">{t('dispositivos.rail.sinActivos')}</p>
        ) : (
          <ul className="space-y-3">
            {activos.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                <AnilloBuffer
                  pendientes={d.buffer_littlefs?.pendientes ?? 0}
                  limite={d.buffer_littlefs?.limite ?? CAPACIDAD_BUFFER_LITTLEFS}
                  perdidas={d.buffer_littlefs?.perdidas ?? 0}
                />
                <div className="min-w-0">
                  <p className="codigo truncate text-body font-medium text-foreground">{d.id}</p>
                  {d.buffer_littlefs ? (
                    <>
                      <p className="nums text-meta text-subtle">
                        {t('dispositivos.rail.bufferPendientes', {
                          n: d.buffer_littlefs.pendientes.toLocaleString(),
                          max: d.buffer_littlefs.limite.toLocaleString(),
                        })}
                      </p>
                      <p className="nums text-meta text-faint">
                        {t('dispositivos.perdidas', { n: d.buffer_littlefs.perdidas })}
                        {d.buffer_littlefs.ultima_sincronizacion_en &&
                          ` · ${t('dispositivos.rail.sincronizado', { fecha: fechaHora(d.buffer_littlefs.ultima_sincronizacion_en) })}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-meta text-faint">{t('dispositivos.rail.sinEstadoNodo')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}

/** Anillo de ocupación del buffer LittleFS (decorativo: el texto dice la cifra). */
export function AnilloBuffer({ pendientes, limite, perdidas, tamano = 40 }: { pendientes: number; limite: number; perdidas: number; tamano?: number }) {
  const r = 16
  const circunferencia = 2 * Math.PI * r
  const fraccion = limite > 0 ? Math.min(1, pendientes / limite) : 0
  const visible = pendientes > 0 ? Math.max(0.03, fraccion) : 0
  const color =
    perdidas > 0 || fraccion > 0.9 ? 'var(--color-critical-solid)' : pendientes > 0 ? 'var(--color-warning-600)' : 'var(--color-success-600)'
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 40 40" className="shrink-0 -rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={pendientes > 0 ? color : 'var(--color-success-600)'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${visible * circunferencia} ${circunferencia}`}
        opacity={pendientes > 0 ? 1 : 0.35}
      />
    </svg>
  )
}
