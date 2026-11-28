import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { estadoRiesgoDe, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import { HoraLectura } from '../../components/HoraLectura'
import { RiskBadge } from '../../components/RiskBadge'
import { Esqueleto } from '../../components/ui/esqueleto'

/**
 * Lecturas recientes del equipo en pantalla (HU-19), ordenadas de la
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
    <section aria-labelledby="recientes-titulo" className="min-w-0">
      {/* Visible: dentro de «Más detalles» separa las lecturas del diagnóstico. */}
      <h2 id="recientes-titulo" className="px-2 text-body font-semibold text-foreground">
        {t('dashboard.lecturasRecientesTitulo')}
      </h2>
      <p className="sr-only">{t('dashboard.lecturasRecientesAyuda')}</p>
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
          {recientes.map((lectura, indice) => (
            <li
              key={lectura.id || `${lectura.device_id}-${lectura.timestamp}`}
              className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-2 py-2 first:rounded-md first:bg-surface-sunken sm:gap-x-6"
            >
              {/* HU-07: un arranque sin hora sincronizada se rotula «Sin hora». */}
              <span className="min-w-0">
                {indice === 0 && <span className="block text-meta font-medium text-subtle">{t('dashboard.ultimaLecturaHora')}</span>}
                <HoraLectura lectura={lectura} className="nums text-meta text-muted" />
              </span>
              <span className="nums text-body font-semibold text-foreground">
                {lectura.temperatura_interna?.toFixed(1) ?? '—'}
                <span className="ml-0.5 text-meta font-medium text-muted">°C</span>
              </span>
              {/* HU-34: sin clasificación IA no se rotula Normal. */}
              <RiskBadge nivel={estadoRiesgoDe(lectura)} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
})
