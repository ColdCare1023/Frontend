import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleDashed, ShieldX } from 'lucide-react'

import type { MotivoNoEntrenado, MotivoRechazo } from '@/application/hooks/useModeloIA'
import { cn } from '@/lib/utils'

export type EstadoCargaModelo = 'disponible' | 'no_entrenado' | 'rechazado'

const ESTILO: Record<EstadoCargaModelo, { icono: typeof CircleCheck; caja: string; iconoClase: string }> = {
  disponible: { icono: CircleCheck, caja: 'border-border bg-surface text-foreground', iconoClase: 'text-success-700' },
  no_entrenado: { icono: CircleDashed, caja: 'border-border bg-surface text-foreground', iconoClase: 'text-muted' },
  rechazado: { icono: ShieldX, caja: 'border-critical/30 bg-critical-tint text-critical', iconoClase: '' },
}

/**
 * HU-16: tres estados distintos del modelo Random Forest, cada uno con su
 * icono y su texto (WCAG 1.4.1). «Rechazado por verificación» (503 con
 * `rechazado_por_verificacion`) no se confunde con «no entrenado» ni con
 * «disponible»; en los dos primeros se recuerda que el monitoreo térmico sigue.
 */
export function EstadoModelo({
  estado,
  motivo = null,
  version = null,
  className,
}: {
  estado: EstadoCargaModelo
  motivo?: MotivoRechazo | MotivoNoEntrenado | null
  version?: string | null
  className?: string
}) {
  const { t } = useTranslation()
  const { icono: Icono, caja, iconoClase } = ESTILO[estado]
  const detalle =
    estado === 'disponible'
      ? version
        ? t('metricasIA.modelo.disponible.detalleVersion', { version })
        : t('metricasIA.modelo.disponible.detalle')
      : t(`metricasIA.modelo.${estado}.motivos.${motivo ?? 'generico'}`)
  return (
    <div
      role="status"
      data-testid="estado-modelo"
      data-estado={estado}
      data-motivo={motivo ?? undefined}
      className={cn('flex items-start gap-3 rounded-(--radius-card) border px-4 py-3', caja, className)}
    >
      <Icono aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconoClase)} />
      <div className="min-w-0">
        <p className="text-body">
          <span className="font-semibold">{t(`metricasIA.modelo.${estado}.titulo`)}</span> {detalle}
        </p>
        {estado === 'rechazado' && <p className="mt-0.5 text-meta">{t('metricasIA.modelo.rechazado.sinInferencia')}</p>}
        {estado !== 'disponible' && (
          <p className={cn('mt-0.5 text-meta', estado === 'no_entrenado' && 'text-muted')}>{t('metricasIA.modelo.continuaMonitoreo')}</p>
        )}
      </div>
    </div>
  )
}
