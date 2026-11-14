import { useTranslation } from 'react-i18next'

import type { HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { EsqueletoTexto } from '../../../components/ui/esqueleto'

/**
 * HU-49: cada cambio con su etiqueta legible y el campo técnico (lo exige la
 * auditoría), valor anterior tachado → valor nuevo y la fecha.
 */
export function LineaTiempoCambios({
  cambios,
  cargando,
  campos,
  vacio,
  className,
}: {
  cambios: readonly HistorialConfiguracion[]
  cargando: boolean
  /** Si se indica, solo esos campos. */
  campos?: readonly string[]
  vacio?: string
  className?: string
}) {
  const { t } = useTranslation()
  if (cargando) return <EsqueletoTexto lineas={4} />
  const visibles = campos ? cambios.filter((c) => campos.includes(c.campo)) : cambios
  if (visibles.length === 0) {
    return <p className="text-meta text-muted">{vacio ?? t('dispositivos.sinHistorial')}</p>
  }
  return (
    <ol className={cn('space-y-3 border-l border-border pl-4', className)}>
      {visibles.map((c) => (
        <li key={c.id} className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-body font-medium text-foreground">
              {t(`dispositivos.campos.${c.campo}`, { defaultValue: c.campo })}{' '}
              <span className="codigo text-micro font-normal text-faint">{c.campo}</span>
            </p>
            <span className="nums text-meta text-faint">{fechaHora(c.created_at)}</span>
          </div>
          <p className="mt-0.5 break-words text-meta">
            <span className="text-faint line-through">{c.valor_anterior ?? '—'}</span>
            {' → '}
            <span className="font-medium text-foreground">{c.valor_nuevo ?? '—'}</span>
          </p>
        </li>
      ))}
    </ol>
  )
}
