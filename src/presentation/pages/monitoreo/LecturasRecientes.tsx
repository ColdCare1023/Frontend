import { memo, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { fechaHora } from '@/lib/formato'

/** Las últimas lecturas, en renglones: la hora, la cifra y su estado en palabras. */
export const LecturasRecientes = memo(function LecturasRecientes({ serie }: { serie: LecturaTermica[] }) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const recientes = useMemo(
    () => [...serie].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 7),
    [serie],
  )
  if (recientes.length === 0) return null

  return (
    <section aria-labelledby="lecturas-recientes-titulo" className="min-w-0">
      <h2 id="lecturas-recientes-titulo" className="monitoreo__subtitulo">{t('dashboard.lecturasRecientesTitulo')}</h2>
      <p className="sr-only">{t('dashboard.lecturasRecientesAyuda')}</p>
      <ol className="renglones">
        {/* Cada lectura nueva entra arriba; las demás ceden su sitio. */}
        <AnimatePresence initial={false}>
          {recientes.map((lectura) => (
            <motion.li
              layout={reducir ? false : 'position'}
              key={`${lectura.device_id}-${lectura.timestamp}`}
              initial={reducir ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
              className="renglon"
            >
              <time dateTime={lectura.timestamp} className="nums renglon__hora">{fechaHora(lectura.timestamp)}</time>
              <span className="nums renglon__cifra">{lectura.temperatura_interna?.toFixed(1) ?? '—'} °C</span>
              <span className="renglon__estado" data-nivel={lectura.riesgo_efectivo ?? undefined}>
                {lectura.riesgo_efectivo ? t(`riesgo.${lectura.riesgo_efectivo}`) : '—'}
                {lectura.riesgo_efectivo && <span className="sr-only"> — {t(`riesgo.detalle.${lectura.riesgo_efectivo}`)}</span>}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  )
})
