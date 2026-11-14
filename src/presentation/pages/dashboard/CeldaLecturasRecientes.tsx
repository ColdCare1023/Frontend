import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { estadoRiesgoDe, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import { HoraLectura } from '../../components/HoraLectura'
import { RiskBadge } from '../../components/RiskBadge'
import { Esqueleto } from '../../components/ui/esqueleto'
import { tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { Regla } from '../../components/ui/regla'

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
              className="grid min-h-9 grid-cols-[minmax(4.5rem,auto)_3.5rem_minmax(0,1fr)_auto] items-center gap-3 py-1.5"
            >
              {/* HU-07: un arranque sin hora sincronizada se rotula «Sin hora». */}
              <HoraLectura lectura={lectura} className="nums text-meta whitespace-nowrap text-faint" />
              <span className="nums text-body font-semibold text-foreground">
                {lectura.temperatura_interna?.toFixed(1) ?? '—'}
                <span className="ml-0.5 text-meta font-medium text-muted">°C</span>
              </span>
              <Regla
                tamano="s"
                valor={lectura.temperatura_interna ?? null}
                tono={lectura.temperatura_interna == null ? 'sin_datos' : tonoDesdeRiesgo(estadoRiesgoDe(lectura))}
                decorativa
                // Junto a la cifra (no al otro extremo de la fila): se lee de un vistazo dónde cae.
                className="w-full max-w-40"
              />
              {/* HU-34: sin clasificación IA no se rotula Normal. */}
              <RiskBadge nivel={estadoRiesgoDe(lectura)} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
})
