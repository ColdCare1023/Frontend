import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, CircleDashed, OctagonAlert, Unplug } from 'lucide-react'

import type { EstadoRiesgo } from '@/domain/entities/LecturaTermica'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { cn } from '@/lib/utils'
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
 *
 * HU-34 esc. 4: «sin clasificación IA» y «falla de sensor» no son Normal,
 * Riesgo Preventivo ni Excursión Crítica. Van neutros (círculo discontinuo) o
 * como aviso operativo (enchufe), con su propio texto.
 */
const PRESENTACION = {
  normal: { variante: 'ok', icono: CheckCircle2 },
  riesgo_preventivo: { variante: 'warn', icono: AlertTriangle },
  excursion_critica: { variante: 'critical', icono: OctagonAlert },
  sin_clasificacion_ia: { variante: 'outline', icono: CircleDashed },
  falla_sensor: { variante: 'warn', icono: Unplug },
} as const

export function RiskBadge({ nivel }: { nivel: NivelRiesgo | EstadoRiesgo | null }) {
  const { t } = useTranslation()
  if (!nivel || !(nivel in PRESENTACION)) return <Badge variant="outline">—</Badge>

  const { variante, icono: Icono } = PRESENTACION[nivel]
  return (
    <Badge variant={variante} data-estado-riesgo={nivel}>
      <Icono className={cn('size-3.5 shrink-0', nivel === 'normal' && 'text-success-600')} aria-hidden />
      {t(`riesgo.${nivel}`)}
      <span className="sr-only"> — {t(`riesgo.detalle.${nivel}`)}</span>
    </Badge>
  )
}
