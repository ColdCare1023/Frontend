import { useTranslation } from 'react-i18next'
import { ClockAlert } from 'lucide-react'

import { lecturaSinHora, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import { fechaHora, hora } from '@/lib/formato'
import { cn } from '@/lib/utils'

const esDeHoy = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

/**
 * Hora de captura de una lectura (HU-07). Una lectura de un arranque sin hora
 * sincronizada no tiene hora de captura: su `timestamp` es la llegada al
 * servidor y mostrarlo como si fuera la captura sería falso. Se rotula «Sin
 * hora» y la llegada queda en el detalle. Una hora reconstruida lleva «≈».
 *
 * `formato`: «hora» (hoy), «fechaHora» o «auto» (hora si es de hoy).
 */
export function HoraLectura({
  lectura,
  formato = 'auto',
  className,
}: {
  lectura: Pick<LecturaTermica, 'timestamp' | 'timestamp_estimado' | 'sin_hora' | 'origen_hora' | 'time_quality' | 'recibida_en' | 'origen'>
  formato?: 'hora' | 'fechaHora' | 'auto'
  className?: string
}) {
  const { t } = useTranslation()
  if (lecturaSinHora(lectura)) {
    const detalle = t('dashboard.sinHoraDetalle', { llegada: fechaHora(lectura.recibida_en ?? lectura.timestamp) })
    return (
      <span title={detalle} data-sin-hora="" className={cn(className, 'inline-flex items-center gap-1 font-medium text-nodata-700')}>
        <ClockAlert aria-hidden className="size-3.5 shrink-0" />
        {t('dashboard.sinHora')}
        <span className="sr-only">. {detalle}</span>
      </span>
    )
  }
  const reconstruida = Boolean(lectura.timestamp_estimado) && lectura.origen_hora !== 'nodo'
  const iso = (reconstruida ? lectura.timestamp_estimado : lectura.timestamp) ?? lectura.timestamp
  const texto = formato === 'hora' || (formato === 'auto' && esDeHoy(iso)) ? hora(iso) : fechaHora(iso)
  return (
    <time
      dateTime={iso}
      title={reconstruida ? `${fechaHora(iso)} · ${t('dashboard.horaReconstruida')}` : fechaHora(iso)}
      className={className}
    >
      {reconstruida && (
        <>
          <span aria-hidden>≈ </span>
          <span className="sr-only">{t('dashboard.horaReconstruida')}: </span>
        </>
      )}
      {texto}
    </time>
  )
}
