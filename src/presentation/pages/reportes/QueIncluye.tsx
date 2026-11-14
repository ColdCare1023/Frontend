import { useTranslation } from 'react-i18next'
import { Bell, Link2, Thermometer } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Qué trae el reporte (columna izquierda en ≥1024): llena el lado con contenido real. */
export function QueIncluye({ className }: { className?: string }) {
  const { t } = useTranslation()
  const filas = [
    [Thermometer, 'reportes.incluyeLecturas'],
    [Bell, 'reportes.incluyeAlertas'],
    [Link2, 'reportes.incluyeTrazabilidad'],
  ] as const
  return (
    <section aria-labelledby="reportes-incluye-titulo" className={cn('superficie p-4 xl:p-5', className)}>
      <h2 id="reportes-incluye-titulo" className="text-title text-foreground">{t('reportes.queIncluye')}</h2>
      <ul className="mt-3 divide-y divide-border">
        {filas.map(([Icono, clave]) => (
          <li key={clave} className="flex items-start gap-3 py-2.5 text-body text-foreground">
            <Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
            {t(clave)}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-border pt-3 text-meta text-muted">{t('reportes.notaPdf')}</p>
    </section>
  )
}
