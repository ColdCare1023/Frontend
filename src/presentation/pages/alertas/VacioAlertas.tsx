import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { FiltroEstado } from '@/application/hooks/useAlertas'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHoraCompacta } from '@/lib/formato'
import { EstadoVacio } from '../../components/EstadoPagina'
import { Button } from '../../components/ui/button'

/**
 * Vacío compacto por filtro (DIRECTION §13.6, 21st «You're all caught up»):
 * ilustración a la izquierda, texto, un dato de contexto y siempre una acción.
 * «Todo en orden» depende solo de que la GET de pendientes respondió vacía.
 */
export function VacioAlertas({
  filtro,
  integrada = false,
  revisadas,
  ultimaAtendida,
  incidentesActivos,
  onFiltro,
}: {
  filtro: FiltroEstado
  integrada?: boolean
  revisadas: number | null
  ultimaAtendida: AlertaTermica | null
  incidentesActivos: number | null
  onFiltro: (filtro: FiltroEstado) => void
}) {
  const { t } = useTranslation()
  const accion = (destino: FiltroEstado, texto: string) => (
    <Button variant="secondary" size="sm" data-accion-vacio onClick={() => onFiltro(destino)}>
      {texto}
    </Button>
  )

  if (filtro === 'pendiente') {
    const sinOtrasTareas = revisadas === 0 && incidentesActivos === 0
    return (
      <EstadoVacio
        ilustracion={sinOtrasTareas ? 'al-dia' : 'sin-resultados'}
        className="rounded-none border-0"
        titulo={t(sinOtrasTareas ? 'alertas.vacio.enOrdenTitulo' : 'alertas.vacio.enOrdenDetalle')}
        detalle={sinOtrasTareas ? t('alertas.vacio.enOrdenDetalle') : undefined}
        contexto={
          ultimaAtendida || (incidentesActivos ?? 0) > 0 ? (
            <>
              {ultimaAtendida && (
                <p className="nums">
                  {t('alertas.vacio.ultimaAtendida', {
                    equipo: ultimaAtendida.device_id,
                    fecha: fechaHoraCompacta(ultimaAtendida.atendida_en),
                  })}
                </p>
              )}
              {(incidentesActivos ?? 0) > 0 && (
                <a
                  href="#incidentes-operativos"
                  className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                >
                  {t('alertas.vacio.incidentes', { count: incidentesActivos ?? 0 })}
                </a>
              )}
            </>
          ) : undefined
        }
      >
        {(revisadas ?? 0) > 0
          ? accion('reconocida', t('alertas.vacio.verRevisadas', { count: revisadas ?? 0 }))
          : accion('atendida', t('alertas.vacio.verAtendidas'))}
      </EstadoVacio>
    )
  }
  if (filtro === 'reconocida') {
    return (
      <EstadoVacio ilustracion="sin-resultados" className="rounded-none border-0" titulo={t('alertas.sinRevisadas')}>
        {accion('pendiente', t('alertas.vacio.verPendientes'))}
      </EstadoVacio>
    )
  }
  if (filtro === 'atendida') {
    return (
      <EstadoVacio ilustracion="sin-resultados" className="rounded-none border-0" titulo={t('alertas.sinAtendidas')}>
        {accion('todas', t('alertas.vacio.verTodas'))}
      </EstadoVacio>
    )
  }
  return (
    <EstadoVacio
      ilustracion="al-dia"
      className="rounded-none border-0"
      titulo={t('alertas.sinAlertas')}
      detalle={t('alertas.vacio.todasDetalle')}
    >
      {integrada ? accion('pendiente', t('alertas.vacio.verPendientes')) : (
        <Link
          to="/dashboard"
          data-accion-vacio
          className="inline-flex h-11 items-center rounded-(--radius-field) border border-border-strong bg-surface px-3 text-body font-medium text-foreground transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-9 sm:pointer-coarse:h-11"
        >
          {t('alertas.vacio.irMonitoreo')}
        </Link>
      )}
    </EstadoVacio>
  )
}
