import { useTranslation } from 'react-i18next'

import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { Badge } from './ui/badge'

/**
 * Semáforo de riesgo térmico. Acta N.° 05 (acuerdo 5): lo crítico va en rojo
 * sólido, sin tonos salmón ni iconos redundantes; el nivel se lee en el texto,
 * así que no depende del color (WCAG 1.4.1).
 *
 * El detalle («Fuera del rango 2–8 °C…») queda oculto visualmente pero sí
 * anunciado por el lector de pantalla.
 */
const VARIANTE = {
  normal: 'ok',
  riesgo_preventivo: 'warn',
  excursion_critica: 'critical',
} as const

export function RiskBadge({ nivel }: { nivel: NivelRiesgo | null }) {
  const { t } = useTranslation()
  if (!nivel) return <Badge variant="outline">—</Badge>

  return (
    <Badge variant={VARIANTE[nivel]} dot={nivel !== 'excursion_critica'} data-riesgo={nivel}>
      {t(`riesgo.${nivel}`)}
      <span className="sr-only"> — {t(`riesgo.detalle.${nivel}`)}</span>
    </Badge>
  )
}
