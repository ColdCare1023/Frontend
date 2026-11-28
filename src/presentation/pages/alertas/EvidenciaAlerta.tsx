import { useTranslation } from 'react-i18next'
import { HardDrive, Mail, MailCheck, MailWarning, MailX, type LucideIcon } from 'lucide-react'

import { estadoDeEquipo, useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { estadoNotificacion, type AlertaTermica, type EstadoNotificacion } from '@/domain/entities/AlertaTermica'
import { duracionLegible, fechaHora, fechaHoraCompacta } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { COLOR_ESTADO, tonoDesdeRiesgo, type TonoEstado } from '../../components/ui/estado-tonos'
import { formatearTemperatura } from '../../components/ui/formato-cifra'
import { Regla } from '../../components/ui/regla'
import { posicionEnRegla } from '../../components/ui/regla-eje'

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
 * Evidencia breve de la fila. El detalle conserva los cuatro estados de envío.
 */
export function EvidenciaFila({ alerta }: { alerta: AlertaTermica }) {
  const { t } = useTranslation()
  const correo = useTextosCorreo(alerta)
  const falloCorreo = correo?.estado === 'no_entregada' || correo?.estado === 'reintentando'
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
      {alerta.duracion_s != null && (
        <span className="nums">
          <span className="sr-only">{t('alertas.duracion')} </span>
          {duracionLegible(alerta.duracion_s)}
        </span>
      )}
      {falloCorreo && (
        <span className="inline-flex items-center gap-1 font-medium text-warning-700">
          <MailWarning aria-hidden className="size-3.5" />
          {correo.texto}
        </span>
      )}
      {alerta.historica && (
        <span className="inline-flex items-center gap-1 text-muted">
          <HardDrive aria-hidden className="size-3.5" />
          {t('alertas.historica')}
        </span>
      )}
    </span>
  )
}

/**
 * Explicaciones de procedencia y entrega que se consultan en el panel.
 */
export function AvisosEvidencia({ alerta, className }: { alerta: AlertaTermica; className?: string }) {
  const { t } = useTranslation()
  const correo = useTextosCorreo(alerta)
  if (!correo && !alerta.historica) return null
  const Correo = correo ? CORREO[correo.estado].icono : null
  return (
    // Chips cortos: la explicación queda para el lector de pantalla y al pasar el cursor.
    <ul className={cn('flex flex-wrap gap-1.5 text-meta', className)}>
      {correo && Correo && (
        <li title={correo.ayuda} className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 font-medium text-foreground">
          <Correo aria-hidden className={cn('size-3.5 shrink-0', CORREO[correo.estado].clase)} />
          {correo.texto}
          <span className="sr-only"> · {correo.ayuda}</span>
        </li>
      )}
      {alerta.historica && (
        <li title={t('alertas.historicaAyuda')} className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-1 font-medium text-warning-700">
          <HardDrive aria-hidden className="size-3.5 shrink-0" />
          {t('alertas.historica')}
          <span className="sr-only"> · {t('alertas.historicaAyuda')}</span>
        </li>
      )}
    </ul>
  )
}

/**
 * Medidor del pico: tres tramos (bajo 2 °C, 2–8 °C seguro, sobre 8 °C) y el
 * pico como un pin con su cifra encima. Se lee de un vistazo: dónde está el
 * pico frente a la zona segura. El valor siempre va en texto (no solo color).
 */
function MedidorPico({ pico, tono, etiqueta }: { pico: number; tono: TonoEstado; etiqueta: string }) {
  const pos = posicionEnRegla(pico) * 100
  const bajo = posicionEnRegla(2) * 100
  const alto = posicionEnRegla(8) * 100
  const color = COLOR_ESTADO[tono]
  const fuera = pico < 2 || pico > 8
  return (
    <div role="img" aria-label={etiqueta} className="pt-8 pb-1">
      <div className="relative">
        <div aria-hidden className="flex h-2.5 gap-0.5">
          <span className={cn('rounded-l-full', pico < 2 ? 'bg-critical-tint ring-1 ring-inset ring-critical-solid/40' : 'bg-surface-sunken')} style={{ width: `${bajo}%` }} />
          <span className="rounded-xs bg-success-100 ring-1 ring-inset ring-success-600/40" style={{ width: `${alto - bajo}%` }} />
          <span className={cn('flex-1 rounded-r-full', pico > 8 ? 'bg-critical-tint ring-1 ring-inset ring-critical-solid/40' : 'bg-surface-sunken')} />
        </div>
        {/* Pin del pico: cifra encima (se corre hacia adentro en los bordes) y punto con halo. */}
        <span
          aria-hidden
          className="nums absolute bottom-full mb-2.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-micro font-semibold text-surface motion-safe:animate-(--animate-pop-in)"
          style={{ left: `${pos}%`, transform: `translateX(-${pos}%)`, background: color }}
        >
          {formatearTemperatura(pico)}
        </span>
        <span
          aria-hidden
          className="absolute top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center"
          style={{ left: `${pos}%` }}
        >
          {fuera && <span className="absolute inset-0 rounded-full opacity-40 motion-safe:animate-ping" style={{ background: color }} />}
          <span className="relative size-4 rounded-full border-2 border-surface" style={{ background: color }} />
        </span>
      </div>
      <div aria-hidden className="nums relative mt-2 h-4 text-micro text-faint">
        <span className="absolute -translate-x-1/2" style={{ left: `${bajo}%` }}>2 °C</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${alto}%` }}>8 °C</span>
      </div>
    </div>
  )
}

/** Evidencia completa de la cabecera del panel: pico, duración, inicio y medidor del pico. */
export function EvidenciaPanel({ alerta }: { alerta: AlertaTermica }) {
  const { t } = useTranslation()
  const equipo = useEstadoVivoStore((s) => s.equipos.find((item) => item.id === alerta.device_id))
  const ultima = useEstadoVivoStore((s) => s.ultimas[alerta.device_id])
  const estadoEquipo = equipo ? estadoDeEquipo(equipo, ultima).clave : null
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
              <dt className="text-meta text-muted">{t('alertas.panel.inicio')}</dt>
              <dd className="nums text-body text-foreground">{alerta.iniciada_en ? fechaHoraCompacta(alerta.iniciada_en) : '—'}</dd>
            </div>
          </dl>
          {alerta.temperatura_pico != null && (
            <MedidorPico
              pico={alerta.temperatura_pico}
              tono={tonoDesdeRiesgo(alerta.nivel_riesgo)}
              etiqueta={t('alertas.panel.reglaPico', { valor: formatearTemperatura(alerta.temperatura_pico) })}
            />
          )}
        </>
      ) : (
        <p className="text-meta text-faint">{t('alertas.panel.sinEvidencia')}</p>
      )}
      {equipo && alerta.estado !== 'atendida' && (
        // Una sola línea: cómo está el equipo ahora (el nombre ya está en la cabecera).
        <p className="nums text-meta text-muted">
          {ultima?.temperatura != null && estadoEquipo !== 'falla_sensor' ? (
            <>{t('alertas.panel.ahora', { valor: formatearTemperatura(ultima.temperatura) })} · </>
          ) : null}
          {t(`estadoVivo.estado.${estadoEquipo}`)}
        </p>
      )}
      <AvisosEvidencia alerta={alerta} />
    </section>
  )
}
