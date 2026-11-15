import { useTranslation } from 'react-i18next'
import { CircleCheck, Eye, PowerOff } from 'lucide-react'

import type { ClasificacionPreventiva } from '@/application/hooks/useClasificacionPreventiva'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'

type Situacion = 'operativa' | 'sombra' | 'fuera'

function situacionDe(c: ClasificacionPreventiva): Situacion {
  if (c.operativa) return 'operativa'
  return c.modo === 'sombra' && c.disponible ? 'sombra' : 'fuera'
}

const ICONO = { operativa: CircleCheck, sombra: Eye, fuera: PowerOff } as const

/**
 * HU-20 / HU-34 (P0-3): si la clasificación preventiva decide el riesgo y
 * abre alertas, según lo que informa el backend (`GET /api/ia/preventivo`).
 * Fuera de operación se dice por qué (motivo estable del backend) y que el
 * riesgo lo decide la regla de 2–8 °C; nunca se infiere desde la interfaz.
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
  const Icono = ICONO[situacion]
  const version = clasificacion.version ?? clasificacion.versionActivaRegistrada
  return (
    <section
      aria-labelledby="estado-preventivo-titulo"
      data-testid="estado-preventivo"
      data-situacion={situacion}
      className={cn('superficie p-4 xl:p-5', className)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="estado-preventivo-titulo" className="flex items-center gap-2 text-title text-foreground">
          <Icono aria-hidden className={cn('size-4', situacion === 'operativa' ? 'text-success-700' : 'text-muted')} />
          {t('metricasIA.preventivo.titulo')}
        </h2>
        {situacion === 'operativa' ? (
          <Badge variant="ok" dot>{t('metricasIA.preventivo.enOperacion')}</Badge>
        ) : situacion === 'sombra' ? (
          <Badge variant="outline">{t('metricasIA.preventivo.enSombra')}</Badge>
        ) : (
          <Badge variant="warn">{t('metricasIA.preventivo.fueraDeOperacion')}</Badge>
        )}
        {clasificacion.datosSimulados && <Badge variant="outline">{t('metricasIA.preventivo.demostracion')}</Badge>}
      </div>
      <p className="mt-2 max-w-prose text-body text-muted">
        {situacion === 'operativa'
          ? t('metricasIA.preventivo.detalleOperativa', { version: version ?? '—' })
          : situacion === 'sombra'
            ? t('metricasIA.preventivo.detalleSombra')
            : t(`metricasIA.preventivo.motivos.${clasificacion.motivo ?? 'generico'}`)}
      </p>
      {situacion !== 'operativa' && <p className="mt-1 max-w-prose text-meta text-muted">{t('metricasIA.preventivo.reglaDecide')}</p>}
      {/* Un backend anterior no informa el registro de versiones: no se afirma «ninguna». */}
      {clasificacion.esVersionActivaRegistrada !== null && (
        <p className="nums mt-2 text-meta text-faint">
          {t('metricasIA.preventivo.versionRegistro', {
            version: clasificacion.versionActivaRegistrada ?? t('metricasIA.preventivo.ninguna'),
          })}
        </p>
      )}
    </section>
  )
}
