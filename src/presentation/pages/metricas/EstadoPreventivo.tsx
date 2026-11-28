import { useTranslation } from 'react-i18next'
import { BrainCircuit, Eye, PowerOff } from 'lucide-react'

import type { ClasificacionPreventiva } from '@/application/hooks/useClasificacionPreventiva'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'

type Situacion = 'operativa' | 'sombra' | 'fuera'

function situacionDe(c: ClasificacionPreventiva): Situacion {
  if (c.operativa) return 'operativa'
  return c.modo === 'sombra' && c.disponible ? 'sombra' : 'fuera'
}

// Un ícono y un color por estado: se entiende sin leer.
const ESTILO = {
  operativa: { Icono: BrainCircuit, circulo: 'bg-success-100 text-success-700' },
  sombra: { Icono: Eye, circulo: 'bg-primary-tint text-primary-text' },
  fuera: { Icono: PowerOff, circulo: 'bg-warning-100 text-warning-700' },
} as const

/**
 * HU-20 / HU-34 (P0-3): si la clasificación preventiva decide el riesgo y
 * abre alertas, según lo que informa el backend (`GET /api/ia/preventivo`).
 * A la vista: estado y una sola línea. El motivo técnico queda en «¿Por qué?».
 */
export function EstadoClasificacionPreventiva({
  clasificacion,
  className,
}: {
  clasificacion: ClasificacionPreventiva | null
  className?: string
}) {
  const { t } = useTranslation()
  if (!clasificacion) return null
  const situacion = situacionDe(clasificacion)
  const { Icono, circulo } = ESTILO[situacion]
  const version = clasificacion.version ?? clasificacion.versionActivaRegistrada
  return (
    <section
      aria-labelledby="estado-preventivo-titulo"
      data-testid="estado-preventivo"
      data-situacion={situacion}
      className={cn('py-4 animate-(--animate-rise) sm:py-5', className)}
    >
      <div className="flex items-center gap-4">
        <span className={cn('relative grid size-14 shrink-0 place-items-center rounded-full', circulo)}>
          {situacion === 'operativa' && (
            <span aria-hidden className="absolute inset-0 rounded-full bg-success-600/25 motion-safe:animate-ping" />
          )}
          <Icono aria-hidden className="relative size-7" />
        </span>
        <div className="min-w-0">
          <h2 id="estado-preventivo-titulo" className="flex flex-wrap items-center gap-2 text-title text-foreground">
            {t('metricasIA.preventivo.titulo')}
            {situacion === 'operativa' ? (
              <Badge variant="ok" dot>{t('metricasIA.preventivo.enOperacion')}</Badge>
            ) : situacion === 'sombra' ? (
              <Badge variant="outline">{t('metricasIA.preventivo.enSombra')}</Badge>
            ) : (
              <Badge variant="warn">{t('metricasIA.preventivo.fueraDeOperacion')}</Badge>
            )}
            {clasificacion.datosSimulados && <Badge variant="outline">{t('metricasIA.preventivo.demostracion')}</Badge>}
          </h2>
          <p className="mt-1 text-body text-subtle">
            {situacion === 'operativa' ? t('registros.alertasPreventivasActivas') : t('metricasIA.preventivo.reglaDecide')}
          </p>
        </div>
      </div>
      <details className="mt-3 text-meta text-muted">
        <summary className="w-fit cursor-pointer py-1 font-medium">{t('metricasIA.preventivo.porQue')}</summary>
        <p className="mt-1 max-w-prose">
          {situacion === 'operativa'
            ? t('metricasIA.preventivo.detalleOperativa', { version: version ?? '—' })
            : situacion === 'sombra'
              ? t('metricasIA.preventivo.detalleSombra')
              : t(`metricasIA.preventivo.motivos.${clasificacion.motivo ?? 'generico'}`)}
        </p>
        {clasificacion.esVersionActivaRegistrada !== null && (
          <p className="nums mt-1">
            {t('metricasIA.preventivo.versionRegistro', { version: clasificacion.versionActivaRegistrada ?? t('metricasIA.preventivo.ninguna') })}
          </p>
        )}
      </details>
    </section>
  )
}
