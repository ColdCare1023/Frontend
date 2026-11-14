import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, History } from 'lucide-react'

import type { FiltroEstado } from '@/application/hooks/useAlertas'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { duracionLegible, fechaHora, fechaHoraCompacta } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/button'
import { CambioTexto } from '../../components/ui/cambio-texto'
import { ICONO_ESTADO, TEXTO_ESTADO, tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { PuntoEstado } from '../../components/ui/estado'
import { TableCell, TableRow } from '../../components/ui/table'
import { Tooltip } from '../../components/ui/tooltip'
import { AvisosEvidencia, EvidenciaFila, PicoExcursion } from './EvidenciaAlerta'
import type { PestanaPanel } from './tipos'

/**
 * Filo izquierdo de 3 px con el color del riesgo: la gravedad se lee al
 * recorrer la lista. Acompaña al icono con forma y al texto, nunca los
 * sustituye. En la tabla va en la primera celda (una fila de tabla no pinta
 * sombras en todos los navegadores); en la ficha móvil, la fila es una caja.
 */
const FILO_RIESGO: Record<string, { fila: string; celda: string }> = {
  excursion_critica: { fila: 'max-sm:shadow-[inset_3px_0_0_var(--color-critical-solid)]', celda: 'sm:shadow-[inset_3px_0_0_var(--color-critical-solid)]' },
  riesgo_preventivo: { fila: 'max-sm:shadow-[inset_3px_0_0_var(--color-warning-600)]', celda: 'sm:shadow-[inset_3px_0_0_var(--color-warning-600)]' },
  normal: { fila: 'max-sm:shadow-[inset_3px_0_0_var(--color-success-600)]', celda: 'sm:shadow-[inset_3px_0_0_var(--color-success-600)]' },
}

const TONO_ESTADO_ALERTA = { pendiente: 'neutro', reconocida: 'neutro', atendida: 'normal' } as const

export interface PropsFilaAlerta {
  alerta: AlertaTermica
  filtro: FiltroEstado
  puedeReconocer: boolean
  puedeRegistrar: boolean
  seleccionada: boolean
  revisando: boolean
  /** Llegó por SSE después de la carga inicial (`useIdsNuevos`). */
  nueva?: boolean
  /** Posición en la página, para el escalonado de las filas nuevas. */
  indice?: number
  onRevisar: (alerta: AlertaTermica) => void
  onAbrir: (alerta: AlertaTermica, pestana: PestanaPanel, disparador: HTMLElement) => void
}

/**
 * Fila de la bandeja (21st Kibo table: icono, título y subtítulo). Las tres
 * acciones van visibles —Revisar, Registrar acción y Cronología— en vez del
 * menú «Opciones» (H4, DIRECTION §5.2). Memoizada: escribir en el panel no
 * vuelve a pintar la tabla (PERFORMANCE C7).
 */
export const FilaAlerta = memo(function FilaAlerta({
  alerta,
  filtro,
  puedeReconocer,
  puedeRegistrar,
  seleccionada,
  revisando,
  nueva = false,
  indice = 0,
  onRevisar,
  onAbrir,
}: PropsFilaAlerta) {
  const { t } = useTranslation()
  const tono = tonoDesdeRiesgo(alerta.nivel_riesgo)
  const IconoRiesgo = ICONO_ESTADO[tono]
  const fecha = fechaHoraCompacta(alerta.created_at)
  const datos = { equipo: alerta.device_id, fecha }

  // La fila sale de su pestaña tras mostrar el resultado (Revisada / atendida).
  const recienRevisada = filtro === 'pendiente' && alerta.estado === 'reconocida'
  const saliendo = recienRevisada || ((filtro === 'pendiente' || filtro === 'reconocida') && alerta.estado === 'atendida')
  const mostrarRevisar = puedeReconocer && (alerta.estado === 'pendiente' || recienRevisada)
  const mostrarRegistrar = puedeRegistrar && alerta.estado !== 'atendida'
  const soloCronologia = !mostrarRevisar && !mostrarRegistrar

  return (
    <TableRow
      data-seleccionada={seleccionada || undefined}
      data-saliendo={saliendo || undefined}
      {...(nueva ? { 'data-nueva': '', style: { '--i': Math.min(indice, 3) } as React.CSSProperties } : {})}
      className={cn(
        'hover:bg-surface-hover data-[seleccionada]:bg-primary-tint',
        alerta.nivel_riesgo && FILO_RIESGO[alerta.nivel_riesgo]?.fila,
      )}
    >
      <TableCell
        className={cn('mobile-full py-2.5 pr-3 pl-4 sm:w-full sm:max-w-0 sm:py-2 sm:pr-3 sm:pl-4', alerta.nivel_riesgo && FILO_RIESGO[alerta.nivel_riesgo]?.celda)}
      >
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <IconoRiesgo aria-hidden className={cn('mt-0.5 size-4 shrink-0 sm:mt-0', TEXTO_ESTADO[tono])} />
          <span className="sr-only">
            {alerta.nivel_riesgo ? `${t(`riesgo.${alerta.nivel_riesgo}`)} — ${t(`riesgo.detalle.${alerta.nivel_riesgo}`)}` : ''}
          </span>
          <p
            title={alerta.mensaje}
            className="min-w-0 text-body font-medium text-foreground max-sm:line-clamp-3 sm:truncate"
          >
            {alerta.mensaje}
          </p>
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 pl-6 text-meta text-faint sm:flex-nowrap sm:overflow-hidden sm:whitespace-nowrap">
          {filtro === 'todas' && (
            <>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <PuntoEstado tono={TONO_ESTADO_ALERTA[alerta.estado]} />
                {t(`alertas.estadoAlerta.${alerta.estado}`)}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="codigo text-muted">{alerta.device_id}</span>
          <span aria-hidden>·</span>
          <time className="nums" dateTime={alerta.created_at ?? undefined} title={fechaHora(alerta.created_at)}>
            {fecha}
          </time>
        </div>
        {/* Bajo 768 la columna Excursión se oculta: su contenido baja aquí. */}
        <div className="mt-1.5 space-y-1.5 pl-6 md:hidden">
          {(alerta.temperatura_pico != null || alerta.duracion_s != null) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-faint">
              <PicoExcursion alerta={alerta} />
              {alerta.duracion_s != null && (
                <span className="nums">
                  <span className="sr-only">{t('alertas.duracion')} </span>
                  {duracionLegible(alerta.duracion_s)}
                </span>
              )}
            </div>
          )}
          <AvisosEvidencia alerta={alerta} />
        </div>
      </TableCell>
      <TableCell className="hidden w-36 px-3 py-2 max-sm:hidden! sm:px-3 md:table-cell">
        <PicoExcursion alerta={alerta} />
        <div className="mt-0.5">
          <EvidenciaFila alerta={alerta} />
        </div>
      </TableCell>
      <TableCell className="mobile-actions mobile-full whitespace-nowrap py-2 pr-4 pl-3 text-right sm:w-px sm:pr-4 sm:pl-3">
        <div className="flex items-center justify-end gap-2 max-sm:w-full">
          {mostrarRevisar && (
            <Tooltip lado="top" contenido={t('alertas.marcarRevisada')}>
              <Button
                variant="secondary"
                size="sm"
                aria-label={recienRevisada ? t('alertas.anuncio.revisada', { equipo: alerta.device_id }) : t('alertas.revisarA', datos)}
                aria-disabled={revisando || recienRevisada || undefined}
                className="min-w-[74px] flex-none aria-disabled:cursor-default"
                onClick={() => {
                  if (revisando || recienRevisada) return
                  onRevisar(alerta)
                }}
              >
                <CambioTexto
                  texto={recienRevisada ? t('alertas.revisadaOk') : revisando ? t('alertas.revisando') : t('alertas.revisar')}
                  icono={recienRevisada ? <Check aria-hidden className="text-success-700" /> : undefined}
                />
              </Button>
            </Tooltip>
          )}
          {mostrarRegistrar && (
            <Button
              size="sm"
              aria-haspopup="dialog"
              aria-label={t('alertas.registrarAccionA', datos)}
              className="max-sm:flex-1"
              onClick={(e) => onAbrir(alerta, 'accion', e.currentTarget)}
            >
              {t('alertas.registrarAccionCorta')}
            </Button>
          )}
          {soloCronologia ? (
            <Button
              variant="ghost"
              size="sm"
              aria-haspopup="dialog"
              aria-label={t('alertas.cronologiaA', datos)}
              className="max-sm:flex-1 max-sm:justify-start max-sm:px-2 sm:w-9 sm:px-0"
              onClick={(e) => onAbrir(alerta, 'cronologia', e.currentTarget)}
            >
              <History aria-hidden />
              <span className="sm:sr-only">{t('alertas.panel.verCronologia')}</span>
            </Button>
          ) : (
            <Tooltip lado="top" contenido={t('alertas.verDetalle')}>
              <Button
                variant="ghost"
                size="sm"
                aria-haspopup="dialog"
                aria-label={t('alertas.cronologiaA', datos)}
                className="w-11 flex-none px-0 sm:w-9"
                onClick={(e) => onAbrir(alerta, 'cronologia', e.currentTarget)}
              >
                <History aria-hidden />
              </Button>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})
