import { useTranslation } from 'react-i18next'

import { fusionarTramos, porcentajeConDatos, type TramoDisponibilidad } from '@/domain/value-objects/Disponibilidad'
import { hora } from '@/lib/formato'
import { clsx } from 'clsx'
import { FONDO_TRAMO } from './utilidades'

const iso = (ms: number) => new Date(ms).toISOString()

/**
 * Cinta de disponibilidad de 24 h (21st System Status): si el equipo
 * reportó, no si la temperatura fue buena. Un `role="img"` con resumen; cada
 * tramo lleva su tooltip nativo y el detalle completo vive en el panel.
 */
export function CintaDisponibilidad({
  tramos,
  equipo,
  className,
}: {
  tramos: readonly TramoDisponibilidad[]
  equipo: string
  className?: string
}) {
  const { t } = useTranslation()
  const porcentaje = porcentajeConDatos(tramos) ?? '—'
  const detalle = fusionarTramos(tramos)
    .filter((tramo) => tramo.estado !== 'operativo' && tramo.estado !== 'sin_registro')
    .slice(-3)
    .map((tramo) => ` ${t('dashboard.cintaTramo', { estado: t(`dashboard.cinta.${tramo.estado}`), desde: hora(iso(tramo.inicio)), hasta: hora(iso(tramo.fin)) })}`)
    .join('')
  return (
    <div
      role="img"
      aria-label={t('dashboard.cintaEtiqueta', { equipo, porcentaje, detalle })}
      className={clsx('cinta-24h', className)}
      style={{ '--segmentos': tramos.length } as React.CSSProperties}
    >
      {tramos.map((tramo) => (
        <span
          key={tramo.inicio}
          data-estado={tramo.estado}
          title={t('dashboard.cintaTooltip', { desde: hora(iso(tramo.inicio)), hasta: hora(iso(tramo.fin)), estado: t(`dashboard.cinta.${tramo.estado}`) })}
          className={FONDO_TRAMO[tramo.estado]}
        />
      ))}
    </div>
  )
}
