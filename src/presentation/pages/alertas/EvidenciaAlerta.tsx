import { useTranslation } from 'react-i18next'
import { HardDrive, Mail, MailCheck, MailWarning, MailX, type LucideIcon } from 'lucide-react'

import { estadoNotificacion, type AlertaTermica, type EstadoNotificacion } from '@/domain/entities/AlertaTermica'
import { duracionLegible, fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { formatearTemperatura } from '../../components/ui/formato-cifra'
import { Regla } from '../../components/ui/regla'
import { Tooltip } from '../../components/ui/tooltip'

/** Forma propia por estado del correo: nunca solo color (WCAG 1.4.1). */
const CORREO: Record<EstadoNotificacion, { icono: LucideIcon; clase: string }> = {
  notificada: { icono: MailCheck, clase: 'text-success-700' },
  reintentando: { icono: MailWarning, clase: 'text-warning-700' },
  no_entregada: { icono: MailX, clase: 'text-critical' },
  pendiente: { icono: Mail, clase: 'text-faint' },
}

function useTextosCorreo(alerta: AlertaTermica) {
  const { t } = useTranslation()
  const estado = estadoNotificacion(alerta)
  if (estado === null) return null
  return {
    estado,
    texto: t(`alertas.notificacion.${estado}`),
    ayuda: t(`alertas.notificacion.${estado}Ayuda`, {
      fecha: fechaHora(alerta.notificada_en),
      intentos: alerta.notificacion_intentos ?? 0,
    }),
  }
}

/** Pico con la Regla S: el valor siempre en texto, la regla lo acompaña. */
export function PicoExcursion({ alerta, className }: { alerta: AlertaTermica; className?: string }) {
  const { t } = useTranslation()
  if (alerta.temperatura_pico == null) {
    return (
      <span className={cn('text-faint', className)}>
        <span aria-hidden className="text-meta">—</span>
        <span className="sr-only">{t('alertas.sinPico')}</span>
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Regla valor={alerta.temperatura_pico} tono={tonoDesdeRiesgo(alerta.nivel_riesgo)} tamano="s" decorativa />
      <span className="nums text-meta font-semibold text-foreground">
        <span className="sr-only">{t('alertas.pico')} </span>
        {formatearTemperatura(alerta.temperatura_pico)}
      </span>
    </span>
  )
}

/**
 * Evidencia secundaria en la fila (≥768): duración, correo e «Histórica» como
 * iconos con forma propia, tooltip y texto para lector de pantalla.
 */
export function EvidenciaFila({ alerta }: { alerta: AlertaTermica }) {
  const { t } = useTranslation()
  const correo = useTextosCorreo(alerta)
  const Correo = correo ? CORREO[correo.estado].icono : null
  return (
    <span className="flex items-center gap-1.5 text-meta text-faint">
      {alerta.duracion_s != null && (
        <span className="nums">
          <span className="sr-only">{t('alertas.duracion')} </span>
          {duracionLegible(alerta.duracion_s)}
        </span>
      )}
      {correo && Correo && (
        <Tooltip lado="top" contenido={`${correo.texto}. ${correo.ayuda}`}>
          <span tabIndex={0} className={cn('inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring', CORREO[correo.estado].clase)}>
            <Correo aria-hidden className="size-3.5" />
            <span className="sr-only">{correo.texto}</span>
          </span>
        </Tooltip>
      )}
      {alerta.historica && (
        <Tooltip lado="top" contenido={t('alertas.historicaAyuda')}>
          <span tabIndex={0} className="inline-flex rounded-sm text-warning-700 focus-visible:outline-2 focus-visible:outline-ring">
            <HardDrive aria-hidden className="size-3.5" />
            <span className="sr-only">{t('alertas.historica')}</span>
          </span>
        </Tooltip>
      )}
    </span>
  )
}

/**
 * Correo e «Histórica» como texto con su ayuda VISIBLE (móvil y panel): en
 * táctil no hay hover, así que la explicación no puede vivir solo en un tooltip.
 */
export function AvisosEvidencia({ alerta, className }: { alerta: AlertaTermica; className?: string }) {
  const { t } = useTranslation()
  const correo = useTextosCorreo(alerta)
  if (!correo && !alerta.historica) return null
  const Correo = correo ? CORREO[correo.estado].icono : null
  return (
    <ul className={cn('space-y-1.5 text-meta', className)}>
      {correo && Correo && (
        <li className="flex items-start gap-2">
          <Correo aria-hidden className={cn('mt-px size-3.5 shrink-0', CORREO[correo.estado].clase)} />
          <span>
            <span className="font-medium text-foreground">{correo.texto}</span>
            <span className="text-muted"> · {correo.ayuda}</span>
          </span>
        </li>
      )}
      {alerta.historica && (
        <li className="flex items-start gap-2">
          <HardDrive aria-hidden className="mt-px size-3.5 shrink-0 text-warning-700" />
          <span>
            <span className="font-medium text-foreground">{t('alertas.historica')}</span>
            <span className="text-muted"> · {t('alertas.historicaAyuda')}</span>
          </span>
        </li>
      )}
    </ul>
  )
}

/** Evidencia completa de la cabecera del panel: pico, duración, inicio y Regla M. */
export function EvidenciaPanel({ alerta }: { alerta: AlertaTermica }) {
  const { t } = useTranslation()
  const hayEvidencia = alerta.temperatura_pico != null || alerta.duracion_s != null || alerta.iniciada_en != null
  return (
    <section aria-label={t('alertas.panel.evidencia')} className="mt-4 space-y-3">
      {hayEvidencia ? (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <dt className="text-meta text-muted">{t('alertas.pico')}</dt>
              <dd className="nums text-body text-foreground">
                {alerta.temperatura_pico != null ? formatearTemperatura(alerta.temperatura_pico) : '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-meta text-muted">{t('alertas.duracion')}</dt>
              <dd className="nums text-body text-foreground">
                {alerta.duracion_s != null ? duracionLegible(alerta.duracion_s) : '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-meta text-muted">{t('alertas.inicioExcursion')}</dt>
              <dd className="nums text-body text-foreground">{fechaHora(alerta.iniciada_en)}</dd>
            </div>
          </dl>
          {alerta.temperatura_pico != null && (
            <Regla
              valor={alerta.temperatura_pico}
              tono={tonoDesdeRiesgo(alerta.nivel_riesgo)}
              tamano="m"
              cotas
              etiqueta={t('alertas.panel.reglaPico', { valor: formatearTemperatura(alerta.temperatura_pico) })}
            />
          )}
        </>
      ) : (
        <p className="text-meta text-faint">{t('alertas.panel.sinEvidencia')}</p>
      )}
      <AvisosEvidencia alerta={alerta} />
    </section>
  )
}
