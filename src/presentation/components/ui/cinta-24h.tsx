import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { hora } from '@/lib/formato'
import { FONDO_ESTADO } from './estado-tonos'
import { formatearTemperatura } from './formato-cifra'
import type { SegmentoCinta } from './segmentar-lecturas'

/**
 * Cinta 24 h (21st System Status, DIRECTION §4): un segmento por tramo con el
 * color del estado y trama para «sin datos». Cada segmento lleva su tooltip
 * nativo (hora, estado, mín y máx); el conjunto se resume en el nombre
 * accesible para no leer 48 elementos.
 */
export function Cinta24h({
  segmentos,
  etiqueta,
  className,
}: {
  segmentos: readonly SegmentoCinta[]
  /** Nombre accesible del resumen, p. ej. «Últimas 24 h de Refrigerador 1». */
  etiqueta: string
  className?: string
}) {
  const { t } = useTranslation()
  const fuera = segmentos.filter((s) => s.tono === 'critico' || s.tono === 'preventivo').length
  const sinDatos = segmentos.filter((s) => s.tono === 'sin_datos').length
  const resumen = t('cinta.resumen', { etiqueta, fuera, sinDatos, total: segmentos.length })

  return (
    <div
      role="img"
      aria-label={resumen}
      className={cn('cinta-24h', className)}
      style={{ '--segmentos': segmentos.length } as React.CSSProperties}
    >
      {segmentos.map((segmento) => (
        <span
          key={segmento.inicio}
          data-tono={segmento.tono}
          title={[
            hora(segmento.inicio),
            t(`cinta.estado.${segmento.tono}`),
            segmento.minimo !== null && segmento.maximo !== null
              ? `${formatearTemperatura(segmento.minimo)} – ${formatearTemperatura(segmento.maximo)}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          className={FONDO_ESTADO[segmento.tono]}
        />
      ))}
    </div>
  )
}
