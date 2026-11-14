import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { fechaHora, hora } from '@/lib/formato'
import { RiskBadge } from '../../components/RiskBadge'
import { Esqueleto } from '../../components/ui/esqueleto'
import { tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { Regla } from '../../components/ui/regla'

const esDeHoy = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

/**
 * Lecturas recientes del equipo en pantalla (HU-19), siempre visibles: de la
 * más nueva a la más antigua (Magic UI Animated List: el orden, no el
 * movimiento; una lectura por SSE no anima, MOTION §5).
 */
export const CeldaLecturasRecientes = memo(function CeldaLecturasRecientes({
  serie,
  cargando,
  ventana,
}: {
  serie: readonly LecturaTermica[]
  cargando: boolean
  ventana: string
}) {
  const { t } = useTranslation()
  const recientes = useMemo(() => serie.slice(-5).reverse(), [serie])

  return (
    <section aria-labelledby="recientes-titulo" className="superficie col-span-4 flex min-w-0 flex-col p-4 lg:col-span-6 xl:p-5">
      <h2 id="recientes-titulo" className="text-title text-foreground">
        {t('dashboard.lecturasRecientesTitulo')}
      </h2>
      <p className="text-meta text-faint">{t('dashboard.lecturasRecientesAyuda')}</p>
      {recientes.length === 0 ? (
        cargando ? (
          <div aria-hidden className="mt-2 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Esqueleto key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <p role="status" className="mt-3 text-body text-muted">
            {t('dashboard.recientesVacio', { ventana })}
          </p>
        )
      ) : (
        <ol className="mt-2 divide-y divide-border">
          {recientes.map((lectura) => (
            <li
              key={lectura.id || `${lectura.device_id}-${lectura.timestamp}`}
              className="grid min-h-9 grid-cols-[minmax(4.5rem,auto)_auto_1fr_auto] items-center gap-3 py-1.5"
            >
              <time dateTime={lectura.timestamp} title={fechaHora(lectura.timestamp)} className="nums text-meta whitespace-nowrap text-faint">
                {esDeHoy(lectura.timestamp) ? hora(lectura.timestamp) : fechaHora(lectura.timestamp)}
              </time>
              <span className="nums text-body font-semibold text-foreground">
                {lectura.temperatura_interna?.toFixed(1) ?? '—'}
                <span className="ml-0.5 text-meta font-medium text-muted">°C</span>
              </span>
              <Regla
                tamano="s"
                valor={lectura.temperatura_interna ?? null}
                tono={lectura.temperatura_interna == null ? 'sin_datos' : tonoDesdeRiesgo(lectura.riesgo_efectivo)}
                decorativa
                className="justify-self-end"
              />
              <RiskBadge nivel={lectura.riesgo_efectivo} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
})
