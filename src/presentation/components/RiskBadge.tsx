import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react'

import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { Badge } from './ui/badge'

/**
 * Semáforo de riesgo térmico.
 *
 * WCAG 1.4.1 (Uso del color): el nivel no puede distinguirse solo por el tinte
 * de la píldora. Cada nivel lleva ahora una forma propia —círculo, triángulo,
 * octágono— además de su etiqueta textual, de modo que una impresión en blanco
 * y negro o una deficiencia protán/deután siguen siendo legibles.
 *
 * El detalle («Fuera del rango 2–8 °C…») vivía solo en `title`, que ni el
 * teclado ni buena parte de los lectores de pantalla exponen: pasa a texto
 * oculto visualmente pero sí anunciado.
 */
const PRESENTACION = {
  normal: { variante: 'ok', icono: CheckCircle2 },
  riesgo_preventivo: { variante: 'warn', icono: AlertTriangle },
  excursion_critica: { variante: 'critical', icono: OctagonAlert },
} as const

export function RiskBadge({ nivel }: { nivel: NivelRiesgo | null }) {
  const { t } = useTranslation()
  if (!nivel) return <Badge variant="outline">—</Badge>

  const { variante, icono: Icono } = PRESENTACION[nivel]
  return (
    <Badge variant={variante}>
      <Icono className="size-3.5 shrink-0" aria-hidden />
      {t(`riesgo.${nivel}`)}
      <span className="sr-only"> — {t(`riesgo.detalle.${nivel}`)}</span>
    </Badge>
  )
}
